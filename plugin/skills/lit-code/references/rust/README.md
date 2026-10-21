# Rust Entry Point

Production Rust in 2026. Allocation is visible, invariants are proven by the compiler, costs are explicit and `unsafe` stays out unless a proof ships with it. Load this file first for any `.rs` file or `Cargo.toml`; it holds the hard rules, the default crate set, the review checklist and the index of the deeper references.

## Identity

Write Rust the way a systems programmer who prizes explicitness would design it, and let the compiler enforce it. Every allocation can be pointed at. Every cost shows in a signature. Every invariant lives in a type. Every cleanup runs deterministically. The borrow checker, lifetimes, trait bounds and Miri then guarantee what other languages leave to discipline.

Five pillars apply to every file.

| Pillar | Default behaviour | Detail |
|---|---|---|
| Explicit allocation | Arena for hot paths, `&[T]`, `&str` and `Cow` in signatures, `try_*` when allocation can fail | [zero-cost-safety.md](zero-cost-safety.md) section 1 |
| Compile-time proof | `const fn` wherever eligible, `const { assert!(..) }` guards, const generics for sized buffers | [zero-cost-safety.md](zero-cost-safety.md) section 2 |
| Zero hidden cost | Slice APIs where the caller owns memory, no stray `.clone()` or `.to_string()`, `Cow` to defer allocation | [zero-cost-safety.md](zero-cost-safety.md) section 3 |
| Type-encoded invariants | Newtypes for each semantic unit, type-state for state machines, branded identifiers | [type-state.md](type-state.md) |
| Deterministic cleanup | `Drop` for RAII, `scopeguard` for error-path rollback, defuse on success | [zero-cost-safety.md](zero-cost-safety.md) section 5 |

Two language features protect a coding agent more than any others:

1. **Bounded polymorphism.** Traits give machine-checked, composable constraints.
2. **Newtype as coordinate space.** `Point<Screen>` and `Point<World>` are distinct types, so one cannot stand in for the other. The `euclid` crate popularised the shape; apply it to money, durations, identifiers, byte and char offsets, and paths rooted at different bases (see [type-state.md](type-state.md)).

## Hard rules for every `.rs` file

### 1. Propagate errors; keep `unwrap()` and `expect()` out of non-test code

```rust
// Panics on a missing key
let val = map.get("key").unwrap();

// Propagates with context
use anyhow::Context as _;
let val = map.get("key").context("missing 'key' in config")?;
```

Libraries expose typed errors with [thiserror](https://docs.rs/thiserror); binaries use [anyhow](https://docs.rs/anyhow) or [color-eyre](https://docs.rs/color-eyre). The full stack is in [libraries.md](libraries.md). When a value is provably present, write the proof in a comment and mark the line `// SAFE-UNWRAP: <reason>` or `// SAFE-EXPECT: <reason>` so the audit script accepts it.

### 2. Every `unsafe` block ships with a Miri run

When `unsafe` cannot be avoided, run Miri on the code path before the change is called done. Open [../rust-ub/README.md](../rust-ub/README.md) and the other files under [../rust-ub/](../rust-ub/) for the UB taxonomy, the four Miri strictness levels and the fix-and-prove loop. Each block carries the three parts from [unsafe-discipline.md](unsafe-discipline.md): a safe wrapper, a `// SAFETY:` comment and a Miri test.

```bash
cargo +nightly miri nextest run
```

### 3. Make allocation visible; use an arena on hot paths

Scattered `Box::new()` and `Vec::new()` calls inside hot loops hide the cost. An arena makes the allocation scope explicit and frees it in one step. Recipes: [zero-cost-safety.md](zero-cost-safety.md) section 1.

```rust
use bumpalo::Bump;

fn parse_frame<'a>(arena: &'a Bump, raw: &[u8]) -> Frame<'a> {
    let header = arena.alloc(parse_header(raw));
    let payload = arena.alloc_slice_copy(&raw[HEADER_LEN..]);
    Frame { header, payload }
}
// The caller owns the arena and decides when the memory dies.
```

For a simple CLI or a one-shot allocation, `Vec` and `String` are fine. Function signatures still prefer borrows:

```rust
// Forces the caller to allocate
fn process(input: String) -> String { /* ... */ }

// The caller chooses the allocation strategy
fn process(input: &str) -> Cow<'_, str> { /* ... */ }

// Hot path: no allocation, caller supplies the buffer
fn process(input: &[u8], output: &mut [u8]) -> usize { /* ... */ }
```

### 4. Compute at compile time what can be computed there

A function that can be `const fn` is a `const fn`. Recipes: [zero-cost-safety.md](zero-cost-safety.md) section 2.

```rust
// Lookup table built during compilation
const CRC_TABLE: [u32; 256] = {
    let mut table = [0u32; 256];
    let mut i = 0;
    while i < 256 {
        let mut crc = i as u32;
        let mut j = 0;
        while j < 8 {
            crc = if crc & 1 != 0 { (crc >> 1) ^ 0xEDB8_8320 } else { crc >> 1 };
            j += 1;
        }
        table[i] = crc;
        i += 1;
    }
    table
};

// Layout checks fail the build instead of the runtime
const { assert!(std::mem::size_of::<Header>() == 12, "Header must be 12 bytes") };
```

Const generics size stack buffers:

```rust
struct RingBuffer<T, const N: usize> {
    data: [MaybeUninit<T>; N],
    head: usize,
    len: usize,
}
```

### 5. Scope guards give deterministic cleanup on every path

`scopeguard::guard` plays the role of an error-path defer. Recipes: [zero-cost-safety.md](zero-cost-safety.md) section 5.

```rust
use scopeguard::{guard, ScopeGuard};

fn deploy(artifact: &Path) -> Result<(), DeployError> {
    let backup = snapshot_current()?;
    // Runs the closure when the scope exits early
    let rollback = guard(backup, |b| {
        let _ = restore(&b);
    });

    upload(artifact)?;
    health_check()?;

    // Success: disarm the guard
    ScopeGuard::into_inner(rollback);
    Ok(())
}
```

### 6. Parse binary formats with `zerocopy`

Hand-written `transmute` and pointer casts are replaced by derive-checked reinterpretation. Recipes: [zero-cost-safety.md](zero-cost-safety.md) section 4.

```rust
use zerocopy::{FromBytes, Immutable, IntoBytes, KnownLayout};

#[derive(FromBytes, IntoBytes, KnownLayout, Immutable)]
#[repr(C)]
struct PacketHeader {
    magic: [u8; 4],
    version: u8,
    flags: u8,
    length: [u8; 2], // byte array: decode with u16::from_le_bytes
}
```

### 7. Match exhaustively on enums you own

```rust
// A wildcard hides new variants
match status {
    Status::Ok => handle_ok(),
    _ => handle_error(),
}

// The compiler flags every match when a variant appears
match status {
    Status::Ok => handle_ok(),
    Status::NotFound => handle_not_found(),
    Status::Timeout => handle_timeout(),
}
```

For `#[non_exhaustive]` enums from other crates the wildcard arm is required; log a `tracing::warn!` inside it so a new upstream variant shows up in the logs.

### 8. Type-state replaces runtime state checks

A method guarded by `if self.state == State::Validated` becomes a method that only exists on the validated type. Patterns: [type-state.md](type-state.md).

```rust
use std::marker::PhantomData;

struct Order<S> { data: OrderData, _state: PhantomData<S> }
struct Draft;
struct Validated;
struct Paid;

impl Order<Draft> {
    fn validate(self) -> Result<Order<Validated>, ValidationError> { /* ... */ }
}
impl Order<Validated> {
    fn pay(self, payment: Payment) -> Result<Order<Paid>, PaymentError> { /* ... */ }
}
// Order<Draft> has no pay() method; the compiler enforces the workflow.
```

## Default crates

The decision tree with rationale and snippets lives in [libraries.md](libraries.md).

| Category | Crate | Notes |
|---|---|---|
| Async runtime | `tokio` | Ecosystem standard; see [async-tokio.md](async-tokio.md) |
| HTTP server | `axum` with `tower` | Typed extractors, tower middleware; see [axum-stack.md](axum-stack.md) |
| CLI | `clap` (derive) with `color-eyre` | See [clap-stack.md](clap-stack.md) |
| Serialization | `serde`, `serde_json` | Every boundary type |
| Error (library) | `thiserror` | Derive `Error` |
| Error (binary) | `anyhow` or `color-eyre` | Context-rich |
| Database | `sqlx` | Compile-time checked queries |
| Arena | `bumpalo`, `typed-arena` | Section 1 of [zero-cost-safety.md](zero-cost-safety.md) |
| Zero-copy parsing | `zerocopy` | Section 4 of [zero-cost-safety.md](zero-cost-safety.md) |
| Scope guard | `scopeguard` | Section 5 of [zero-cost-safety.md](zero-cost-safety.md) |
| Stack collections | `smallvec`, `arrayvec`, `tinyvec` | Section 3 of [zero-cost-safety.md](zero-cost-safety.md) |
| Bitfields | `bitfield`, `modular-bitfield` | Section 4 of [zero-cost-safety.md](zero-cost-safety.md) |
| Testing | `proptest`, `insta` | See [proptest-insta.md](proptest-insta.md) |
| Concurrency | `tokio::sync`, `parking_lot` | See [concurrency.md](concurrency.md) |

## Cargo configuration

New projects take the lint set, toolchain file, formatter settings, `deny.toml` and CI workflow from [cargo-strict.md](cargo-strict.md). The gate that every change passes:

```bash
cargo fmt --all -- --check && \
cargo clippy --all-targets --all-features -- -D warnings && \
cargo nextest run && \
cargo +nightly miri nextest run   # when unsafe is involved
```

## No-excuse audit

`scripts/rust/check-no-excuse-rules.py` scans `.rs` files for the patterns that text matching can catch. Everything semantic stays with clippy, Miri and nextest. Run it after each editing session: `python3 scripts/rust/check-no-excuse-rules.py src/` (the script header lists its other launch forms). Exit code 1 means findings. Under headless `agy -p`, a refused `run_command` ends the run, so read the script header first and ask for the permission once.

| Rule id | Finds | Opt-out comment on the previous line |
|---|---|---|
| `unwrap` | `.unwrap()` outside tests | `// SAFE-UNWRAP: <reason>` |
| `expect` | `.expect(` outside tests | `// SAFE-EXPECT: <reason>` |
| `placeholder-macro` | `todo!`, `unimplemented!`, `unreachable!`, `unreachable_unchecked!` in committed code | none; finish the code |
| `box-dyn-error` | `Box<dyn Error>` in non-test code | none; use `thiserror` or `anyhow` |
| `lib-panic` | `panic!()` in library code | none; return an error |
| `unsafe-no-safety` | `unsafe {` without `// SAFETY:` in the five lines above | add the comment |
| `unjustified-clippy-allow` | `#[allow(clippy::..)]` without a reason | `// CLIPPY-ALLOW: <reason>` |
| `narrowing-as-cast` | a wide integer `as` a narrower one | use `try_from` or justify |

Paths named `tests/`, `benches/`, `examples/`, `build.rs`, files ending `_test.rs` and `#[cfg(test)]` regions are exempt from the unwrap, expect, placeholder, box-dyn-error and lib-panic rules.

## Review checklist (run after writing Rust code)

Each row names the reference that holds the fix.

| # | Check | Fix reference |
|---|---|---|
| 1 | Signatures prefer `&[T]`, `&str`, `Cow` to owned types | [zero-cost-safety.md](zero-cost-safety.md) section 3 |
| 2 | Hot-path allocations use an arena instead of scattered `Box` and `Vec` calls | [zero-cost-safety.md](zero-cost-safety.md) section 1 |
| 3 | Const-eligible functions are `const fn` | [zero-cost-safety.md](zero-cost-safety.md) section 2 |
| 4 | Lookup tables and constants are computed at compile time | [zero-cost-safety.md](zero-cost-safety.md) section 2 |
| 5 | Binary parsing uses `zerocopy` | [zero-cost-safety.md](zero-cost-safety.md) section 4 |
| 6 | Cleanup uses `scopeguard` or `Drop`, never a manual `if err` ladder | [zero-cost-safety.md](zero-cost-safety.md) section 5 |
| 7 | Distinct semantic units are newtypes | [type-state.md](type-state.md) |
| 8 | State machines use type-state | [type-state.md](type-state.md) |
| 9 | No `unwrap()` or `expect()` outside `#[cfg(test)]` | [libraries.md](libraries.md) |
| 10 | Every `unsafe` has a SAFETY comment and a Miri test | [unsafe-discipline.md](unsafe-discipline.md), [../rust-ub/README.md](../rust-ub/README.md) |
| 11 | Matches on owned enums are exhaustive | rule 7 above |
| 12 | `clippy::pedantic` passes with zero warnings | [cargo-strict.md](cargo-strict.md) |
| 13 | Functions with a nontrivial domain have property tests | [proptest-insta.md](proptest-insta.md) |
| 14 | Concurrency starts with channels, then locks, then atomics | [concurrency.md](concurrency.md) |
| 15 | Async fan-out uses `JoinSet` | [async-tokio.md](async-tokio.md) |

## Default dependencies: the zero-cost safety set

Every new project starts with these next to the standard dependencies from [cargo-strict.md](cargo-strict.md):

```toml
# Zero-cost safety set
bumpalo = { version = "3", features = ["collections"] }
scopeguard = "1"
smallvec = { version = "1", features = ["union", "const_generics"] }
zerocopy = { version = "0.8", features = ["derive"] }

# Add when needed
# typed-arena = "2"            # homogeneous arena
# arrayvec = "0.7"             # fixed-capacity stack vector
# tinyvec = { version = "1", features = ["alloc"] }
# bitfield = "0.17"            # bit-packed flags
# modular-bitfield = "0.11"    # richer bitfield API
# bytemuck = { version = "1", features = ["derive"] }
```

Confirm the current release of each with `cargo search <crate> --limit 1` or `cargo add <crate>` before pinning; the lockfile freezes whatever resolves.

## Reference index

| File | Open it for |
|---|---|
| [zero-cost-safety.md](zero-cost-safety.md) | Arenas, allocators, `const fn`, zero-allocation APIs, repr and bitfields, scope guards |
| [type-state.md](type-state.md) | Newtypes, type-state machines, branded identifiers, phantom types, sealed traits |
| [unsafe-discipline.md](unsafe-discipline.md) | Any `unsafe` block: wrappers, SAFETY comments, Miri proof |
| [libraries.md](libraries.md) | Crate selection, decision tree, dependency audit |
| [cargo-strict.md](cargo-strict.md) | Project bootstrap, lint config, CI gate |
| [async-tokio.md](async-tokio.md) | Runtime, spawning, cancellation, `JoinSet`, `select!` |
| [axum-stack.md](axum-stack.md) | HTTP services with axum, sqlx, tower and tracing |
| [clap-stack.md](clap-stack.md) | CLI tools with clap, color-eyre and indicatif |
| [concurrency.md](concurrency.md) | Locks, atomics, channels, loom |
| [proptest-insta.md](proptest-insta.md) | Property tests, snapshot tests, round-trip invariants |
| [one-liners.md](one-liners.md) | `rust-script` one-liners and disposable scripts |
| [../rust-ub/README.md](../rust-ub/README.md) | UB hunting: Miri escalation, sanitizers, fuzzing |
| [../rust-ub/ub-taxonomy.md](../rust-ub/ub-taxonomy.md) | The 14-category UB taxonomy with detection status |
| [../rust-ub/miri-sanitizers-loom.md](../rust-ub/miri-sanitizers-loom.md) | Miri flags, ASAN, TSAN, MSAN, loom, cargo-fuzz |

## The shape of every function

```rust
/// One line saying what the function does.
///
/// # Errors
/// Returns `FrobError::Invalid` when the input does not parse.
fn frobnicate<'a>(
    arena: &'a Bump,   // explicit allocator when an arena is in play
    input: &[u8],      // borrowed input
    output: &mut [u8], // caller-provided buffer
) -> Result<&'a Frob, FrobError> {
    // ...
}
```

The caller sees each cost: allocation scope is the arena's lifetime, input is borrowed, output memory belongs to the caller, the error is typed. Add `const` to the signature when the body qualifies.

## Verification order for a Rust change

1. `cargo fmt --all -- --check`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo nextest run` (or `cargo test` where nextest is absent)
4. `cargo +nightly miri nextest run` for any change that touches `unsafe`
5. The audit script above
6. One run of the real binary or service entry point

Record each command and its exit code in the evidence note. A change confined to comments still runs steps 1 and 2.

## Existing code

Code that predates these rules keeps its shape in the same change. Write new lines in the strict style, list the old violations in the report, and schedule a conversion as its own change (see the `refactor` skill).

## Activation

This reference applies whenever the work edits or creates a `.rs` file or `Cargo.toml`. Throwaway scripts get the same lints through `rust-script` (see [one-liners.md](one-liners.md)). Production hygiene stays cheap when the toolchain enforces it.
