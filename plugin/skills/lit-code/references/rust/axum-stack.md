# axum, sqlx, tracing and tower: the HTTP API Stack

The production HTTP service shape for Rust in 2026. The code targets axum 0.8, whose breaking changes shape the examples: path parameters are written `/{id}` (the old `/:id` form panics at start-up), extractor traits no longer need `#[async_trait]`, and `Option<T>` extractors require `OptionalFromRequestParts`. Verify every call against docs.rs for the versions in `Cargo.lock`.

## Cargo.toml dependencies

```toml
[dependencies]
axum = { version = "0.8", features = ["macros", "tracing", "ws", "multipart"] }
tokio = { version = "1", features = ["full"] }
tower = "0.5"
tower-http = { version = "0.6", features = [
    "trace", "compression-gzip", "compression-br", "timeout", "cors",
    "request-id", "sensitive-headers", "limit", "set-header",
] }

# Errors and observability
anyhow = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
color-eyre = "0.6"

# Database
sqlx = { version = "0.8", features = [
    "runtime-tokio", "tls-rustls", "postgres", "uuid", "time", "macros", "migrate", "json",
] }

# Serialization and validation
serde = { version = "1", features = ["derive"] }
serde_json = "1"
validator = { version = "0.20", features = ["derive"] }

# Types
uuid = { version = "1", features = ["v4", "v7", "serde"] }
time = { version = "0.3", features = ["serde-well-known"] }

# Configuration and secrets
config = { version = "0.15", features = ["toml"] }
secrecy = { version = "0.10", features = ["serde"] }

# OpenAPI (recommended)
utoipa = { version = "5", features = ["axum_extras", "uuid", "time"] }
utoipa-axum = "0.2"
utoipa-swagger-ui = { version = "9", features = ["axum"] }

[dev-dependencies]
tower = { version = "0.5", features = ["util"] }
http-body-util = "0.1"
```

Timestamps use the `time` crate here because sqlx maps `timestamptz` to `time::OffsetDateTime` natively. Convert to `jiff` in the domain layer when the rest of the program uses it (see [libraries.md](libraries.md)).

## Project structure

```text
src/
  main.rs            binary entry
  lib.rs             re-exports and app builder
  config.rs          Settings type and loader
  state.rs           AppState, shared by clone
  error.rs           AppError and its IntoResponse impl
  extract.rs         ValidatedJson and other custom extractors
  routes/
    mod.rs           Router composition
    health.rs
    users.rs
  middleware/
    mod.rs
    auth.rs
  db/
    mod.rs           repository functions, one module per aggregate
migrations/          sqlx migrations
config/              default.toml, dev.toml, prod.toml
tests/
  users.rs
```

Business logic lives in repository and service functions that take plain arguments. Handlers extract, call, and map the result to a response; they hold no SQL beyond a single repository call.

## Error type

```rust
// src/error.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found")]
    NotFound,
    #[error("unauthorized")]
    Unauthorized,
    #[error("validation: {0}")]
    Validation(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("internal")]
    Internal(#[from] anyhow::Error),
    #[error("database")]
    Database(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            Self::NotFound => (StatusCode::NOT_FOUND, "not_found", self.to_string()),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized", self.to_string()),
            Self::Validation(m) => (StatusCode::UNPROCESSABLE_ENTITY, "validation", m.clone()),
            Self::Conflict(m) => (StatusCode::CONFLICT, "conflict", m.clone()),
            Self::Database(e) => {
                tracing::error!(error = ?e, "database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "database", "internal error".to_owned())
            }
            Self::Internal(e) => {
                tracing::error!(error = ?e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal", "internal error".to_owned())
            }
        };
        (status, Json(json!({ "error": { "code": code, "message": message } }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

Handlers return `AppResult<T>`, and the `IntoResponse` impl translates. `sqlx::Error` and `anyhow::Error` convert through `From`. Internal-bucket errors are logged in full and answered with a fixed message, so database details and `Debug` output never reach a client.

## Configuration and secrets

```rust
// src/config.rs
use secrecy::SecretString;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct Settings {
    pub bind: String,
    pub db: Database,
    pub jwt_secret: SecretString,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct Database {
    pub url: SecretString,
    pub max_connections: u32,
}

impl Settings {
    pub fn load() -> anyhow::Result<Self> {
        let env = std::env::var("APP_ENV").unwrap_or_else(|_| "dev".to_owned());
        let cfg = config::Config::builder()
            .add_source(config::File::with_name("config/default").required(false))
            .add_source(config::File::with_name(&format!("config/{env}")).required(false))
            .add_source(config::Environment::with_prefix("APP").separator("__"))
            .build()?;
        Ok(cfg.try_deserialize()?)
    }
}
```

`SecretString` prints as `[REDACTED]` in `Debug`, which prevents log leaks. Call `.expose_secret()` (from `secrecy::ExposeSecret`) only at the point of use. Environment variables such as `APP__DB__URL` override files, which gives containers a clean injection path.

## AppState

```rust
// src/state.rs
use std::{sync::Arc, time::Duration};

use secrecy::ExposeSecret as _;
use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::config::Settings;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Settings>,
    pub http: reqwest::Client,
}

impl AppState {
    pub async fn new(config: Settings) -> anyhow::Result<Self> {
        let db = PgPoolOptions::new()
            .max_connections(config.db.max_connections)
            .acquire_timeout(Duration::from_secs(3))
            .connect(config.db.url.expose_secret())
            .await?;
        sqlx::migrate!("./migrations").run(&db).await?;
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self { db, config: Arc::new(config), http })
    }
}
```

`PgPool` and `reqwest::Client` are already cheap handles over shared inner state; `Clone` on `AppState` costs a few reference-count bumps.

## Validated extractor

axum's `Json<T>` rejects malformed bodies with its own response shape. A wrapper keeps every failure on the `AppError` path and runs `validator` once:

```rust
// src/extract.rs
use axum::{
    extract::{FromRequest, Request},
    Json,
};
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::error::AppError;

pub struct ValidatedJson<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Validate,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|rejection| AppError::Validation(rejection.body_text()))?;
        value.validate().map_err(|e| AppError::Validation(e.to_string()))?;
        Ok(Self(value))
    }
}
```

## Route handlers

```rust
// src/routes/users.rs
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    extract::ValidatedJson,
    state::AppState,
};

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUser {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[tracing::instrument(skip(state, body))]
pub async fn create_user(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateUser>,
) -> AppResult<(StatusCode, Json<User>)> {
    let id = Uuid::now_v7();
    let user = sqlx::query_as!(
        User,
        "INSERT INTO users (id, email, name, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, email, name, created_at",
        id,
        body.email,
        body.name
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            AppError::Conflict("email already exists".to_owned())
        }
        _ => AppError::Database(e),
    })?;

    Ok((StatusCode::CREATED, Json(user)))
}

#[tracing::instrument(skip(state))]
pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<User>> {
    sqlx::query_as!(
        User,
        "SELECT id, email, name, created_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(&state.db)
    .await?
    .map(Json)
    .ok_or(AppError::NotFound)
}
```

`skip(state, body)` keeps the pool and request body out of span fields; add `fields(user_id = %id)` for the identifiers worth indexing. `serde(with = "time::serde::rfc3339")` writes ISO-8601 strings instead of the default tuple form.

## Router assembly

```rust
// src/routes/mod.rs
use std::time::Duration;

use axum::{
    http::{header, StatusCode},
    routing::{get, post},
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    sensitive_headers::SetSensitiveRequestHeadersLayer,
    timeout::TimeoutLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
    LatencyUnit,
};

use crate::state::AppState;

mod health;
mod users;

pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(health::handler))
        .route("/users", post(users::create_user))
        .route("/users/{id}", get(users::get_user))
        .with_state(state);

    Router::new().nest("/api/v1", api).layer(
        ServiceBuilder::new()
            .layer(SetSensitiveRequestHeadersLayer::new([header::AUTHORIZATION, header::COOKIE]))
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
            .layer(
                TraceLayer::new_for_http()
                    .make_span_with(DefaultMakeSpan::new().include_headers(false))
                    .on_response(DefaultOnResponse::new().latency_unit(LatencyUnit::Millis)),
            )
            .layer(PropagateRequestIdLayer::x_request_id())
            .layer(TimeoutLayer::with_status_code(
                StatusCode::REQUEST_TIMEOUT,
                Duration::from_secs(30),
            ))
            .layer(RequestBodyLimitLayer::new(1024 * 1024))
            .layer(CompressionLayer::new())
            .layer(CorsLayer::permissive()), // replace with an explicit origin list before production
    )
}
```

`ServiceBuilder` applies the first layer outermost. Order choices here: sensitive-header marking comes first so later layers never log credentials; tracing sits outside the timeout so timeouts appear in logs; compression is inside tracing so the trace sees original sizes. `TimeoutLayer::with_status_code` exists in recent 0.6 releases; older 0.6 versions use `TimeoutLayer::new(duration)`.

## Main with graceful shutdown

```rust
// src/main.rs
use my_app::{config::Settings, routes, state::AppState};

#[tokio::main]
async fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    init_tracing();

    let config = Settings::load()?;
    let bind = config.bind.clone();
    let state = AppState::new(config).await?;
    let app = routes::router(state);

    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!(addr = %bind, "listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

fn init_tracing() {
    use tracing_subscriber::{fmt, EnvFilter};
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,hyper=warn,tower_http=info"));
    fmt().with_env_filter(filter).with_target(false).json().init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if tokio::signal::ctrl_c().await.is_err() {
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    tracing::info!("shutting down");
}
```

When a handler registration fails, the corresponding branch parks forever instead of panicking, so the process never exits early for a missing signal source.

## Middleware: bearer authentication

```rust
// src/middleware/auth.rs
use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};

use crate::{error::AppError, state::AppState};

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: uuid::Uuid,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let claims = verify_jwt(token, &state.config.jwt_secret)?;
    request.extensions_mut().insert(AuthUser { id: claims.sub });
    Ok(next.run(request).await)
}
```

Attach it to the sub-routes that need it with `.route_layer(axum::middleware::from_fn_with_state(state.clone(), require_auth))`. `route_layer` runs only for matched routes, so 404 responses stay unauthenticated. Handlers read the identity with `Extension<AuthUser>`. `verify_jwt` belongs to a JWT crate such as `jsonwebtoken`; it returns `Result<Claims, AppError>` and compares signatures in constant time.

## Testing handlers

```rust
// tests/users.rs
use axum::{body::Body, http::Request};
use http_body_util::BodyExt as _;
use tower::ServiceExt as _;

#[sqlx::test(migrations = "./migrations")]
async fn creates_user(pool: sqlx::PgPool) {
    let state = my_app::state::AppState::for_tests(pool);
    let app = my_app::routes::router(state);

    let request = Request::builder()
        .uri("/api/v1/users")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"email":"a@example.com","name":"A"}"#))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), 201);

    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let user: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(user["email"], "a@example.com");
}
```

`#[sqlx::test]` provisions a fresh database per test, applies the migrations and passes the pool in, which keeps tests independent and parallel. `oneshot` calls the router directly with no socket, so there are no port collisions. `AppState::for_tests` is a constructor that builds the state around an existing pool.

## OpenAPI with utoipa

Derive schemas on the data types, annotate handlers with `#[utoipa::path]`, and serve Swagger UI:

```rust
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(info(title = "my-app", version = "0.1.0"))]
struct ApiDoc;

#[utoipa::path(
    post,
    path = "/users",
    request_body = CreateUser,
    responses((status = 201, body = User), (status = 409, description = "email exists"))
)]
pub async fn create_user(/* ... */) { /* ... */ }

fn docs_router() -> axum::Router {
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(users::create_user))
        .routes(routes!(users::get_user))
        .split_for_parts();
    router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", api))
}
```

`CreateUser` and `User` also derive `ToSchema`. `routes!` groups handlers that share a path; separate paths need separate `.routes(..)` calls. Mount the documentation routes behind authentication or disable them in production when the API is not public.

## Production checklist

- Bind `0.0.0.0` in containers and `127.0.0.1` for local-only services.
- Set `RUST_LOG=info,sqlx=warn` or rely on the `EnvFilter` default above.
- Write JSON logs to stdout and ship them with Vector, Fluent Bit or Loki.
- Run migrations at start-up and fail fast when the schema does not match.
- Make the health endpoint touch the database, so load balancers detect a dead pool. Provide a separate liveness route that does not.
- Rate-limit public endpoints with `tower_governor` or an equivalent token-bucket layer; `tower::limit::RateLimitLayer` limits globally and is not per-client.
- Bound request size with `RequestBodyLimitLayer`; axum's own `DefaultBodyLimit` of 2 MB covers only the built-in extractors.
- Replace `CorsLayer::permissive()` with explicit origins, methods and headers.
- Strip credentials from traces with `SetSensitiveRequestHeadersLayer`.
- Drain connections on SIGTERM with `with_graceful_shutdown` so deploys roll without dropped requests.
- Build container images with `cargo chef` for cached dependency layers.

## Common mistakes

1. **Old path syntax.** `/users/:id` panics when the router is built under axum 0.8. Use `/users/{id}`; a literal brace is written `{{`.
2. **Forgetting `error_for_status()?` on outbound `reqwest` calls.** A 404 or 500 reply passes as success.
3. **Returning `Result<T, sqlx::Error>` from handlers.** Database detail leaks to clients. Route every error through `AppError`.
4. **Plain `Json<T>` in front of validation.** Malformed bodies produce axum's default rejection body. Use `ValidatedJson<T>`.
5. **Holding a pooled connection across a slow external call.** The pool drains. Acquire late and release early, or pass `&PgPool` and let each query borrow.
6. **No `#[tracing::instrument]` on handlers.** Per-request span correlation disappears.
7. **Mixing blocking calls into handlers.** Move CPU-heavy or synchronous work into `spawn_blocking`.
8. **Sharing mutable state through `Arc<Mutex<..>>` for data that belongs in the database.** Keep process memory for caches and handles.
