# Rust Debugging

Covers `cargo`, `tokio`, panics, and the fact that you usually do not need a live debugger: Rust's type system, `dbg!`, and logging settle most sessions faster than gdb would. Run commands through `run_command`; a `rust-gdb` prompt is a long-running command driven with `send_command_input` and read with `command_status`.

---

## Environment detection (Phase 0)

```bash
cargo --version
rustc --version
cat rust-toolchain.toml rust-toolchain 2>/dev/null
cat Cargo.toml | head -30

which rust-gdb
which rust-lldb
which lldb

grep -E '"(tokio|async-std|smol)"' Cargo.toml   # async infrastructure
grep -E '^\[profile' Cargo.toml                  # profile flags
```

The default `cargo run` builds the `dev` profile, which keeps debug symbols. `cargo run --release` strips them, so stay in dev unless the bug shows up only under optimization.

---

## The Rust debugging hierarchy (use in this order)

1. **`dbg!(expr)`** — a single value at a spot. Prints file:line plus the value, returns the value unchanged so you can inline it. Faster than a debugger for most bugs.
2. **`RUST_LOG=trace` with `tracing` / `env_logger`** — flow and state across an operation, zero code change at dev time.
3. **`RUST_BACKTRACE=1` / `=full`** — crashes. Almost always enough; a live debugger is rarely needed for a panic.
4. **`rust-gdb` / `rust-lldb`** — pause execution and inspect memory, especially for unsafe code or FFI.
5. **`tokio-console`** — async deadlocks, stuck tasks, hot loops.
6. **`cargo-expand`** — a macro is doing something surprising.

Reach for the lightest tool that answers the hypothesis.

---

## `dbg!` — the underused macro

```rust
let x = 5;
let y = dbg!(x * 2);   // prints: [src/main.rs:2] x * 2 = 10
```

Inside a complex expression:

```rust
let total = items.iter().filter(|i| i.active).map(|i| dbg!(i.cost)).sum::<u64>();
```

Multiple values at once: `dbg!(&user, &request, elapsed.as_millis());`. `dbg!` writes to stderr, so it keeps a stdout-based pipeline clean. Journal each `dbg!` you add and revert at Phase 9.

---

## `RUST_LOG` for flow-level debugging

```bash
RUST_LOG=debug cargo run
RUST_LOG=trace cargo run
RUST_LOG=my_crate=trace,hyper=info cargo run      # per-module level
RUST_LOG=debug,tokio=off cargo run                # silence noisy crates
```

For `tracing`-based apps, instrument with spans:

```rust
#[tracing::instrument]
fn handle_request(req: &Request) -> Response { ... }
```

This gives per-call entry/exit logs with args and timing, no code in the body.

---

## `RUST_BACKTRACE` for panics

```bash
RUST_BACKTRACE=1 cargo run       # backtrace on panic
RUST_BACKTRACE=full cargo run    # include libstd / tokio frames
```

The panic usually names the file:line; the backtrace shows how it got there. Between the two, most crash bugs resolve without a debugger.

---

## rust-gdb / rust-lldb

### Launch

```bash
cargo build                                  # debug symbols by default (dev profile)
rust-gdb ./target/debug/my_binary            # gdb wrapper with Rust pretty-printers
rust-lldb ./target/debug/my_binary           # lldb equivalent
rust-gdb --args ./target/debug/my_binary arg1 arg2
rust-gdb -p $(pgrep my_binary)               # attach to a running process
```

### Breakpoints (Rust symbols are mangled)

```
(gdb) b main
(gdb) b my_crate::module::function
(gdb) b src/handler.rs:42
(gdb) info functions my_function     # find the mangled name
```

### State inspection

```
(gdb) p x                        # Rust pretty-printer for Vec, Option, HashMap, ...
(gdb) p *ptr
(gdb) info locals
(gdb) info args
(gdb) bt
(gdb) frame <n>
(gdb) watch my_var               # stop when my_var changes
(gdb) rbreak regex               # breakpoint every function matching regex
```

Pair with pwndbg for better layout on native bugs (`../tools/pwndbg.md`); pwndbg works with rust-gdb too.

---

## tokio-console — async task debugging

For tokio apps, this is the tool when tasks stall or leak.

```toml
# Cargo.toml
[dependencies]
console-subscriber = "0.2"
```

```rust
// main.rs
console_subscriber::init();
```

```bash
RUSTFLAGS="--cfg tokio_unstable" cargo run
tokio-console                     # connects to the default port 6669, run in a second handle
```

It shows live tasks, their state, wake counts, poll durations, and parent tasks: the fastest way to find why an async thing is stuck.

---

## cargo-expand — when a macro is suspect

```bash
cargo install cargo-expand
cargo expand                      # expand all macros in the crate
cargo expand my::module::path     # scope to one item
```

When a macro (`#[derive]`, `#[tokio::main]`, `#[async_trait]`) seems to generate code that mismatches your mental model, this shows exactly what the compiler sees.

---

## Release-build gotcha

```bash
cargo build --release             # no debug symbols by default
```

When the bug appears only in `--release`:

```toml
[profile.release]
debug = true                      # add symbols, keep optimizations
```

Then `rust-gdb ./target/release/my_binary` works on release builds, which you need when optimization-time codegen bugs (inlining, LLVM folding) are suspected.

---

## Silent-failure patterns in Rust

| Pattern | Why it stays quiet |
|---|---|
| `.unwrap_or_default()` | masks errors as the zero value |
| `.unwrap_or(fallback)` | same, with a specific fallback |
| `let _ = fallible_operation()` | discards the Result with no compiler warning |
| `if let Ok(x) = ... { use(x); }` with no else | silent on Err |
| `.ok()` chaining | converts Result to Option, dropping the error |
| a panic inside a tokio task that is not `.await`ed | the task dies quietly; the runtime logs it only when logs are on |
| `eprintln!` to a redirected-null stderr | looks like nothing happened |
| a `Drop` impl that panics under a specific condition | a double panic aborts the process quietly with no logging |

---

## Phase 9 cleanup specifics

```bash
git diff | grep -E 'dbg!\('
git checkout <file>   # for any file with dbg! additions

unset RUST_LOG RUST_BACKTRACE
pkill -f 'rust-gdb' || true
pkill -f 'rust-lldb' || true
pkill -f '^lldb ' || true
lsof -iTCP:6669 -sTCP:LISTEN -nP 2>/dev/null   # tokio-console default
```
