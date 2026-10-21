# One-Liners and Disposable Scripts

Production hygiene with throwaway ergonomics. A Rust script follows the same lints, the same Miri rule when `unsafe` appears and the same type discipline as a crate. The difference is that its dependencies are declared inline, so a single file runs with no project around it.

## `rust-script`: the recommended path

Install once:

```bash
cargo install rust-script
```

Write a script. The `//! ```cargo` block in the leading doc comment is parsed as an inline `Cargo.toml`; the rest is ordinary Rust.

```rust
#!/usr/bin/env rust-script
//! Fetch a URL and print the body length.
//!
//! Usage: ./fetch.rs <url>
//!
//! ```cargo
//! [dependencies]
//! anyhow = "1"
//! reqwest = { version = "0.12", features = ["blocking"] }
//! ```

use anyhow::Context as _;
use std::env;

fn main() -> anyhow::Result<()> {
    let url = env::args().nth(1).context("usage: fetch.rs <url>")?;
    let body = reqwest::blocking::get(&url)?.error_for_status()?.text()?;
    println!("{} bytes", body.len());
    Ok(())
}
```

Make it executable with `chmod +x fetch.rs` and run `./fetch.rs https://example.com`. Without the executable bit, `rust-script fetch.rs https://example.com` does the same.

### Expressions and loops from the shell

```bash
rust-script -e '2_u64.pow(40)'                      # evaluate one expression
rust-script --dep rand -e 'rand::random::<u8>()'    # add a dependency for the expression
printf '3\n4\n' | rust-script --loop 'let n: i32 = line.trim().parse().unwrap_or(0); println!("{}", n * 2);'
```

`--loop` runs the snippet once per stdin line with the text in `line`. Treat these forms as REPL conveniences; anything that stays in use graduates to a script file with the strict lints below.

## With async

```rust
#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! anyhow = "1"
//! futures = "0.3"
//! reqwest = "0.12"
//! tokio = { version = "1", features = ["full"] }
//! ```

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let urls = ["https://example.com", "https://example.org"];
    let client = reqwest::Client::new();

    let bodies = futures::future::join_all(urls.iter().map(|url| {
        let client = client.clone();
        async move { client.get(*url).send().await?.text().await }
    }))
    .await;

    for (url, body) in urls.iter().zip(bodies) {
        match body {
            Ok(text) => println!("{url}: {} bytes", text.len()),
            Err(error) => eprintln!("{url}: error {error}"),
        }
    }
    Ok(())
}
```

Add `tokio::time::timeout` around network calls even in a script; a hung request is a hung terminal.

## With CLI parsing

```rust
#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! anyhow = "1"
//! clap = { version = "4", features = ["derive"] }
//! glob = "0.3"
//! ```

use clap::Parser;

#[derive(Parser, Debug)]
#[command(version, about = "Rename files by pattern")]
struct Cli {
    /// Glob to match
    pattern: String,
    /// Replacement template; {n} expands to the sequence number
    template: String,
    /// Print the plan without renaming
    #[arg(long)]
    dry_run: bool,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let entries = glob::glob(&cli.pattern)?.collect::<Result<Vec<_>, _>>()?;
    for (n, entry) in entries.iter().enumerate() {
        let target = cli.template.replace("{n}", &n.to_string());
        if cli.dry_run {
            println!("{} -> {target}", entry.display());
        } else {
            std::fs::rename(entry, &target)?;
        }
    }
    Ok(())
}
```

A rename tool earns a `--dry-run` flag on day one; scripts that mutate files without a preview are the ones that cause incidents.

## Caching

`rust-script` stores each compiled script in the platform cache directory (`~/.cache/rust-script` on Linux, `~/Library/Caches/rust-script` on macOS). The first run compiles the dependencies and takes a while; later runs start immediately. `rust-script --clear-cache` empties it. `rust-script --build-only ./script.rs` compiles without running, which suits a CI warm-up step.

## `cargo -Zscript`

Cargo has its own single-file packages (RFC 3424). At the time of writing the feature is unstable: it needs a nightly toolchain and the `-Zscript` flag, and stabilisation is tracked in the Cargo repository. Check `cargo +nightly --version` and the Cargo book page on scripts before adopting it. The syntax puts a TOML manifest in a frontmatter fence:

```rust
#!/usr/bin/env -S cargo +nightly -Zscript
---cargo
[package]
edition = "2024"

[dependencies]
anyhow = "1"
---

use anyhow::Context as _;

fn main() -> anyhow::Result<()> {
    let name = std::env::args().nth(1).context("name required")?;
    println!("hello {name}");
    Ok(())
}
```

Use `rust-script` for scripts that must run today on stable toolchains, and move to `cargo script` when it ships on stable on every machine that runs your scripts.

## Strict mode for scripts

Add a `[lints]` table to the inline manifest:

```rust
//! ```cargo
//! [dependencies]
//! anyhow = "1"
//!
//! [lints.rust]
//! unsafe_code = "forbid"
//!
//! [lints.clippy]
//! all = { level = "deny", priority = -1 }
//! pedantic = { level = "warn", priority = -1 }
//! unwrap_used = "deny"
//! expect_used = "deny"
//! panic = "deny"
//! ```
```

The script now holds the same bar as the main project. When a prototype needs a quick `unwrap()`, drop that single lint to `warn` for that single script; a blanket `allow` removes the bar entirely.

Surface warnings as errors on a run with `RUSTFLAGS="-D warnings" rust-script ./script.rs`. To lint the script with clippy, generate its package first (`rust-script --package ./script.rs` prints the directory) and run `cargo clippy` inside it.

## When a script is the wrong tool

- It will live longer than a week: make it a crate with `cargo new --bin`.
- It needs a build script (`build.rs`): crate.
- It ships as a binary to other machines: crate plus `cargo dist`.
- It needs a serious test suite: crate (a script can hold `#[test]` functions, but the workflow is clumsy).

Migration path: start as a script. When it passes about 200 lines or needs a second source file, run `rust-script --package ./script.rs`, copy the generated package into a fresh crate, and continue there.

## Inline tests in a script

```rust
#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! ```

fn double(x: i32) -> i32 {
    x * 2
}

fn main() {
    println!("{}", double(21));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles_ints() {
        assert_eq!(double(5), 10);
    }
}
```

Run the tests with `rust-script --test ./script.rs`.

## Rust as a stream filter

Ad-hoc processing of stdin, with typed parsing instead of string tricks:

```rust
#!/usr/bin/env rust-script
//! ```cargo
//! [dependencies]
//! anyhow = "1"
//! serde_json = "1"
//! ```

use std::io::{self, BufRead, Write};

fn main() -> anyhow::Result<()> {
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        let value: serde_json::Value = serde_json::from_str(&line)?;
        if value.get("level").and_then(|v| v.as_str()) == Some("error") {
            writeln!(out, "{line}")?;
        }
    }
    Ok(())
}
```

`cat logs.jsonl | ./filter-errors.rs` keeps the lines whose `level` is `error`. On large files this runs faster than `jq` and rejects malformed input loudly.

A numeric variant with std only:

```rust
#!/usr/bin/env rust-script
//! Sum the numbers on stdin, one per line.
use std::io::{self, BufRead};

fn main() {
    let total: f64 = io::stdin()
        .lock()
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| line.trim().parse::<f64>().ok())
        .sum();
    println!("{total}");
}
```

## Shebang notes

`#!/usr/bin/env rust-script` works on Linux and macOS because it passes a single argument. A shebang that needs extra arguments uses `env -S` so the kernel splits them:

```rust
#!/usr/bin/env -S rust-script --debug
```

Quote user arguments after the script name as usual; `rust-script` forwards everything after the file name to the script.

## Editor support

`rust-analyzer` can open a script as a standalone file. When the editor shows missing-crate errors, generate the package with `rust-script --package ./script.rs`, open that directory, and delete it when editing ends. The package path is a cache location; keep it out of version control.

## When even `rust-script` is heavy

For one expression, the `evcxr` REPL or `irust` fits better:

```bash
cargo install irust
irust
```

They serve exploration and cannot sit in a shell pipeline. Pipelines stay with `rust-script`.

## The standard

Same strict lints, same `clippy::pedantic` enforcement, same SAFETY-comment rule for `unsafe`. A 30-line script receives no exemption, because production hygiene is cheap whenever the toolchain enforces it.
