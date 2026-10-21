# CLI Stack: clap, color-eyre, tracing, indicatif, dialoguer

The default for every new command-line tool: typed arguments, readable errors, progress feedback, interactive prompts when a person is present and clean output when a pipe is. Commands below assume clap 4; confirm other versions on docs.rs.

## Cargo.toml

```toml
[package]
name = "mytool"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"

[dependencies]
clap = { version = "4", features = ["derive", "env", "wrap_help", "color", "unicode"] }
clap_complete = "4"
clap_mangen = "0.2"
color-eyre = "0.6"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }
anyhow = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
indicatif = "0.17"
dialoguer = { version = "0.11", features = ["fuzzy-select"] }
console = "0.15"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "fs", "process", "signal"] }

[dev-dependencies]
assert_cmd = "2"
predicates = "3"

[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = "symbols"
panic = "abort"
```

## Command structure

```rust
// src/cli.rs
use std::path::PathBuf;

use clap::{ArgAction, Args, Parser, Subcommand, ValueEnum};

#[derive(Debug, Parser)]
#[command(
    name = "mytool",
    author,
    version,
    about = "One-line description",
    long_about = "Longer description shown by --help",
    arg_required_else_help = true
)]
pub struct Cli {
    /// Configuration file path
    #[arg(short, long, env = "MYTOOL_CONFIG", default_value = "config.toml", global = true)]
    pub config: PathBuf,

    /// Raise verbosity (-v info, -vv debug, -vvv trace)
    #[arg(short, long, action = ArgAction::Count, global = true)]
    pub verbose: u8,

    /// Print errors only
    #[arg(short, long, global = true, conflicts_with = "verbose")]
    pub quiet: bool,

    /// When to colour output
    #[arg(long, global = true, value_enum, default_value_t = ColorWhen::Auto)]
    pub color: ColorWhen,

    /// Output format
    #[arg(short, long, global = true, value_enum, default_value_t = OutputFormat::Pretty)]
    pub format: OutputFormat,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum ColorWhen {
    Auto,
    Always,
    Never,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum OutputFormat {
    Pretty,
    Json,
    Plain,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Build the project
    Build(BuildArgs),
    /// Watch for changes and rebuild
    Watch(WatchArgs),
    /// Print shell completions to stdout
    Completions {
        #[arg(value_enum)]
        shell: clap_complete::Shell,
    },
}

#[derive(Debug, Args)]
pub struct BuildArgs {
    /// Target directory
    #[arg(short, long, default_value = "target")]
    pub target: PathBuf,
    /// Build mode
    #[arg(short, long, value_enum, default_value_t = Mode::Release)]
    pub mode: Mode,
    /// Files to build (default: all)
    pub files: Vec<PathBuf>,
}

#[derive(Debug, Args)]
pub struct WatchArgs {
    /// Glob pattern to watch
    #[arg(short, long, default_value = "**/*.rs")]
    pub pattern: String,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum Mode {
    Debug,
    Release,
}
```

Derive attributes worth knowing:

- `env = "VAR"` falls back to an environment variable when the flag is absent.
- `global = true` lets subcommands accept the flag.
- `arg_required_else_help = true` prints help instead of an error when no arguments arrive.
- `value_enum` gives case-insensitive parsing, validation and completions from a plain enum.
- `action = ArgAction::Count` turns repeated short flags (`-vvv`) into a number.
- `conflicts_with`, `requires`, `group` and `num_args` express relationships between flags.
- `#[arg(value_parser = ...)]` attaches a custom parser, for example `clap::value_parser!(u16).range(1..)`.

A unit test catches definition mistakes at `cargo test` time:

```rust
#[test]
fn cli_definition_is_valid() {
    use clap::CommandFactory as _;
    Cli::command().debug_assert();
}
```

## Main and tracing initialisation

```rust
// src/main.rs
use clap::{CommandFactory as _, Parser as _};
use mytool::cli::{Cli, ColorWhen, Command};
use tracing::Level;
use tracing_subscriber::EnvFilter;

fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    let cli = Cli::parse();
    init_tracing(&cli);

    match cli.color {
        ColorWhen::Always => console::set_colors_enabled(true),
        ColorWhen::Never => console::set_colors_enabled(false),
        ColorWhen::Auto => {}
    }

    match &cli.command {
        Command::Build(args) => mytool::commands::build::run(&cli, args),
        Command::Watch(args) => mytool::commands::watch::run(&cli, args),
        Command::Completions { shell } => {
            let mut command = Cli::command();
            clap_complete::generate(*shell, &mut command, "mytool", &mut std::io::stdout());
            Ok(())
        }
    }
}

fn init_tracing(cli: &Cli) {
    let level = if cli.quiet {
        Level::ERROR
    } else {
        match cli.verbose {
            0 => Level::WARN,
            1 => Level::INFO,
            2 => Level::DEBUG,
            _ => Level::TRACE,
        }
    };
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("mytool={level}")));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .without_time()
        .compact()
        .with_writer(std::io::stderr)
        .init();
}
```

Rules for tracing in a CLI:

- Write logs to stderr. Standard output belongs to the tool's result, which users pipe.
- Derive verbosity from `-v` flags; `RUST_LOG` stays as a developer override.
- `console` and `clap` already honour `NO_COLOR` and terminal detection under `ColorWhen::Auto`.

## Progress bars: `indicatif`

```rust
use std::time::Duration;

use indicatif::{ProgressBar, ProgressStyle};

fn process_all(files: &[std::path::PathBuf]) -> color_eyre::Result<()> {
    let bar = ProgressBar::new(files.len() as u64);
    bar.set_style(
        ProgressStyle::with_template(
            "{spinner:.green} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {pos}/{len} ({eta}) {msg}",
        )?
        .progress_chars("=>-"),
    );

    for file in files {
        bar.set_message(file.display().to_string());
        process(file)?;
        bar.inc(1);
    }
    bar.finish_with_message("done");
    Ok(())
}
```

Unbounded work uses a spinner:

```rust
let spinner = ProgressBar::new_spinner();
spinner.enable_steady_tick(Duration::from_millis(80));
spinner.set_message("connecting...");
let session = connect().await?;
spinner.finish_and_clear();
```

Parallel tasks share a `MultiProgress`, which keeps the bars stacked and redraws cleanly under concurrent updates:

```rust
use indicatif::MultiProgress;

let multi = MultiProgress::new();
let style = ProgressStyle::with_template("worker {prefix}: {pos}/{len}")?;
let bars: Vec<ProgressBar> = (0..workers)
    .map(|i| {
        let bar = multi.add(ProgressBar::new(unit));
        bar.set_style(style.clone());
        bar.set_prefix(i.to_string());
        bar
    })
    .collect();
```

Bars draw to stderr and switch off when stderr is not a terminal. Print messages above a live bar with `bar.println(..)` so output does not tear. The `tracing-indicatif` crate routes `tracing` events through the same mechanism.

## Interactive prompts: `dialoguer`

```rust
use dialoguer::{theme::ColorfulTheme, Confirm, FuzzySelect, Input, MultiSelect, Password, Select};

let theme = ColorfulTheme::default();

let name: String = Input::with_theme(&theme)
    .with_prompt("Project name")
    .validate_with(|input: &String| -> Result<(), &str> {
        if input.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            Ok(())
        } else {
            Err("use letters, digits, dash and underscore")
        }
    })
    .interact_text()?;

let key = Password::with_theme(&theme)
    .with_prompt("API key")
    .with_confirmation("Repeat", "values differ")
    .interact()?;

let proceed = Confirm::with_theme(&theme)
    .with_prompt(format!("Delete {}? This cannot be undone.", path.display()))
    .default(false)
    .interact()?;
if !proceed {
    return Ok(());
}

let choice = Select::with_theme(&theme)
    .with_prompt("Pick one")
    .items(&["yes", "no", "maybe"])
    .default(0)
    .interact()?;

let picks = MultiSelect::with_theme(&theme)
    .with_prompt("Toggle features")
    .items(&["alpha", "beta", "gamma"])
    .defaults(&[true, false, false])
    .interact()?;
```

Detect a missing terminal before prompting, using the standard library:

```rust
use std::io::IsTerminal as _;

if !std::io::stdin().is_terminal() {
    color_eyre::eyre::bail!("input required but stdin is not a terminal; pass --yes or the flags explicitly");
}
```

Give every prompt a flag-based equivalent (`--yes`, `--name <NAME>`) and a `--non-interactive` switch, so scripts and CI can drive the tool without a pseudo-terminal. Under headless `agy -p` there is no terminal, so tests of prompts use the flag path.

## Structured output

```rust
use console::{style, Term};

match cli.format {
    OutputFormat::Json => {
        serde_json::to_writer(std::io::stdout().lock(), &result)?;
        println!();
    }
    OutputFormat::Plain => {
        for row in &result.rows {
            println!("{}\t{}\t{}", row.a, row.b, row.c);
        }
    }
    OutputFormat::Pretty => {
        let term = Term::stdout();
        for row in &result.rows {
            term.write_line(&format!(
                "{} {} {}",
                style(&row.a).green(),
                style(&row.b).yellow(),
                style(&row.c).dim(),
            ))?;
        }
    }
}
```

Always offer `--format json` for `jq` and scripts, and keep the JSON schema stable across releases (add fields, avoid renaming). The CLI's own `println!` calls are the product; allow the `print_stdout` lint in the binary crate with a reason.

## Completions and manual pages

The `Completions` subcommand above prints a script for bash, zsh, fish, elvish or PowerShell. Distribution examples:

```bash
mytool completions bash > /etc/bash_completion.d/mytool
mytool completions fish > ~/.config/fish/completions/mytool.fish
mytool completions zsh  > "${fpath[1]}/_mytool"
```

For manual pages use `clap_mangen` from a `build.rs` or an `xtask`:

```rust
let mut buffer = Vec::new();
clap_mangen::Man::new(Cli::command()).render(&mut buffer)?;
std::fs::write("mytool.1", buffer)?;
```

## Signal handling

Async commands race the work against Ctrl-C:

```rust
tokio::select! {
    result = long_running_task() => result,
    _ = tokio::signal::ctrl_c() => {
        tracing::warn!("interrupted, cleaning up");
        cleanup().await?;
        std::process::exit(130); // 128 + SIGINT
    }
}
```

Synchronous tools register a one-shot flag with the `ctrlc` crate and poll it between steps:

```rust
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

let interrupted = Arc::new(AtomicBool::new(false));
let flag = Arc::clone(&interrupted);
ctrlc::set_handler(move || flag.store(true, Ordering::SeqCst))?;

while !interrupted.load(Ordering::SeqCst) {
    do_step()?;
}
```

## Error reporting with color-eyre

```rust
fn main() -> color_eyre::Result<()> {
    color_eyre::config::HookBuilder::default()
        .display_env_section(false)      // hide the RUST_BACKTRACE hint by default
        .display_location_section(false) // hide the file:line section
        .panic_section("If this is a bug, report it at https://example.com/mytool/issues")
        .install()?;
    real_main()
}
```

Add context with `.wrap_err("...")` (from `color_eyre::eyre::WrapErr`, interchangeable with anyhow's `.context`) and the report prints as a numbered chain. `RUST_BACKTRACE=1` adds backtraces; `RUST_SPANTRACE=1` adds the tracing spans active when the error was created.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General failure (what `main` returning `Err` produces) |
| 2 | Usage error (clap exits with this on bad arguments) |
| 130 | Interrupted by SIGINT |

Document any further codes in `--help`. For finer control return `std::process::ExitCode` from `main` and map error types to codes in one function.

## Distribution

- `cargo dist init` builds a release pipeline with cross-platform archives and installers.
- Publish to Homebrew, Scoop, winget or distribution packages from the same release artefacts.
- Sign Linux binaries with `cosign` for enterprise audiences.
- Build a static Linux binary with the musl target (`x86_64-unknown-linux-musl` or `aarch64-unknown-linux-musl`).
- For WASI runtimes, add the `wasm32-wasip1` target.

## Common mistakes

1. **Mixing stdout and stderr.** Results go to stdout; logs, prompts and progress go to stderr.
2. **No non-interactive path.** A prompt with no flag equivalent blocks automation.
3. **Unconditional colour.** Respect `NO_COLOR`, terminal detection and `--color`.
4. **`println!` for errors.** Return an `Err` or call `tracing::error!`.
5. **Wrapping `Cli::parse()` in custom error handling.** clap prints usage errors and exits with code 2 on its own; use `try_parse` only when embedding the parser.
6. **Large handlers in `main.rs`.** Give each subcommand a module under `src/commands/`.
7. **Unstable machine output.** Renaming a JSON field breaks every script downstream; add fields and keep old ones.
8. **Reading stdin when it is a terminal.** Check `is_terminal()` and print usage instead of hanging.

## Testing CLIs

```rust
// tests/cli.rs
use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn shows_help() {
    Command::cargo_bin("mytool")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Usage:"));
}

#[test]
fn rejects_unknown_subcommand() {
    Command::cargo_bin("mytool")
        .unwrap()
        .arg("nope")
        .assert()
        .failure()
        .code(2)
        .stderr(predicate::str::contains("unrecognized subcommand"));
}
```

`assert_cmd` builds the binary once per test run and offers a fluent assertion API. Recent releases deprecate `Command::cargo_bin` in favour of the `cargo_bin_cmd!` macro; the compiler message names the replacement. Pair it with `insta` snapshots for `--help` output and JSON results (see [proptest-insta.md](proptest-insta.md)), and test prompts through their flag equivalents.
