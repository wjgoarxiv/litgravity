# Unsafe Discipline

A sound unsafe codebase has a microscopic unsafe surface: a few lines behind one type with one constructor, each block carrying a SAFETY comment that names a specific invariant. Coding agents follow that shape mechanically once the first example exists, so this file supplies the shape.

## The three required parts

Every `unsafe` block needs all three. A block missing one is incomplete work.

1. **Safe wrapper.** The crate's public API exposes no `unsafe fn` and no raw pointer types unless the function is marked `unsafe` with a documented contract. A safe constructor takes something already proven (a reference, an owned value) and never a claim.
2. **SAFETY comment.** A `// SAFETY:` line within five lines above the block, stating which invariant holds and where it comes from. "This is safe because we checked" fails review.
3. **Miri test.** A test that exercises the unsafe path under `cargo +nightly miri nextest run`. When a path cannot run under Miri (FFI, syscalls), provide an alternative proof, isolate it behind a feature, and gate the test with `#[cfg_attr(miri, ignore)]`.

Crates without unsafe code say so: put `#![forbid(unsafe_code)]` at the crate root, which turns a later accidental `unsafe` into a compile error. Edition 2024 adds `unsafe_op_in_unsafe_fn` as a default warning (this configuration denies it): each unsafe operation inside an `unsafe fn` sits in its own `unsafe {}` block with its own comment.

## The wrapper pattern

Mirror the shape of `std::ptr::NonNull<T>` for every raw pointer, raw slice or uninitialised-memory operation: one private field holding the unsafe representation, constructors that prove their preconditions, methods that expose only safe references.

```rust
use core::marker::PhantomData;
use core::ptr::NonNull;

/// An exclusive handle to a `T` owned elsewhere, stored as a raw pointer.
///
/// Invariants, established by every constructor and relied on by every method:
/// the pointer is non-null, aligned, points to an initialised `T`, and no other
/// reference to that `T` is live for `'a`.
pub struct Slot<'a, T> {
    inner: NonNull<T>,
    _borrow: PhantomData<&'a mut T>,
}

// SAFETY: a `Slot<'a, T>` behaves like `&'a mut T`: it is the only access path to the
// value, so moving it to another thread is as safe as moving the reference.
unsafe impl<T: Send> Send for Slot<'_, T> {}
// SAFETY: sharing `&Slot` only allows `&T` access through `get`, which is sound when
// `T: Sync`, matching the rule for `&&mut T`.
unsafe impl<T: Sync> Sync for Slot<'_, T> {}

impl<'a, T> Slot<'a, T> {
    /// Safe constructor. The `&'a mut T` is the proof of every invariant.
    pub fn new(target: &'a mut T) -> Self {
        Self { inner: NonNull::from(target), _borrow: PhantomData }
    }

    /// Wrap a pointer obtained elsewhere.
    ///
    /// # Safety
    ///
    /// - `ptr` points to an initialised `T` that is valid for reads and writes for `'a`.
    /// - `ptr` is aligned to `align_of::<T>()`.
    /// - No other reference or pointer reads or writes `*ptr` during `'a`.
    pub unsafe fn from_non_null(ptr: NonNull<T>) -> Self {
        Self { inner: ptr, _borrow: PhantomData }
    }

    pub fn get(&self) -> &T {
        // SAFETY: the constructor invariants say `inner` points to an initialised, aligned `T`
        // that nothing else accesses; `&self` ties the returned lifetime to this handle.
        unsafe { self.inner.as_ref() }
    }

    pub fn get_mut(&mut self) -> &mut T {
        // SAFETY: as above, and `&mut self` proves no other borrow of this handle exists
        // for the lifetime of the returned `&mut T`.
        unsafe { self.inner.as_mut() }
    }
}
```

What the shape buys:

- A caller cannot build a `Slot` without a real `&mut T` or an explicit `unsafe` obligation.
- The raw pointer never leaks; `get` and `get_mut` return references with ordinary lifetimes, so the borrow checker covers the rest.
- `Send` and `Sync` are opt-in with bounds that mirror the reference the wrapper imitates.
- A function marked `unsafe` documents its contract in a `# Safety` section; callers reading it know what they sign.

A safe `fn new(ptr: *mut T)` that merely checks for null and alignment is unsound: safe code can pass a dangling, aligned pointer and then call a method that dereferences it. Any safe function that makes a claim about memory has to receive proof of the claim.

## SAFETY comment grammar

Each comment maps to one invariant and names where the guarantee originates:

```rust
// SAFETY: <which invariant holds>: <how this code establishes it>.
```

Comments that fail review:

```rust
// SAFETY: this is fine
// SAFETY: we know what we're doing
// SAFETY: the caller will not pass null
// SAFETY: tested
```

Comments that pass:

```rust
// SAFETY: `len <= self.capacity` was checked above and `self.ptr` came from the same
// allocation we read through, so the range `ptr..ptr + len` is in bounds.

// SAFETY: `read_volatile` needs a non-null, aligned pointer; both hold because `self.inner`
// is a `NonNull<T>` produced by `Slot::new`, whose `&mut T` source is aligned.

// SAFETY: `&mut self` rules out concurrent readers. The slice borrow ends before the next
// `&self` call because the helper returns by value.
```

Each `unsafe {}` block holds one unsafe operation. Clippy's `multiple_unsafe_ops_per_block` and `undocumented_unsafe_blocks` enforce both rules, and the audit script rule `unsafe-no-safety` checks the comment's presence.

## A bump arena: lots of unsafe behind one safe surface

A bump allocator hands out `&mut T` from `&self`, which is the textbook case of unsafe inside a safe interface. This single-threaded version stores bytes in a boxed slice of `UnsafeCell<MaybeUninit<u8>>`:

```rust
use core::cell::{Cell, UnsafeCell};
use core::mem::{self, MaybeUninit};

/// Error returned when the region cannot fit another value.
#[derive(Debug, PartialEq, Eq)]
pub struct ArenaFull;

/// A single-threaded bump region. Values live until the arena drops.
pub struct Arena {
    storage: Box<[UnsafeCell<MaybeUninit<u8>>]>,
    head: Cell<usize>,
}

impl Arena {
    #[must_use]
    pub fn with_capacity(bytes: usize) -> Self {
        let storage = (0..bytes).map(|_| UnsafeCell::new(MaybeUninit::uninit())).collect();
        Self { storage, head: Cell::new(0) }
    }

    /// Move `value` into the arena and return an exclusive reference to it.
    #[allow(clippy::mut_from_ref, reason = "each call returns a disjoint region")]
    pub fn alloc<T>(&self, value: T) -> Result<&mut T, ArenaFull> {
        // The arena never runs destructors, so types with Drop glue are rejected at build time.
        const { assert!(!mem::needs_drop::<T>(), "Arena::alloc requires a type without Drop glue") };

        let base = self.storage.as_ptr() as usize;
        let start = base
            .checked_add(self.head.get())
            .and_then(|addr| addr.checked_next_multiple_of(mem::align_of::<T>()))
            .ok_or(ArenaFull)?
            - base;
        let end = start.checked_add(mem::size_of::<T>()).ok_or(ArenaFull)?;
        if end > self.storage.len() {
            return Err(ArenaFull);
        }
        self.head.set(end);

        // SAFETY: `start <= end <= storage.len()`, so the offset stays inside the single
        // allocation behind `storage`. `UnsafeCell::raw_get` yields a pointer with write
        // permission, which a shared borrow of `self` would not otherwise give.
        let byte_ptr = unsafe { UnsafeCell::raw_get(self.storage.as_ptr().add(start)) };
        let ptr = byte_ptr.cast::<T>();

        // SAFETY: `ptr` is aligned (the start address was rounded up for `T`), the
        // `size_of::<T>()` bytes from it lie inside `storage`, and `head` moved past them,
        // so no other allocation overlaps this range.
        unsafe { ptr.write(value) };

        // SAFETY: the range was just initialised and is never handed out again, so this is
        // the only reference to it. Its lifetime is tied to `&self`, and `storage` lives as
        // long as `self`.
        Ok(unsafe { &mut *ptr })
    }
}
```

Three unsafe blocks, three SAFETY comments, and callers see only `alloc` returning a reference. The pointer arithmetic computes alignment from the actual address, because a `Box<[u8]>` guarantees only one-byte alignment. Production arenas use `bumpalo`, which adds chunk growth, drop-aware boxes and a long soak history; write your own only for a learning exercise or a constraint `bumpalo` cannot meet. A persistent arena over `mmap` (`memmap2`) follows the same layout with a header, an atomic bump offset and `repr(C)` value types.

Test it under Miri with the cases that matter:

```rust
#[test]
fn allocations_do_not_overlap() {
    let arena = Arena::with_capacity(64);
    let a = arena.alloc(7_u64).unwrap();
    let b = arena.alloc(3_u8).unwrap();
    *a += 1;
    *b += 1;
    assert_eq!((*a, *b), (8, 4));
}

#[test]
fn full_arena_reports_an_error() {
    assert_eq!(Arena::with_capacity(4).alloc(1_u64), Err(ArenaFull));
}
```

## Running Miri

```bash
# install once
rustup install nightly
rustup component add miri rust-src --toolchain nightly

# run on every change that touches unsafe
MIRIFLAGS="-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check" \
  cargo +nightly miri nextest run --all-features
```

What Miri catches that the borrow checker cannot:

- use after free and double free
- reads of uninitialised memory
- pointer-from-integer reconstruction that violates strict provenance
- misaligned accesses
- Stacked Borrows and Tree Borrows aliasing violations
- data races on non-atomic memory (including misuse of `UnsafeCell`)
- out-of-bounds pointer arithmetic
- memory leaks at program exit (reported by default; `-Zmiri-ignore-leaks` silences them)

The deeper escalation ladder, the full flag list and the fix-and-prove loop are in [../rust-ub/README.md](../rust-ub/README.md) and [../rust-ub/miri-sanitizers-loom.md](../rust-ub/miri-sanitizers-loom.md).

## When Miri cannot run a path

Miri rejects most system calls, real network I/O, process spawning, OS-specific FFI and hardware intrinsics outside its supported set. The strategy:

1. **Isolate.** Put the part Miri cannot interpret in its own module behind a feature such as `ffi-real`.
2. **Mock at the boundary.** Define a trait for the boundary and write a safe fake: a `Vec<u8>`-backed disk, a fake clock, an in-memory socket pair. Production code consumes the trait.
3. **Test the fake under Miri.** The fake executes the same logic minus the system call; unsafe pointer work inside it is checked.
4. **Test the real path with ordinary `cargo nextest run --features ffi-real`.** Miri cannot help there, and the unchecked surface has shrunk to the call boundary.
5. **Document.** A `# Safety` section lists the obligations the foreign interface imposes, and a `# Testing` section explains the fake and real split.

Sanitizers (ASAN, MSAN, TSAN) cover the real path; see [../rust-ub/miri-sanitizers-loom.md](../rust-ub/miri-sanitizers-loom.md).

## Loom for concurrency

When `unsafe` participates in a concurrent algorithm (a lock-free queue, hazard pointers, a custom `Arc`), Miri's single execution is not enough. Loom explores thread interleavings; pattern and flags are in [concurrency.md](concurrency.md). Run both tools on such code: loom for schedules, Miri for memory safety on each path.

## Edition 2024 and FFI declarations

```rust
unsafe extern "C" {
    // Declared safe because the C function has no preconditions.
    pub safe fn abs(x: i32) -> i32;
    // Stays unsafe: the pointer must be valid for `len` bytes.
    pub unsafe fn checksum(data: *const u8, len: usize) -> u32;
}

#[unsafe(no_mangle)]
pub extern "C" fn plugin_version() -> u32 {
    1
}
```

Edition 2024 requires the `unsafe` keyword on `extern` blocks and on `#[no_mangle]` and `#[export_name]`, and it lets an individual foreign item be marked `safe`. Never mark an item `safe` unless the foreign contract is airtight. Wrap each unsafe foreign function in a safe Rust function that validates inputs and checks outputs, and use `std::panic::catch_unwind` at every callback the foreign code can reach (see category 14 in [../rust-ub/ub-taxonomy.md](../rust-ub/ub-taxonomy.md)).

Raw pointer creation syntax: write `&raw const place` and `&raw mut place` (stable since 1.82) instead of `&place as *const _`, which creates an intermediate reference. This matters for packed fields and for fields of uninitialised structs.

## Rejected patterns

A review rejects these, and CI should fail on them:

- `unsafe { .. }` without a SAFETY comment in the five lines above.
- One block holding several unsafe operations. Split it, one comment each (`clippy::multiple_unsafe_ops_per_block`).
- A public `unsafe fn` without a `# Safety` rustdoc section.
- `std::mem::transmute` except for a documented same-layout conversion; prefer `from_ne_bytes`, `bytemuck::cast` or `zerocopy`, which check layout.
- `read_unaligned` and `write_unaligned` without a comment explaining why aligned access is impossible.
- `slice::from_raw_parts` and `from_raw_parts_mut` without proof that the source pointer's provenance covers the whole slice, that the length cannot overflow `isize::MAX` bytes, and that no aliasing mutable access exists.
- `Box::leak` used to dodge ownership, `MaybeUninit::assume_init` on partly initialised data, and `mem::forget` used to skip a destructor that guards an invariant.
- `unsafe impl Send` or `unsafe impl Sync` on a type holding raw pointers without a comment that names the exact synchronisation mechanism.
- Any justification that rests on "in practice this never happens".
- `static mut` holding shared state. Use `OnceLock`, atomics or a lock. Edition 2024 denies references to `static mut`.

## Review checklist for an unsafe change

1. Which invariant does each block rely on, and where is it established? The comment says so.
2. Could safe code, through the public API, break that invariant? If yes, the wrapper is unsound and the fix belongs in the wrapper.
3. Does the wrapper carry the right `Send` and `Sync` story, and the right lifetime marker via `PhantomData`?
4. Is there a Miri test that reaches every unsafe block, including the failure branches?
5. Are the Miri flags at Level 2 or higher in CI (see [../rust-ub/README.md](../rust-ub/README.md))?
6. Did the change add a dependency with unsafe code? `cargo geiger` counts it; check the crate's own Miri coverage.

## The one-line summary

> Wrap once. Prove once. Test under Miri. Let no `unsafe` escape the wrapper.
