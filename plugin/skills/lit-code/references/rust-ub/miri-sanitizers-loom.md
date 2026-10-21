# Miri, Sanitizers, Loom and Fuzzing: The UB Detection Toolkit

Miri comes first. Everything else covers the gaps Miri leaves: foreign code, real I/O, thread schedules and hostile input. This file holds the flags, the commands, the CI recipes and the tool-selection tree.

---

## Miri

### What it is

Miri is an interpreter for Rust's MIR (mid-level intermediate representation). It runs a test suite inside a virtual machine that tracks every byte for validity, provenance, alignment, initialisation and aliasing. Execution is deterministic for a given seed, and it finds UB that no run on real hardware ever shows.

### Why it earns first place

- It detects 12 of the 14 categories in [ub-taxonomy.md](ub-taxonomy.md) (fully or partly).
- It reports aliasing violations that compile and run correctly on every platform today, and that future optimisations may exploit.
- It finds data races under a configurable scheduling model.
- It finds provenance defects that hardware can never show.
- A Miri error marks a violation of the model it implements. For pointer aliasing, Stacked Borrows is deliberately conservative, so a report there means "outside the rules we can promise" and deserves a fix even when Tree Borrows accepts the code.
- Silence only covers the paths the tests execute.

### Installation

```bash
rustup install nightly
rustup component add miri rust-src --toolchain nightly
```

Verify:

```bash
cargo +nightly miri --version
```

The first run executes `cargo miri setup`, which builds a Miri-flavoured standard library; allow a minute.

### Running Miri

```bash
cargo +nightly miri test                    # default checks, Stacked Borrows
cargo +nightly miri nextest run             # with nextest
cargo +nightly miri test -- test_name       # one test
cargo +nightly miri test --doc              # doctests (nextest skips them)
cargo +nightly miri run                     # a binary
cargo +nightly miri test --workspace --all-features
```

Miri is 10 to 100 times slower than native execution. Shrink loop counts and input sizes when `cfg!(miri)` is true, and run it in CI on a schedule if the full suite takes too long per pull request.

### `MIRIFLAGS`

Flags travel in the `MIRIFLAGS` environment variable. Use the strict set for audits.

#### Aliasing model

```bash
# Default: Stacked Borrows (strict)
cargo +nightly miri test

# Tree Borrows (newer, accepts more patterns); use as the second pass
MIRIFLAGS="-Zmiri-tree-borrows" cargo +nightly miri test
```

Protocol: run Stacked Borrows first and fix what it reports, then confirm with Tree Borrows. Code accepted by both models is the most robust. A disagreement means the pattern sits in contested territory.

#### Strict provenance

```bash
MIRIFLAGS="-Zmiri-strict-provenance" cargo +nightly miri test
```

Rejects `ptr as usize as *const T` round trips where provenance is lost. Keep it on for every audit. The opposite switch, `-Zmiri-permissive-provenance`, allows integer-to-pointer casts and suits code that has not been migrated yet.

#### Symbolic alignment checks

```bash
MIRIFLAGS="-Zmiri-symbolic-alignment-check" cargo +nightly miri test
```

Flags accesses that happen to be aligned on this run but have no alignment guarantee from the type system or the allocation.

#### Scheduling and races

```bash
# Higher preemption rate stresses race conditions (default 0.01)
MIRIFLAGS="-Zmiri-preemption-rate=0.5" cargo +nightly miri test

# Sequential scheduling: deterministic, finds fewer races
MIRIFLAGS="-Zmiri-preemption-rate=0" cargo +nightly miri test

# Run each test under many different seeds
MIRIFLAGS="-Zmiri-many-seeds=0..32" cargo +nightly miri test

# Reproduce a failing seed
MIRIFLAGS="-Zmiri-seed=17" cargo +nightly miri test
```

`-Zmiri-many-seeds` is the cheapest way to widen thread-schedule coverage before reaching for loom.

#### Debugging aids

```bash
-Zmiri-backtrace=full           # full backtraces in reports
-Zmiri-track-alloc-id=<ID>      # report events for one allocation (the ID comes from an error message)
-Zmiri-track-pointer-tag=<TAG>  # follow one Stacked Borrows tag
-Zmiri-ignore-leaks             # do not fail on memory leaks at exit
```

Memory leaks at exit are reported as errors by default.

#### The full-paranoia sweep (audit standard)

```bash
MIRIFLAGS="-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-preemption-rate=0.1 -Zmiri-backtrace=full -Zmiri-disable-isolation" cargo +nightly miri test
```

Second pass with Tree Borrows:

```bash
MIRIFLAGS="-Zmiri-tree-borrows -Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-preemption-rate=0.1 -Zmiri-backtrace=full -Zmiri-disable-isolation" cargo +nightly miri test
```

#### Isolation and I/O

By default Miri isolates the program: no real clock, no environment passthrough, no filesystem or network. For tests that read files or the clock:

```bash
MIRIFLAGS="-Zmiri-disable-isolation" cargo +nightly miri test
```

Isolation is a feature. Prefer a `#[cfg(not(miri))]` path or a fake over disabling it broadly. Forward chosen variables with `-Zmiri-env-forward=NAME`.

Libraries that persist state also trip isolation. Proptest's failure persistence writes files, so tests under Miri set `failure_persistence: None` in `ProptestConfig` and reduce `cases`.

#### Other targets

```bash
# Big-endian layout assumptions
cargo +nightly miri test --target s390x-unknown-linux-gnu
# 32-bit layout assumptions
cargo +nightly miri test --target i686-unknown-linux-gnu
```

Cross-target runs execute without the target hardware and expose endianness and pointer-width bugs.

### Miri limits

| Cannot do | Workaround |
|---|---|
| Execute foreign (C) code | ASAN, MSAN, Valgrind |
| Run I/O-heavy tests under isolation | `-Zmiri-disable-isolation` or a `#[cfg(not(miri))]` path |
| Enumerate every thread interleaving | loom |
| Find performance regressions | criterion, divan, flamegraph |
| Execute inline assembly and many SIMD intrinsics | skip with `#[cfg(not(miri))]` |
| Model OS-specific behaviour | real hardware plus sanitizers |
| Observe paths the tests never run | write the test |

### Miri in CI

```yaml
miri:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@nightly
      with:
        components: miri, rust-src
    - uses: Swatinem/rust-cache@v2
    - name: Miri (Stacked Borrows, strict provenance)
      env:
        MIRIFLAGS: "-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-backtrace=full"
      run: cargo +nightly miri test
    - name: Miri (Tree Borrows)
      env:
        MIRIFLAGS: "-Zmiri-tree-borrows -Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-backtrace=full"
      run: cargo +nightly miri test
```

Pin a nightly date (`dtolnay/rust-toolchain@master` with `toolchain: nightly-2026-01-15`) when a new Miri release would otherwise break the pipeline without a code change, and bump it deliberately.

### Gating tests Miri cannot run

```rust
#[test]
#[cfg_attr(miri, ignore)] // FFI, I/O or inline assembly
fn requires_real_hardware() {
    // ...
}

#[test]
fn scaled_for_miri() {
    let rounds = if cfg!(miri) { 8 } else { 10_000 };
    for _ in 0..rounds {
        exercise();
    }
}

#[test]
fn with_a_miri_fallback() {
    #[cfg(miri)]
    {
        // Reduced variant without the foreign call
    }
    #[cfg(not(miri))]
    {
        // Full variant with the foreign call
    }
}
```

---

## Sanitizers: where Miri cannot reach

Sanitizers are compiler instrumentation passes. They run the real binary on real hardware with extra checks compiled in, which suits FFI, I/O-heavy code and integration tests. All of them need a nightly toolchain and `-Zbuild-std` so the standard library is instrumented too, and their availability depends on the target.

Rust has no UndefinedBehaviorSanitizer. The checks it provides come from debug assertions, `overflow-checks`, Miri, and `cargo careful` (see below).

### AddressSanitizer (ASAN)

Detects use after free, buffer overflows, stack-use-after-return, double free and leaks.

```bash
# Linux
RUSTFLAGS="-Zsanitizer=address" cargo +nightly test -Zbuild-std --target x86_64-unknown-linux-gnu

# macOS on Apple silicon
RUSTFLAGS="-Zsanitizer=address" cargo +nightly test -Zbuild-std --target aarch64-apple-darwin
```

Add `ASAN_OPTIONS=detect_stack_use_after_return=1` to catch stack escapes, and set `RUSTDOCFLAGS` the same way for doctests.

### LeakSanitizer

`RUSTFLAGS="-Zsanitizer=leak"` runs leak detection alone, with less overhead than ASAN. ASAN already includes it.

### ThreadSanitizer (TSAN)

Detects data races on non-atomic accesses across threads.

```bash
RUSTFLAGS="-Zsanitizer=thread" cargo +nightly test -Zbuild-std --target x86_64-unknown-linux-gnu
```

Prefer TSAN over Miri for integration tests with real threads, real I/O and FFI. For pure-Rust code, Miri's detector is stronger. TSAN reports races it observes in the executed schedule, so repeat runs under load.

### MemorySanitizer (MSAN)

Detects reads of uninitialised memory.

```bash
RUSTFLAGS="-Zsanitizer=memory -Zsanitizer-memory-track-origins" cargo +nightly test -Zbuild-std --target x86_64-unknown-linux-gnu
```

Use it for FFI code where C or C++ may hand uninitialised memory to Rust. MSAN works on a limited target set (Linux x86-64 in practice) and needs every dependency, including C libraries, built with instrumentation.

### `cargo careful`

```bash
cargo install cargo-careful
cargo +nightly careful test
```

Builds the standard library with extra debug assertions (alignment and null-pointer checks on unsafe std calls, for example) and runs the tests natively. It is cheaper than Miri, runs FFI-free code at full speed and catches a slice of the same bugs.

### Layout randomisation

```bash
RUSTFLAGS="-Zrandomize-layout" cargo +nightly test
```

Randomises the field order of `repr(Rust)` types and exposes code that silently depends on one layout.

### Sanitizer limits

- Nightly and `-Zbuild-std` are required; the build takes longer.
- Aliasing violations are Miri's domain.
- Runtime overhead is two to fifteen times.
- Linux has the best support, macOS handles ASAN and TSAN, Windows support is thin.
- Results reflect the executed path, as with Miri.

---

## Loom: exhaustive concurrency testing

Loom explores every thread interleaving of a bounded concurrent program under the C11 memory model. Use it for lock-free and wait-free primitives.

### When to use loom

- `unsafe` code using atomics with an ordering weaker than `SeqCst`.
- Custom lock implementations.
- Lock-free queues, stacks and other shared structures.
- Any code that chose `Relaxed`, `Acquire` or `Release`.

### When another tool fits better

- Code that only uses `Mutex` and `RwLock` from std or `parking_lot`. The locks are sound; the question is usage, which Miri and TSAN cover.
- Async code. Loom has no model of async runtimes; test those with `#[tokio::test]` and Miri.

### Setup

```toml
[target.'cfg(loom)'.dev-dependencies]
loom = "0.7"

[lints.rust]
unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }
```

### Test pattern

```rust
#[cfg(loom)]
mod loom_tests {
    use loom::sync::atomic::{AtomicUsize, Ordering};
    use loom::sync::Arc;
    use loom::thread;

    #[test]
    fn concurrent_increment_is_sound() {
        loom::model(|| {
            let counter = Arc::new(AtomicUsize::new(0));

            let handles: Vec<_> = (0..2)
                .map(|_| {
                    let counter = Arc::clone(&counter);
                    thread::spawn(move || {
                        counter.fetch_add(1, Ordering::SeqCst);
                    })
                })
                .collect();

            for handle in handles {
                handle.join().unwrap();
            }

            assert_eq!(counter.load(Ordering::SeqCst), 2);
        });
    }
}
```

For data guarded by hand-rolled synchronisation, use `loom::cell::UnsafeCell` in the code under test. Its `with` and `with_mut` accessors let loom flag unsynchronised conflicting access across threads, a check Miri performs only on the executed schedule.

### Conditional compilation for loom

```rust
#[cfg(loom)]
use loom::sync::atomic::{AtomicUsize, Ordering};
#[cfg(not(loom))]
use std::sync::atomic::{AtomicUsize, Ordering};
```

### Running loom tests

```bash
# Loom tests only
RUSTFLAGS="--cfg loom" cargo test --lib -- loom_tests

# Release mode: loom is slow
RUSTFLAGS="--cfg loom" cargo test --lib --release -- loom_tests

# Bound the search
LOOM_MAX_PREEMPTIONS=3 RUSTFLAGS="--cfg loom" cargo test --lib --release -- loom_tests
```

`LOOM_LOG=trace` prints the schedule leading to a failure, and `LOOM_CHECKPOINT_FILE` saves progress for long explorations. Keep models tiny: two or three threads with a handful of operations each.

### Loom and Miri together

They answer different questions:

- **Miri** checks one execution for UB: aliasing, validity, provenance.
- **Loom** checks all interleavings for correctness: ordering and atomicity.

Run both on lock-free code:

```bash
# 1. loom: interleaving correctness
RUSTFLAGS="--cfg loom" cargo test --lib --release -- loom_tests

# 2. Miri: UB on each executed path
cargo +nightly miri test -- concurrent_tests
```

---

## cargo-fuzz: coverage-guided hunting

Fuzzing generates inputs that maximise code coverage, then reports crashes, panics and sanitizer findings.

### Setup

```bash
cargo install cargo-fuzz
cargo +nightly fuzz init
```

### A fuzz target

```rust
// fuzz/fuzz_targets/parse_input.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // Any panic, abort or sanitizer report is a finding.
    let _ = my_crate::parse(data);
});
```

Structured inputs use the `arbitrary` crate:

```rust
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct Input {
    name: String,
    flags: u8,
}

fuzz_target!(|input: Input| {
    let _ = my_crate::handle(&input.name, input.flags);
});
```

### Running

```bash
cargo +nightly fuzz run parse_input                       # until interrupted
cargo +nightly fuzz run parse_input -- -max_total_time=300 # five minutes
cargo +nightly fuzz run parse_input -- -rss_limit_mb=4096
cargo +nightly fuzz tmin parse_input fuzz/artifacts/parse_input/crash-<hash>
cargo +nightly fuzz cmin parse_input                      # minimise the corpus
```

`cargo fuzz` builds with AddressSanitizer by default, so memory bugs in unsafe code surface as findings. Commit the minimised corpus when it is small, and keep crash artefacts out of version control until they become regression tests.

### Fuzz and Miri pipeline

When the fuzzer finds a crash:

1. Minimise it with `cargo fuzz tmin`.
2. Add the input as a named regression test.
3. Run that test under Miri to learn whether it is a panic (safe, fix the logic) or UB (fix first).

```bash
cargo +nightly miri test -- test_fuzz_regression_001
```

---

## Tool selection tree

```text
Start
 |
 |- Pure Rust with no FFI and no real I/O?
 |    yes -> Miri with the full-paranoia flags
 |           + loom if atomics or lock-free structures appear
 |           + proptest if the code parses or serialises
 |           + cargo-fuzz if the input is untrusted
 |    no  -> Does it involve FFI?
 |            yes -> ASAN and MSAN on the integration tests
 |                   + Miri on the Rust-side handling with the foreign call faked
 |                   + cbindgen in CI for layout agreement
 |            no  -> Heavy I/O?
 |                    yes -> TSAN for thread safety
 |                           + Miri with -Zmiri-disable-isolation where possible
 |                    no  -> Miri with the full-paranoia flags
 `- Default: Miri first; the other tools supplement it.
```

## The one rule

> When in doubt, run Miri. When Miri cannot run the code, write a variant it can run and test that under Miri, then test the real variant under sanitizers. Ship no `unsafe` code that Miri has not accepted.
