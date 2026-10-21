# Rust Undefined Behaviour Hunt

Use this reference to find, classify, prove and remove undefined behaviour (UB) in Rust code. **Miri is the primary instrument.** Sanitizers, loom and fuzzing cover the ground Miri cannot reach. Open it for a UB audit, a Miri sweep, an unsafe audit, a soundness question ("is this sound?"), a race hunt, or any Miri failure that needs classifying.

## Core rules

1. **Run Miri before reading the unsafe code.** A run gives facts; reading gives guesses. Run it again before proposing a fix and once more after applying it. Miri is the oracle.
2. **Classify before fixing.** Each finding is mapped to one of the 14 categories in [ub-taxonomy.md](ub-taxonomy.md). The category names the invariant that broke, which keeps the fix aimed at the cause.
3. **Prove the fix.** A fix is done when Miri passes at Level 3 (below) on the test that exposed it and on the whole suite. When Miri cannot run the code (FFI, I/O), the fix is done when the matching sanitizer passes.
4. **Hand off in beads.** Each resolved finding is a bead: category, root cause, fix, proof command. Beads go into the report and into regression tests.

## Taxonomy at a glance

The full entries, with triggers and fix patterns, are in [ub-taxonomy.md](ub-taxonomy.md).

| # | Category | Miri coverage |
|---|---|---|
| 1 | Aliasing violations (Stacked or Tree Borrows) | Yes |
| 2 | Data races | Yes |
| 3 | Use after free and dangling pointers | Yes |
| 4 | Uninitialised memory | Yes |
| 5 | Invalid values (validity invariants) | Yes |
| 6 | Misaligned pointer access | Yes |
| 7 | Pin invariant violations | Partial |
| 8 | FFI boundary UB | Limited |
| 9 | Wrong `Send` and `Sync` implementations | Yes, through the resulting race |
| 10 | Out-of-bounds access | Yes |
| 11 | Provenance violations | Yes, with strict provenance |
| 12 | Double free and invalid free | Yes |
| 13 | Library and unsafe contract violations | Partial |
| 14 | Unwinding across `extern "C"` | Partial |

## The hunt workflow

Under headless `agy -p`, a refused `run_command` ends the run, so request the permission for the first Miri command up front. Miri runs take minutes: start them with the asynchronous wait option, poll with `command_status`, and keep the full output in an evidence file.

### Phase 1: reconnaissance

Build the hit list before running anything heavy. Search commands (use `rg` through `run_command`, or the host's search tool):

```bash
# every unsafe site
rg -n --type rust '\bunsafe\b'

# manual Send and Sync implementations
rg -n --type rust 'unsafe\s+impl\s+(<[^>]*>\s*)?(Send|Sync)'

# casts, transmutes, raw pointer plumbing
rg -n --type rust 'transmute|from_raw|into_raw|as_ptr|as_mut_ptr|\.offset\(|\.add\(|\.sub\(|ptr::(read|write|copy)|MaybeUninit|assume_init'

# FFI
rg -n --type rust 'extern\s+"C'

# unsafe the lint set would reject
cargo clippy --all-targets -- -W clippy::undocumented_unsafe_blocks -W clippy::multiple_unsafe_ops_per_block
```

Record each hit as file, line, category guess and a risk label (high, medium, low). `#![forbid(unsafe_code)]` crates need no Miri pass for their own code; dependencies still can.

### Phase 2: Miri sweep

Install once: `rustup install nightly` and `rustup component add miri rust-src --toolchain nightly`. Run the levels in order; each level adds strictness.

**Level 1: default (Stacked Borrows):**

```bash
cargo +nightly miri test
```

**Level 2: strict provenance and symbolic alignment:**

```bash
MIRIFLAGS="-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-backtrace=full" cargo +nightly miri test
```

**Level 3: full paranoia (the audit standard):**

```bash
MIRIFLAGS="-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-preemption-rate=0.1 -Zmiri-backtrace=full -Zmiri-disable-isolation" cargo +nightly miri test
```

**Level 4: Tree Borrows as a second model:**

```bash
MIRIFLAGS="-Zmiri-tree-borrows -Zmiri-strict-provenance -Zmiri-symbolic-alignment-check -Zmiri-preemption-rate=0.1 -Zmiri-backtrace=full -Zmiri-disable-isolation" cargo +nightly miri test
```

Reading the results:

- Fails at Level 1: definite UB under the current rules. Fix it.
- Passes Level 1, fails Level 2: a provenance or alignment defect. Fix it.
- Passes Levels 1 to 3, fails Level 4: the two aliasing models disagree. The pattern is fragile, because the model authors still debate its status. Restructure the borrows until both models accept it.
- Passes all four: Miri-clean for the paths the tests reach. Continue to the supplementary scans.

Miri checks only executed paths. Coverage of the unsafe lines decides how much a clean run means, so read the test list against the hit list from Phase 1 and add tests for unreached blocks. Further tuning: seeds with `-Zmiri-many-seeds=0..16` explore different thread schedules, and a big-endian or 32-bit target (`cargo miri test --target s390x-unknown-linux-gnu`) exposes layout assumptions. Flag details are in [miri-sanitizers-loom.md](miri-sanitizers-loom.md).

### Phase 3: supplementary scans

For code Miri cannot fully cover:

```bash
# Concurrent code with custom atomics
RUSTFLAGS="--cfg loom" cargo test --lib --release -- loom_tests

# FFI-heavy code
RUSTFLAGS="-Zsanitizer=address" cargo +nightly test -Zbuild-std --target "$(rustc -vV | sed -n 's/^host: //p')"

# Parsers of untrusted input
cargo +nightly fuzz run <target> -- -max_total_time=300
```

### Phase 4: the fix-and-prove loop

For each finding:

1. **Classify** against the 14 categories.
2. **Write the SAFETY comment** describing what is wrong and what the fix must establish.
3. **Apply the smallest fix.** Repair the UB and leave unrelated code untouched; refactors belong to separate changes.
4. **Run Miri at Level 3** on the exact test that exposed the UB.
5. **Run Miri at Level 3** on the full suite for regressions.
6. **Record the bead:**

```text
BEAD: [category #] [short description]
FILE: [path:line]
ROOT CAUSE: [one sentence]
FIX: [one sentence]
PROOF: Miri Level [N] pass, [command used]
```

### Phase 5: hardening

After all beads close:

1. **Add Miri to CI** if absent (workflow in [miri-sanitizers-loom.md](miri-sanitizers-loom.md)).
2. **Add `#[cfg(miri)]` or plain regression tests** for each bead, so the original failure stays locked in.
3. **Review the SAFETY comment** on every remaining `unsafe` block; each must name its invariant.
4. **Repeat the full Level 3 sweep** and keep the output.

## Decision protocol for ordinary Rust work

When any Rust task puts `unsafe` into the change set (not only audits):

```text
Is there unsafe code in the change?
  yes -> run Miri Level 1 before moving on
         fails -> stop; classify; fix; prove; then continue
         passes -> run Miri Level 2
                    fails -> stop; classify; fix; prove; then continue
                    passes -> proceed with the original task
  no  -> proceed normally
```

Every `unsafe` block gets a Miri run before it ships.

## SAFETY comment standard

A SAFETY comment sits within five lines above each unsafe block. It does three things:

1. Names the UB category the block could trigger (from the taxonomy).
2. States the invariant that makes the block sound.
3. Names who or what guarantees that invariant: a caller contract, the type system, a runtime check.

```rust
// SAFETY: [category 4, uninitialised memory]
// Every one of the `len` elements was written by `ptr::write` in the loop above, and
// `len` was checked against the allocation size at the top of this function, so
// `assume_init` reads only initialised bytes.
unsafe { buf.assume_init() }
```

Comments that fail review:

- "we know this is safe": it states nothing.
- "safe because we tested it": tests do not prove the absence of UB.
- "the caller ensures correctness": which invariant, and where is the contract written?
- A block with no comment: automatic failure.

## Audit report format

```markdown
## UB Audit Report

**Scope:** [crate, module or file]
**Miri version:** [output of `cargo +nightly miri --version`]
**Date:** [date]

### Findings

| # | Category | File:line | Severity | Status |
|---|---|---|---|---|
| 1 | Aliasing | src/buf.rs:42 | High | Fixed (bead 1) |
| 2 | Uninitialised | src/ffi.rs:98 | High | Fixed (bead 2) |

### Beads

#### Bead 1: aliasing violation in buffer resize
- **Root cause:** a `&mut` was created while a `&` to the same slice was live
- **Fix:** dropped the shared reference before taking the mutable one
- **Proof:** `cargo +nightly miri test -- test_buffer_resize` passes Level 3

### Follow-up
- [ ] Miri in CI (Level 2 minimum)
- [ ] All SAFETY comments reviewed
- [ ] Regression test for each bead
- [ ] Unreached unsafe blocks listed with a plan
```

The reader-facing reply carries the result, the material risk and the required action; the table and beads go into the evidence file.

## Common fix patterns

### Aliasing: restructure the borrows

```rust
// Before: a raw pointer from a shared borrow is used after a mutable borrow starts
let ptr = slice.as_ptr();
let first = &mut slice[0];
*first = 1;
// reading through `ptr` here is UB under Stacked Borrows

// After: derive each pointer when needed, from the live borrow
let first = &mut slice[0];
*first = 1;
let ptr = slice.as_ptr(); // created after the mutable borrow ended
```

When interior mutation is the goal, store the data in `UnsafeCell` (or `Cell`, `Mutex`, atomics) and derive pointers with `UnsafeCell::get`.

### Uninitialised memory: `MaybeUninit`

```rust
use std::mem::MaybeUninit;

// Before: mem::uninitialized() creates an invalid value
// After
let mut slot = MaybeUninit::<u64>::uninit();
slot.write(42);
// SAFETY: `slot` was initialised by the `write` on the previous line.
let value = unsafe { slot.assume_init() };
```

### Provenance: exposed or strict APIs

```rust
// Before: the round trip through usize loses provenance
let addr = ptr as usize;
let recovered = addr as *const u32;

// After, when the round trip is needed: expose, then rebuild
let addr = ptr.expose_provenance();
let recovered = std::ptr::with_exposed_provenance::<u32>(addr);

// After, usually better: keep the pointer and change only the address
let moved = ptr.wrapping_add(1);
```

### `Send` and `Sync`: prove the claim or remove the impl

```rust
// Before: an unexplained manual impl
unsafe impl Send for MyType {}

// After: the comment names the mechanism that makes the claim true
// SAFETY: category 9. MyType's only non-Send field is `*mut Buffer`; every access goes
// through `self.lock: Mutex<()>`, which orders accesses across threads.
unsafe impl Send for MyType {}
```

When no mechanism exists, delete the impl and let the compiler reject the cross-thread use.

### FFI: validate at the boundary

```rust
// Before: a null pointer from C becomes a reference
let result: &Thing = unsafe { &*ffi_call() };

// After
let raw = unsafe { ffi_call() };
let result = std::ptr::NonNull::new(raw).ok_or(Error::NullFromFfi)?;
```

Each fix pattern pairs with a Miri test that reproduces the pre-fix behaviour, so the regression suite proves the repair.

## Activation

Use this reference when:

- the user asks for a UB audit, Miri sweep, unsafe audit, soundness check, race hunt or Rustonomicon-style review;
- the agent meets `unsafe` while doing a Rust task and has to verify it;
- Miri reports a failure that needs classification and a fix;
- the question is "is this sound?" about Rust code.

Miri's verdict is the proof. Ship nothing `unsafe` that Miri has not accepted, and say plainly in the report which blocks no test reached.
