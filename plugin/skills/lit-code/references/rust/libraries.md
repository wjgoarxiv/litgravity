# Library Defaults: The Decision Tree

The default crate for each job in 2026 Rust, each with a one-line rationale and the idiom that matters, so nobody relearns the API per project. Versions below are major lines; confirm the current release with `cargo add <crate>` and let `Cargo.lock` freeze it. Crate APIs shift between minor releases in fast-moving crates (polars, sqlx, tower-http), so read docs.rs for the pinned version before copying a call.

## Async runtime: `tokio`

Default for new work. Use the multi-thread runtime unless a measurement says otherwise.

```rust
#[tokio::main(flavor = "multi_thread", worker_threads = 8)]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    run().await
}
```

Alternatives and when they apply:

- `async-std` is unmaintained; downloads reflect old inertia.
- `smol` fits small embedded-style niches; the wider ecosystem targets tokio.
- Two runtimes in one binary double the thread pools and split the ecosystem. Choose one.

Patterns for spawning, cancellation and shutdown: [async-tokio.md](async-tokio.md).

## Errors: `anyhow` for applications, `thiserror` for libraries

Application boundaries return `anyhow::Error` and add `.context(..)` at each layer that has something to say. Library crates expose `thiserror` enums marked `#[non_exhaustive]`.

```rust
// Application code
use anyhow::Context as _;

pub async fn load_config(path: &Path) -> anyhow::Result<Config> {
    let text = tokio::fs::read_to_string(path)
        .await
        .with_context(|| format!("reading config from {}", path.display()))?;
    toml::from_str(&text).with_context(|| format!("parsing config at {}", path.display()))
}

// Library code
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum ParseError {
    #[error("expected {expected}, found {found} at position {position}")]
    Mismatch { expected: &'static str, found: String, position: usize },
    #[error("unexpected end of input after {context}")]
    UnexpectedEof { context: &'static str },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

`#[non_exhaustive]` lets the library add variants without breaking downstream `match` arms. `#[error(transparent)]` forwards `Display` and `source()` to the wrapped error. Use `thiserror` 2.x; its derive no longer needs `std` features declared.

## CLI: `clap` with derive

```rust
use clap::{ArgAction, Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Path to the config file
    #[arg(short, long, env = "MYAPP_CONFIG", default_value = "config.toml")]
    config: PathBuf,

    /// Raise verbosity (-v, -vv, -vvv)
    #[arg(short, long, action = ArgAction::Count)]
    verbose: u8,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Run the server
    Serve {
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
    },
    /// Migrate the database
    Migrate {
        #[arg(long)]
        dry_run: bool,
    },
}
```

`structopt` merged into clap years ago. `argh` trades ergonomics for size, and `pico-args` suits a binary where footprint outranks developer experience. Full stack: [clap-stack.md](clap-stack.md).

## Logging: `tracing` and `tracing-subscriber`

`tracing` carries spans, structured context that follows an async task, which `log` cannot.

```rust
use tracing::{info, instrument, warn};
use tracing_subscriber::{fmt, EnvFilter};

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,hyper=warn"));
    fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(true)
        .with_line_number(true)
        .compact()
        .init();
}

#[instrument(skip(db), fields(user_id = %user.id))]
async fn process_user(db: &Pool, user: &User) -> anyhow::Result<()> {
    info!("processing user");
    if user.is_banned() {
        warn!(reason = "banned", "skipping");
        return Ok(());
    }
    // ...
    Ok(())
}
```

`println!` becomes `info!`, and `eprintln!` for failures becomes `error!`. Skip large or secret arguments in `#[instrument(skip(..))]` so spans stay small and clean.

## Binary error display: `color-eyre`

```rust
fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    real_main()
}
```

Library code stays on `anyhow` and `thiserror`; `color-eyre` formats errors and panics for the binary only.

## Serialization: `serde`, `serde_json`

The default for data crossing a process boundary: files, network, IPC, database columns.

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApiResponse {
    pub user_id: UserId,
    pub created_at: jiff::Timestamp,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

// Strict input: unknown fields are errors
#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StrictRequest {
    pub name: String,
}

// Forward compatible input: unknown fields are preserved
#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct OpenRequest {
    pub name: String,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}
```

`deny_unknown_fields` catches typos in configuration. It cannot combine with `#[serde(flatten)]`, so a struct picks either strictness or forward compatibility. `rename_all` aligns wire names with convention while Rust fields stay idiomatic.

Other formats: `toml` for configuration, `rmp-serde` (MessagePack) and `ciborium` (CBOR) for compact binary, `postcard` for embedded. YAML via a maintained `serde_yaml` fork suits files humans edit; prefer JSON or TOML where the format is yours to choose, because YAML's richer feature set widens the parsing surface.

## HTTP client: `reqwest`

```rust
let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .user_agent(concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION")))
    .https_only(true)
    .pool_max_idle_per_host(8)
    .build()?;

#[derive(serde::Deserialize)]
struct Repo {
    full_name: String,
    stargazers_count: u64,
}

let repo: Repo = client
    .get("https://api.github.com/repos/rust-lang/rust")
    .send()
    .await?
    .error_for_status()?
    .json()
    .await?;
```

`error_for_status()?` converts 4xx and 5xx responses into errors. Always send a User-Agent. `https_only(true)` stops accidental downgrades to plain HTTP. Build one `Client` and clone it; it is a cheap handle over a shared pool. For TLS without the system library, enable the `rustls-tls` feature and disable default features.

## Web framework: `axum`

```rust
use axum::{extract::State, routing::get, Json, Router};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();
    Json(serde_json::json!({ "ok": ok }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let db = sqlx::PgPool::connect(&std::env::var("DATABASE_URL")?).await?;
    let app = Router::new()
        .route("/health", get(health))
        .with_state(Arc::new(AppState { db }))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::compression::CompressionLayer::new());
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

`actix-web` brings its own runtime model, `warp` grows unwieldy filter chains in larger apps, and `rocket` releases slowly. Pair axum with `tower-http` for trace, compression, CORS, timeout and request-id middleware. Full stack: [axum-stack.md](axum-stack.md).

## Database: `sqlx`

```rust
use sqlx::PgPool;

#[derive(Debug, sqlx::FromRow)]
pub struct User {
    pub id: uuid::Uuid,
    pub email: String,
}

pub async fn find_user(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(User, "SELECT id, email FROM users WHERE email = $1", email)
        .fetch_optional(pool)
        .await
}
```

`query_as!` checks the SQL against a live database at compile time. For builds without a database, run `cargo sqlx prepare` and commit the generated `.sqlx/` directory; CI then builds with `SQLX_OFFLINE=true`. Migrations: `sqlx migrate add <name>` creates a file, and `sqlx::migrate!("./migrations").run(&pool).await?` applies them at start-up.

Skip `diesel` for async services (synchronous core, heavy DSL), raw `tokio-postgres` (no compile-time checking) and `sea-orm` (more magic, less control) unless the project already uses them.

Timestamp columns: sqlx implements encode and decode for `time` and `chrono` types. For `jiff` values, either store through the `jiff-sqlx` wrapper types or decode into `time::OffsetDateTime` at the database boundary and convert in the domain layer. Pick one and keep the conversion in the repository module.

## Time: `jiff`

Single crate with a clear split between civil time, instants, time zones and spans.

```rust
use jiff::{Timestamp, ToSpan, Zoned};

fn demo() -> Result<(), jiff::Error> {
    let now = Timestamp::now();
    let in_one_hour = now.checked_add(1.hour())?;
    let seoul: Zoned = now.in_tz("Asia/Seoul")?;
    let span = in_one_hour.in_tz("Asia/Seoul")? - &seoul;
    println!("{in_one_hour} / {seoul} / {span}");
    Ok(())
}
```

`chrono` carries an older API with a heavier time-zone story, and the `time` crate splits the ecosystem and thins the documentation. New code chooses `jiff` and meets the others only at library boundaries.

## UUID: `uuid` with v7

```rust
use uuid::Uuid;

// v7 for identifiers: time-ordered, index friendly (RFC 9562)
let id = Uuid::now_v7();
```

v4 serves nonces and tokens, v7 serves primary keys because sequential inserts keep index pages hot, and v1 embeds a MAC address. Features: `uuid = { version = "1", features = ["v4", "v7", "serde"] }`.

## Columnar data: `polars`

For columnar data, joins, group-by and lazy plans.

```rust
use polars::prelude::*;

fn totals() -> PolarsResult<DataFrame> {
    LazyCsvReader::new(PlPath::new("events.csv"))
        .finish()?
        .group_by([col("user_id")])
        .agg([col("amount").sum().alias("total")])
        .sort(["total"], SortMultipleOptions::default())
        .collect()
}
```

The Rust API mirrors the Python one. Stay on the lazy API and call `.collect()` at the end so the optimiser sees the whole plan. Polars changes constructor and option types often; check docs.rs for the pinned version (older releases take a plain `&str` path in `LazyCsvReader::new`).

## Channels

- Bounded multi-producer, single-consumer: `tokio::sync::mpsc` (async) or `flume` (sync and async).
- Fan-out with every subscriber seeing every value: `tokio::sync::broadcast`.
- Latest-value publication: `tokio::sync::watch`.
- Single reply: `tokio::sync::oneshot`.

`std::sync::mpsc` serves synchronous-only code, and `crossbeam-channel` earns its weight when rendezvous channels or select over many sync channels matter. More in [concurrency.md](concurrency.md).

## Coordinate spaces and 2D math: `euclid`

```rust
use euclid::Point2D;

struct ScreenSpace;
struct WorldSpace;

type ScreenPoint = Point2D<f32, ScreenSpace>;
type WorldPoint = Point2D<f32, WorldSpace>;

let cursor: ScreenPoint = Point2D::new(120.0, 240.0);
let player: WorldPoint = Point2D::new(3.5, 1.2);

// let mistake = cursor + player; // type error: the spaces differ
```

Generalise the pattern to your own domains; see [type-state.md](type-state.md).

## Property tests: `proptest`

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn parse_roundtrips(s in "[a-zA-Z0-9_-]{1,50}") {
        let parsed = parse(&s).unwrap();
        prop_assert_eq!(parsed.to_string(), s);
    }
}
```

`quickcheck` is older with weaker shrinking. `proptest` gives shrinking, a persisted regression corpus and composable strategies. Details: [proptest-insta.md](proptest-insta.md).

## Snapshot tests: `insta`

```rust
#[test]
fn renders_help() {
    insta::assert_snapshot!(render(&example_input()));
}

#[test]
fn serializes_stably() {
    insta::assert_json_snapshot!(serializable_value());
}
```

`cargo insta review` (after `cargo install cargo-insta`) walks through changed snapshots interactively.

## Benchmarks: `criterion` or `divan`

Both run on stable Rust.

```rust
use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

fn bench_parse(c: &mut Criterion) {
    let input = std::fs::read_to_string("samples/large.txt").expect("sample file");
    c.bench_function("parse_large", |b| b.iter(|| parse(black_box(&input))));
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
```

Declare the bench target with `[[bench]] name = "parse" harness = false` in `Cargo.toml`. Run `cargo bench`; HTML reports land in `target/criterion/`. Compare against a baseline with `cargo bench -- --save-baseline main` followed by `cargo bench -- --baseline main`. `divan` offers attribute-based benchmarks with less boilerplate. Benchmark files read fixtures with `expect`; they sit under `benches/`, which the lint configuration exempts.

## Concurrency model checking: `loom`

For lock-free or atomic-heavy code (channels, reference counts, hazard pointers). Pattern in [concurrency.md](concurrency.md); invocation in [../rust-ub/miri-sanitizers-loom.md](../rust-ub/miri-sanitizers-loom.md).

## Arena allocation: `bumpalo`

```rust
use bumpalo::Bump;

let bump = Bump::new();
let node = bump.alloc(Node { value: 42, next: None });
let s: &str = bump.alloc_str("hello");
// Everything frees together when `bump` drops.
```

Use it for parser nodes, syntax trees and per-request scratch data. Short-lived owned data allocates far faster here than on the general heap. `bumpalo` does not run destructors for values placed in it, so keep `Drop`-bearing types out or use `bumpalo::boxed::Box`.

## Browser WASM clients: the `gloo` family

For WASM in a browser use `gloo-net` for fetch and `gloo-storage` for local storage. Reach for raw `web-sys` only when DOM-level APIs are needed.

## Lazy statics: `std::sync::LazyLock` (since 1.80)

```rust
use std::sync::LazyLock;

static CONFIG: LazyLock<Config> = LazyLock::new(|| Config::from_env().expect("valid environment"));
```

`lazy_static!` predates std, and `once_cell` has been absorbed into `LazyLock` and `OnceLock`. A panic in the initialiser poisons the static; keep initialisers fallible at start-up rather than lazy where a failure should stop the process early.

## Hash maps: `HashMap` with a faster hasher on hot paths

```rust
use std::collections::HashMap;

use ahash::RandomState;

type FastMap<K, V> = HashMap<K, V, RandomState>;
let mut counters: FastMap<String, u64> = FastMap::default();
```

The default SipHash resists hash flooding. Inside a hot loop over trusted keys, `ahash` (or `foldhash`, `rustc-hash`) is typically two to five times faster; measure before swapping. Sorted iteration calls for `BTreeMap`. For a handful of small keys, a `Vec<(K, V)>` can beat both.

## File I/O: `tokio::fs` or `std::fs`

```rust
let contents = tokio::fs::read_to_string("data.json").await?;
```

Large files: `tokio::fs::File` with `tokio::io::BufReader`. Random access: `memmap2`, wrapped following [unsafe-discipline.md](unsafe-discipline.md). `tokio::fs` runs blocking calls on a thread pool, so a tight loop of tiny reads is faster with `std::fs` inside `spawn_blocking`.

## Decision tree

```
What are you shipping?
|- HTTP server        -> axum + sqlx + tracing + jiff + tokio
|- HTTP client        -> reqwest (+ tokio)
|- CLI                -> clap + color-eyre + tracing + indicatif (progress) + dialoguer (prompts)
|- TUI                -> ratatui + crossterm
|- Background worker  -> tokio; ETL -> polars + duckdb
|- Game / graphics    -> wgpu + winit + euclid (or bevy for a full engine)
|- WASM front end     -> leptos (or dioxus / yew) + wasm-bindgen + gloo
|- Embedded           -> embassy (async on bare metal)
|- FFI                -> cxx (C++) / pyo3 (Python) / cbindgen (header generation)
`- A script           -> rust-script (see one-liners.md)
```

## Vetting a dependency

Before adding a crate not on this list, run these checks and record the answers in the plan or PR:

1. Is it maintained? `cargo deny check` reports yanked and advisory-flagged crates; also read the last release date and open-issue trend on the registry page.
2. Does it offer a `serde` feature? Boundary types should serialise.
3. Does it integrate with tokio (`AsyncRead` and `AsyncWrite`)? Mixed runtimes cost threads and complexity.
4. How much `unsafe` does it contain? `cargo geiger` counts it; a crate with unsafe regions should show Miri runs in its CI.
5. What does it add to build time and binary size? `cargo tree -e features` and `cargo bloat` answer both.
6. Is the license on the allow-list in `deny.toml`?

Pin to a caret range, commit `Cargo.lock` for binaries, and run `cargo machete` to drop unused crates when the change lands.
