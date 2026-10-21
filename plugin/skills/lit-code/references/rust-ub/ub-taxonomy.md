# Rust Undefined Behaviour Taxonomy

The classes of UB that the compiler, Miri and the language reference recognise. An audit moves faster when each finding lands in one class, because the class names the broken invariant, the detector and the usual fix. Every entry lists the root cause, the canonical triggers, Miri's detection status and the fix pattern.

Two reminders frame the whole list. UB is a property of the abstract machine, so a program can run correctly on every machine today and still be wrong; an optimiser release can exploit it tomorrow. And the aliasing and validity rules for `unsafe` code are still being finalised, so Miri encodes the conservative reading of them; code that passes today's strictest setting is the safest bet.

---

## 1. Aliasing violations (Stacked Borrows and Tree Borrows)

**Root cause:** two pointers access the same memory in a way the borrowing model forbids, including through raw pointers inside `unsafe`.

**Canonical triggers:**

- Creating a `&mut T` while another `&T` or `&mut T` to the same location is still used afterwards.
- Dereferencing a raw pointer derived from a reference after that reference was invalidated, for example after the `&mut` was reborrowed.
- Calling `slice::from_raw_parts_mut` on overlapping regions.
- Mutating through a pointer derived from `&T`, which includes casting `&T` to `*mut T` and writing.
- Interior mutation that bypasses `UnsafeCell`.

**Miri detection:** yes. Stacked Borrows is the default model; Tree Borrows (`-Zmiri-tree-borrows`) is the newer model that accepts more patterns. Run both:

```bash
cargo +nightly miri test
MIRIFLAGS="-Zmiri-tree-borrows" cargo +nightly miri test
```

Code that passes Tree Borrows and fails Stacked Borrows probably works today, yet depends on a pattern whose status is unsettled. Restructure it until both models agree.

**Fix pattern:** store anything mutated through shared references in `UnsafeCell` or a std wrapper on top of it (`Cell`, `RefCell`, `Mutex`, atomics). Derive each raw pointer from the live borrow right before use, and obtain mutable pointers from `UnsafeCell::get()` or `&raw mut`. Never cast `&T` to `*mut T` to write.

---

## 2. Data races

**Root cause:** two threads access the same non-atomic location, at least one access is a write, and no happens-before edge orders them.

**Canonical triggers:**

- `unsafe impl Send for T` on a type holding `*mut U` with no synchronisation.
- `unsafe impl Sync for T` on a type containing `Cell<U>` or `UnsafeCell<U>` with no lock.
- `ptr::write` from several threads into one allocation.
- A shared `&T` whose interior mutability has neither an atomic nor a lock behind it.

**Miri detection:** yes. The data-race detector is on by default and covers non-atomic accesses. Raise the preemption rate to explore more schedules:

```bash
MIRIFLAGS="-Zmiri-preemption-rate=0.1" cargo +nightly miri test
MIRIFLAGS="-Zmiri-many-seeds=0..16" cargo +nightly miri test   # many random schedules
```

**Complementary tools:** `loom` explores interleavings exhaustively for lock-free algorithms. ThreadSanitizer covers integration tests that Miri cannot run (real I/O, FFI).

**Fix pattern:** wrap shared state in `Mutex`, `RwLock` or an atomic type. Write `unsafe impl Sync` only when the SAFETY comment names the primitive that guards each mutable field.

---

## 3. Use after free and dangling pointers

**Root cause:** a pointer or reference outlives the allocation it points to.

**Canonical triggers:**

- Returning a reference to a local variable (the compiler stops this; raw pointers slip through).
- `Box::into_raw` followed by a `Box::from_raw` with the wrong lifetime assumptions.
- A `Vec` that reallocates while a pointer from `as_ptr()` or `as_mut_ptr()` is still held.
- A `Pin<Box<T>>` that is unpinned and moved after self-referential pointers were set up.

**Miri detection:** yes. Allocation tracking reports the exact operation that touches freed memory.

**Fix pattern:** let the borrow checker own references. For raw pointers, tie validity to an explicit lifetime with `PhantomData<&'a T>` in the wrapper, or allocate from an arena (`bumpalo`) so every pointer shares one lifetime.

---

## 4. Uninitialised memory

**Root cause:** reading a value from memory that was never written.

**Canonical triggers:**

- `MaybeUninit::assume_init()` before all bytes are written.
- `mem::uninitialized()` (deprecated, still compiles).
- `alloc::alloc(layout)`, which returns uninitialised memory; reading before writing is UB.
- Padding bytes in structs read through `transmute` or raw casts.
- `read_unaligned` over uninitialised memory.

**Miri detection:** yes. Miri tracks initialisation per byte and catches partly initialised structs, padding reads and premature `assume_init`.

**Fix pattern:** use `MaybeUninit::zeroed()` where zero is a valid value of the type. Write every field before `assume_init()`, preferably with `MaybeUninit::write` or `ptr::addr_of_mut!` field by field. Never `transmute` a struct that contains padding unless the padding was zeroed. For arrays, `std::array::from_fn` initialises without `unsafe`:

```rust
let squares: [u32; 8] = std::array::from_fn(|i| (i as u32) * (i as u32));
```

---

## 5. Invalid values (validity invariants)

**Root cause:** producing a value that violates the validity invariant of its type.

**Canonical triggers:**

- A `bool` holding a byte other than 0 or 1.
- A `char` outside the Unicode scalar range.
- An enum discriminant that matches no variant.
- A `NonZeroU32` holding 0.
- A reference that is null or dangling.
- A `str` that is not UTF-8.
- A null function pointer.

**Miri detection:** yes. Validity checks are on by default, and `-Zmiri-strict-provenance` tightens pointer-related validity:

```bash
MIRIFLAGS="-Zmiri-strict-provenance" cargo +nightly miri test
```

**Fix pattern:** validate before converting. Use `TryFrom` at boundaries, `char::from_u32`, `NonZeroU32::new`, `str::from_utf8`. Convert integers to enums through a checked function; `transmute` to an enum type is a defect waiting for a new discriminant.

---

## 6. Misaligned pointer access

**Root cause:** dereferencing a pointer that is not aligned for the type.

**Canonical triggers:**

- Casting `*const u8` to `*const u64` and dereferencing.
- References to fields of a `#[repr(packed)]` struct (the compiler rejects direct references; raw pointers bypass the check).
- Parsing network buffers at arbitrary offsets.

**Miri detection:** yes, with an immediate error on a misaligned read or write. `-Zmiri-symbolic-alignment-check` also flags accesses that happen to be aligned on this run but are not guaranteed to be:

```bash
MIRIFLAGS="-Zmiri-symbolic-alignment-check" cargo +nightly miri test
```

**Fix pattern:** use `read_unaligned` and `write_unaligned` for packed data, copy packed fields by value, or parse with `zerocopy` and `bytemuck`, which check alignment (see [../rust/zero-cost-safety.md](../rust/zero-cost-safety.md)). Decode integers with `u32::from_le_bytes(chunk.try_into()?)`.

---

## 7. Violating `Pin` invariants

**Root cause:** moving a value that was pinned, whose address something else relies on (self-referential types, intrusive lists).

**Canonical triggers:**

- `mem::swap` on a pinned value after an unsafe deref.
- `impl Unpin` for a type that holds self-referential pointers.
- `Pin::new_unchecked` on an allocation that can still move.

**Miri detection:** partial. Miri reports the follow-on aliasing or use-after-free when the self-referential pointer is dereferenced. A broken `Pin` contract whose pointer is never used passes unnoticed.

**Fix pattern:** never implement `Unpin` for self-referential types. Project pins with `pin-project` or `pin-project-lite`, and review each `Pin::new_unchecked` call individually. Pin on the heap with `Box::pin` or on the stack with `std::pin::pin!`.

---

## 8. FFI boundary UB

**Root cause:** the Rust side's assumptions disagree with the foreign code's behaviour.

**Canonical triggers:**

- A C function returning uninitialised memory into a Rust `&T`.
- A wrong `#[repr(C)]` layout (padding differs by platform).
- Passing a Rust enum to C without `#[repr(C)]` or `#[repr(i32)]`.
- A null pointer arriving where Rust wraps it as `&T`.
- C code writing through a pointer Rust treats as immutable.
- Declaring an FFI function with the wrong signature or calling convention.
- `longjmp` or `setjmp` across Rust frames.

**Miri detection:** limited. Miri cannot execute foreign code. It does catch UB in the Rust-side handling of values that came from a stubbed call.

**Complementary tools:** AddressSanitizer and MemorySanitizer observe real foreign memory behaviour; Valgrind is the fallback on Linux. `cbindgen` in CI keeps header and Rust layout in agreement.

**Fix pattern:** validate every FFI return at the boundary. Use `Option<NonNull<T>>` for nullable pointers, `CStr` and `CString` for strings, and wrap each foreign call in a safe Rust function that checks preconditions and postconditions. Edition 2024 requires `unsafe extern` blocks, which keeps the obligation visible.

---

## 9. Incorrect `Send` and `Sync` implementations

**Root cause:** a manual `Send` or `Sync` impl on a type that does not honour the contract.

**Canonical triggers:**

- `unsafe impl Send for Wrapper(*mut T)` when `T` is not `Send`.
- `unsafe impl Sync for Wrapper(UnsafeCell<T>)` with no lock, atomic or equivalent.
- A type holding `Rc<T>` with a manual `Send` impl (`Rc` is deliberately `!Send`).

**Miri detection:** yes, through the resulting race when a test exercises the type from two threads.

**Fix pattern:** implement `Send` or `Sync` manually only with a SAFETY proof that names the synchronisation mechanism. When in doubt, opt out with `PhantomData<*const ()>` and let the compiler refuse cross-thread use.

---

## 10. Out-of-bounds memory access

**Root cause:** pointer arithmetic or indexing leaves the allocation.

**Canonical triggers:**

- `ptr.offset(n)` or `ptr.add(n)` beyond the allocation (even without a dereference).
- `slice::from_raw_parts(ptr, len)` with too large a `len`, or a byte length above `isize::MAX`.
- Off-by-one errors in hand-managed buffers.
- Integer overflow in a size calculation that yields an undersized allocation.

**Miri detection:** yes, with allocation-precise bounds.

**Fix pattern:** checked arithmetic for sizes (`checked_add`, `checked_mul`), `get()` and iterators in place of pointer maths, `slice::from_raw_parts` only with validated lengths. `wrapping_add` on pointers is defined even when out of bounds, as long as the result is not dereferenced.

---

## 11. Provenance violations

**Root cause:** using a pointer whose provenance does not authorise access to the target, even when the address is numerically right.

**Canonical triggers:**

- Casting an integer to a pointer and dereferencing it.
- Round-tripping a pointer through `usize` (`ptr as usize as *const T`) in code that never exposes the provenance.
- Calling `with_exposed_provenance` with no matching `expose_provenance`.

**Miri detection:** yes, in strict mode:

```bash
MIRIFLAGS="-Zmiri-strict-provenance" cargo +nightly miri test
```

**Fix pattern:** keep pointers as pointers and change addresses with `map_addr`, `with_addr` and `wrapping_add`. A legitimate integer round trip uses `expose_provenance()` and `with_exposed_provenance()` (stable since 1.84). On older toolchains the `sptr` crate offers the same operations.

---

## 12. Double free and invalid free

**Root cause:** releasing one allocation twice, or releasing memory the allocator did not issue.

**Canonical triggers:**

- `Box::from_raw` called twice for one pointer.
- A manual `dealloc` on memory already freed, or with the wrong `Layout`.
- A `ManuallyDrop` field dropped explicitly while the outer type drops it again.

**Miri detection:** yes, with an immediate error.

**Fix pattern:** single ownership through RAII. Use `ManuallyDrop` sparingly and document who drops. Never copy a raw pointer and call `Box::from_raw` on both copies.

---

## 13. Library and unsafe contract violations

**Root cause:** breaking the documented safety condition of an API that relies on it for soundness.

**Canonical triggers:**

- `Vec::set_len(n)` over a range whose first `n` elements still hold uninitialised memory.
- `String::from_utf8_unchecked` on invalid UTF-8.
- `get_unchecked` with an index out of range.
- `unreachable_unchecked` reached at run time.
- A `HashMap` key mutated after insertion, or a `BTreeMap` key with a broken `Ord`. These are logic errors with unspecified results rather than UB, yet they corrupt data structures and expose bugs that only surface far away.

**Miri detection:** depends. Miri catches the downstream UB (reading uninitialised bytes from a `Vec` with an inflated length). A contract violation that causes no memory-level effect goes unseen.

**Fix pattern:** read the `# Safety` section of every `unsafe fn` you call and restate its condition in your SAFETY comment. Prefer the safe API and accept its cost until a profile shows otherwise. Fuzzing and property tests (see [../rust/proptest-insta.md](../rust/proptest-insta.md)) probe contracts the type system cannot.

---

## 14. Unwinding across `extern "C"` boundaries

**Root cause:** a Rust panic or a foreign exception crosses a frame that uses the wrong calling convention.

**Canonical triggers:**

- A `panic!` or `unwrap()` inside an `extern "C"` callback that C code invoked. Since Rust 1.81 such a panic aborts the process instead of unwinding, which is defined behaviour and still a crash.
- A C++ exception or `longjmp` passing through Rust frames declared `extern "C"`; that remains UB.

**Miri detection:** partial. Miri does not model foreign unwinding; it reports the immediate defect when a panic reaches the boundary.

**Fix pattern:** wrap every FFI entry point in `std::panic::catch_unwind` and convert the outcome into an error code. Declare callbacks `extern "C-unwind"` (stable since 1.71) when propagation across the boundary is intended and the foreign side supports it. Prefer error codes that the foreign caller handles.

---

## Summary table

| # | Category | Miri detects | Complementary tools |
|---|---|---|---|
| 1 | Aliasing | Yes | none needed |
| 2 | Data races | Yes | loom, ThreadSanitizer |
| 3 | Use after free, dangling | Yes | AddressSanitizer |
| 4 | Uninitialised memory | Yes | MemorySanitizer |
| 5 | Invalid values | Yes | none needed |
| 6 | Misaligned access | Yes | `cargo careful`, debug assertions |
| 7 | Pin violations | Partial | manual review |
| 8 | FFI boundary UB | Limited | ASAN, MSAN, Valgrind |
| 9 | Wrong Send and Sync | Yes, through a race | loom |
| 10 | Out of bounds | Yes | AddressSanitizer |
| 11 | Provenance | Yes, strict mode | none needed |
| 12 | Double free | Yes | AddressSanitizer |
| 13 | Contract violations | Partial | proptest, fuzzing |
| 14 | Unwinding across FFI | Partial | `catch_unwind` review |

## Miri coverage assessment

Miri covers categories 1 to 6 and 9 to 12 with high confidence on the paths the tests execute. Categories 7, 8, 13 and 14 need supplementary tools or a manual audit. Miri is the strongest single tool here: run it on every change that touches `unsafe`, and on the whole suite on a schedule. State in the report which unsafe blocks no test executed, since Miri says nothing about code that never ran.
