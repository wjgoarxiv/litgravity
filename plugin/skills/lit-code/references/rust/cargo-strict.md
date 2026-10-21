# Cargo Strict Configuration

The configuration every new Rust project starts from. Drop the files in as written, then relax a single lint at a time with a written reason. The scaffold script `scripts/rust/new-project.py` writes most of these files in one step.

## `rust-toolchain.toml`

```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy", "rust-src"]
profile = "default"
```

Miri and the sanitizers need nightly. Install it beside stable and select it per command with `cargo +nightly`:

```bash
rustup install nightly
rustup component add miri rust-src --toolchain nightly
```

## `Cargo.toml`: package metadata

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2024"       # requires Rust 1.85 or newer
rust-version = "1.85"  # the minimum supported Rust version (MSRV)
license = "Apache-2.0 OR MIT"
```

Edition 2024 changes several defaults that this configuration relies on: `unsafe_op_in_unsafe_fn` warns by default, `extern` blocks are written `unsafe extern`, `#[no_mangle]` is written `#[unsafe(no_mangle)]`, references to `static mut` are denied, and `gen` is a reserved keyword. Set `rust-version` to the oldest toolchain CI tests; raise it only when a needed feature lands.

## `Cargo.toml`: lints

```toml
[lints.rust]
unsafe_op_in_unsafe_fn = "deny"
missing_docs = "warn"
missing_debug_implementations = "warn"
unreachable_pub = "warn"
unused_must_use = "deny"
elided_lifetimes_in_paths = "warn"
non_ascii_idents = "deny"
trivial_numeric_casts = "warn"
unused_lifetimes = "warn"
single_use_lifetimes = "warn"
# Register the cfg used by loom tests so the compiler stays quiet about it
unexpected_cfgs = { level = "warn", check-cfg = ['cfg(loom)'] }

[lints.clippy]
# Groups: low priority so the individual lints below win
all = { level = "deny", priority = -1 }
pedantic = { level = "warn", priority = -1 }
nursery = { level = "warn", priority = -1 }
cargo = { level = "warn", priority = -1 }

# Sharp tools promoted to errors
undocumented_unsafe_blocks = "deny"
multiple_unsafe_ops_per_block = "deny"
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"
todo = "deny"
unimplemented = "deny"
unreachable = "deny"
indexing_slicing = "deny"
mem_forget = "deny"
as_underscore = "deny"
as_ptr_cast_mut = "deny"
fn_to_numeric_cast_any = "deny"

# Numeric and pointer casts
arithmetic_side_effects = "warn"
cast_possible_truncation = "warn"
cast_possible_wrap = "warn"
cast_precision_loss = "warn"
cast_sign_loss = "warn"
ptr_as_ptr = "warn"
borrow_as_ptr = "warn"

# Ownership and output hygiene
clone_on_ref_ptr = "warn"
mutex_atomic = "warn"
rc_buffer = "warn"
rc_mutex = "warn"
exit = "warn"
allow_attributes_without_reason = "warn"
dbg_macro = "warn"
print_stderr = "warn"
print_stdout = "warn"
use_debug = "warn"

# Soundness rails and structure
mod_module_files = "warn"          # foo.rs beside foo/, no foo/mod.rs
empty_drop = "warn"
empty_structs_with_brackets = "warn"
empty_enum = "warn"
exhaustive_enums = "warn"          # public enums consider #[non_exhaustive]
exhaustive_structs = "warn"

# Project-wide opinions that quiet noisy pedantic lints
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"       # anyhow::Result with .context() carries the story
```

How the priorities work: group lints with `priority = -1` apply first, and the named lints after them override. That is how `unwrap_used` becomes an error while the rest of `pedantic` stays a warning.

Binaries print by design. A CLI crate overrides `print_stdout` and `print_stderr` with `allow` in its own `[lints.clippy]` table, with a comment saying the output is the product. Application crates may relax `missing_docs`, `unreachable_pub` and `exhaustive_*`, which matter for published libraries.

### Workspace lints

Put the table once in the workspace root and let each member inherit it:

```toml
# root Cargo.toml
[workspace]
members = ["crates/*"]
resolver = "3"        # the edition-2024 default

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "Apache-2.0 OR MIT"

[workspace.lints.rust]
unsafe_op_in_unsafe_fn = "deny"
# ... same tables as above under [workspace.lints.clippy]

# each member crate
[lints]
workspace = true
```

## `Cargo.toml`: profiles

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = "symbols"
panic = "abort"          # smaller and faster; use "unwind" when FFI must catch panics
debug = "line-tables-only"

[profile.dev]
opt-level = 0
debug = true
incremental = true
split-debuginfo = "unpacked"

# Dependencies compile once at higher optimisation so debug builds of
# parsers, crypto and image code stay usable
[profile.dev.package."*"]
opt-level = 2
```

`panic = "abort"` drops the unwinding tables. Cargo ignores the `panic` setting for the test profile, so `#[should_panic]` tests keep unwinding.

## `rustfmt.toml`

```toml
edition = "2024"
max_width = 100
newline_style = "Unix"
use_field_init_shorthand = true
use_try_shorthand = true
# Nightly-only options; stable rustfmt prints a warning and skips them
imports_granularity = "Module"
group_imports = "StdExternalCrate"
```

Import grouping needs nightly rustfmt, so CI formats with `cargo +nightly fmt --all -- --check`. A stable-only project deletes the last two lines.

## `clippy.toml`

```toml
# Complexity thresholds
cognitive-complexity-threshold = 25
type-complexity-threshold = 250
too-many-arguments-threshold = 6
too-many-lines-threshold = 100

# Keep clippy from suggesting APIs newer than the MSRV
msrv = "1.85"

# Tests may use the shortcuts the lints deny elsewhere
allow-unwrap-in-tests = true
allow-expect-in-tests = true
allow-panic-in-tests = true
allow-indexing-slicing-in-tests = true
allow-dbg-in-tests = true
allow-print-in-tests = true

# Short binding names are accepted up to this count
single-char-binding-names-threshold = 4
```

## `deny.toml` (cargo-deny)

```toml
[advisories]
db-urls = ["https://github.com/rustsec/advisory-db"]
yanked = "deny"
ignore = []                     # each entry gets a comment: id, reason, review date

[licenses]
allow = [
    "MIT",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-3.0",
    "Zlib",
    "MPL-2.0",
    "CC0-1.0",
]
confidence-threshold = 0.93

[bans]
multiple-versions = "warn"
wildcards = "deny"
highlight = "all"
deny = [
    { crate = "async-std", reason = "standardise on tokio" },
    { crate = "actix-web", reason = "standardise on axum" },
    { crate = "chrono", reason = "standardise on jiff; see libraries.md for the sqlx boundary" },
]

[sources]
unknown-registry = "deny"
unknown-git = "warn"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

cargo-deny changes its schema between releases. Run `cargo deny init` once to see the current template, then merge the policy choices above into it. The ban on `chrono` suits a project that stores times through `jiff`; a service whose database driver only speaks `chrono` removes that entry and records the reason.

## CI workflow (`.github/workflows/ci.yml`)

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

jobs:
  fmt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@nightly
        with:
          components: rustfmt
      - run: cargo +nightly fmt --all -- --check

  clippy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy
      - uses: Swatinem/rust-cache@v2
      - run: cargo clippy --all-targets --all-features --workspace -- -D warnings

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - uses: taiki-e/install-action@nextest
      - run: cargo nextest run --all-targets --all-features --workspace
      - run: cargo test --doc --all-features --workspace   # nextest skips doctests

  miri:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@nightly
        with:
          components: miri, rust-src
      - uses: Swatinem/rust-cache@v2
      - uses: taiki-e/install-action@nextest
      - env:
          MIRIFLAGS: "-Zmiri-strict-provenance -Zmiri-symbolic-alignment-check"
        run: cargo +nightly miri nextest run --all-features --workspace

  machete:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: bnjbvr/cargo-machete@main

  deny:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: EmbarkStudios/cargo-deny-action@v2
        with:
          command: check all

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rustsec/audit-check@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

Action versions move; bump the `@v` tags when the maintainers publish newer majors. Keep the Miri job's `MIRIFLAGS` identical to Level 2 in `../rust-ub/README.md` so local and CI results agree. Projects without `unsafe` still run the Miri job on the test suite at a weekly schedule; it costs minutes and catches dependency regressions.

## Project bootstrap

```bash
cargo new --bin my-app --edition 2024
cd my-app
cargo install cargo-nextest cargo-machete cargo-deny cargo-edit cargo-watch cargo-insta
rustup install nightly
rustup component add miri rust-src --toolchain nightly
# add the files above, then
git add . && git commit -m "chore: bootstrap strict toolchain"
```

`cargo install` compiles from source and takes minutes; `cargo binstall` fetches prebuilt binaries when it is available. Under headless `agy -p` the install is a long `run_command`; start it with the async wait option and poll with `command_status`.

After every change:

```bash
cargo fmt --all -- --check && \
cargo clippy --all-targets --all-features -- -D warnings && \
cargo nextest run && \
cargo +nightly miri nextest run    # only when unsafe is involved
```

## Relaxing a lint

A lint that blocks a legitimate pattern gets a local, reasoned exception rather than a global one:

```rust
#[allow(clippy::cast_possible_truncation, reason = "value is masked to 8 bits on the previous line")]
fn low_byte(x: u32) -> u8 {
    (x & 0xFF) as u8
}
```

The `reason` field is stable since Rust 1.81 and satisfies `allow_attributes_without_reason`. The audit script expects a `// CLIPPY-ALLOW: <reason>` comment on the previous line for `#[allow(clippy::..)]` attributes that carry no `reason`; either form documents the decision. Prefer `#[expect(..., reason = "...")]` when the code should stop needing the exception: the compiler warns once the lint no longer fires, so stale exceptions disappear.
