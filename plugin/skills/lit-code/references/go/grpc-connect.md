# RPC: Connect-Go, grpc-go, protovalidate

`connectrpc.com/connect` is the default RPC stack. Its servers speak the Connect protocol, gRPC and gRPC-Web from one handler, run on ordinary `net/http`, and accept the same middleware as a REST service. Raw `grpc-go` is the fallback for gRPC-only features that Connect does not provide.

---

## Connect or grpc-go

| Need | Choice |
|---|---|
| Unary, server-streaming and client-streaming calls | Connect |
| Browser clients without a translating proxy | Connect (native Connect and gRPC-Web protocols) |
| HTTP/1.1 fallback for restrictive networks | Connect (gRPC itself requires HTTP/2 end to end) |
| Plain `curl` debugging of unary calls | Connect (JSON over HTTP POST works) |
| Bidirectional streaming with per-frame control | grpc-go, or Connect over HTTP/2 when its streaming model suffices |
| Mesh or proxy tooling that expects the grpc-go server library (xDS, custom balancers) | grpc-go |

Choose Connect unless a row in the lower half applies. A Connect server also answers stock gRPC clients, so adopting it does not strand existing callers.

---

## Toolchain: buf

```bash
go install github.com/bufbuild/buf/cmd/buf@latest
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest
```

`buf` replaces `protoc` for linting, formatting, breaking-change detection and code generation. With remote plugins (below) the two `protoc-gen-*` installs are optional, because the generator runs on Buf's side; local plugins work offline and in sandboxes without network access.

Validation at run time uses the protovalidate library (`buf.build/go/protovalidate`) through the `connectrpc.com/validate` interceptor. It needs no generated validation code, only the `buf/validate/validate.proto` import.

---

## Layout

```text
proto/
  buf.yaml
  buf.gen.yaml
  buf.lock
  myservice/v1/
    user.proto
    auth.proto

gen/
  myservice/v1/
    user.pb.go                 # protoc-gen-go
    auth.pb.go
    myservicev1connect/        # protoc-gen-connect-go
      user.connect.go
      auth.connect.go
```

Commit `gen/`. Generated code is part of the API contract, and CI regenerates it to prove it matches the `.proto` files.

## `buf.yaml`

```yaml
version: v2
modules:
  - path: proto
deps:
  - buf.build/bufbuild/protovalidate
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

Run `buf dep update` once to write `buf.lock`.

## `buf.gen.yaml`

```yaml
version: v2
managed:
  enabled: true
  override:
    - file_option: go_package_prefix
      value: github.com/your-org/myservice/gen
plugins:
  - remote: buf.build/protocolbuffers/go
    out: gen
    opt: [paths=source_relative]
  - remote: buf.build/connectrpc/go
    out: gen
    opt: [paths=source_relative]
```

For an offline or sandboxed environment, replace `remote:` with `local: protoc-gen-go` and `local: protoc-gen-connect-go` (the binaries installed above).

## Taskfile target

```yaml
gen:proto:
  cmds:
    - buf lint
    - buf format -w
    - buf generate
  sources:
    - proto/**/*.proto
    - buf.yaml
    - buf.gen.yaml
```

CI runs `buf lint`, `buf breaking --against '.git#branch=main'`, then `buf generate` followed by `git diff --exit-code gen/`. The breaking check protects deployed clients from a field renumbering or removal.

---

## A `.proto` with constraints

```proto
syntax = "proto3";

package myservice.v1;

import "buf/validate/validate.proto";
import "google/protobuf/timestamp.proto";

option go_package = "github.com/your-org/myservice/gen/myservice/v1;myservicev1";

service UserService {
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc StreamEvents(StreamEventsRequest) returns (stream Event);
}

message CreateUserRequest {
  string email = 1 [(buf.validate.field).string.email = true];
  string username = 2 [
    (buf.validate.field).string.min_len = 3,
    (buf.validate.field).string.max_len = 32,
    (buf.validate.field).string.pattern = "^[a-zA-Z0-9_]+$"
  ];
  int32 age = 3 [
    (buf.validate.field).int32.gte = 13,
    (buf.validate.field).int32.lte = 130
  ];
}

message CreateUserResponse {
  User user = 1;
}

message GetUserRequest {
  string id = 1 [(buf.validate.field).string.uuid = true];
}

message GetUserResponse {
  User user = 1;
}

message User {
  string id = 1;
  string email = 2;
  string username = 3;
  google.protobuf.Timestamp created_at = 4;
}

message StreamEventsRequest {
  string user_id = 1 [(buf.validate.field).string.uuid = true];
}

message Event {
  string kind = 1;
  google.protobuf.Timestamp at = 2;
}
```

`protovalidate` succeeds the older `protoc-gen-validate` plugin. Constraints live in the schema, run in every language that has a protovalidate runtime, and support CEL expressions for cross-field rules.

Evolve schemas with these habits: add fields with new numbers, reserve removed numbers and names (`reserved 4; reserved "legacy_field";`), keep enums open with a `_UNSPECIFIED = 0` entry, and avoid reusing a field number for another meaning.

---

## Server

```go
package main

import (
    "context"
    "errors"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "connectrpc.com/connect"
    "connectrpc.com/validate"

    myservicev1 "github.com/your-org/myservice/gen/myservice/v1"
    "github.com/your-org/myservice/gen/myservice/v1/myservicev1connect"
)

type UserServer struct {
    svc *UserService
}

func (s *UserServer) CreateUser(
    ctx context.Context,
    req *connect.Request[myservicev1.CreateUserRequest],
) (*connect.Response[myservicev1.CreateUserResponse], error) {
    // The validate interceptor has already enforced the .proto constraints.
    user, err := s.svc.Create(ctx, req.Msg.GetEmail(), req.Msg.GetUsername(), req.Msg.GetAge())
    if err != nil {
        return nil, mapError(err)
    }
    return connect.NewResponse(&myservicev1.CreateUserResponse{User: userToProto(user)}), nil
}

func main() {
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    interceptors := connect.WithInterceptors(
        loggingInterceptor(slog.Default()),
        validate.NewInterceptor(),
    )

    mux := http.NewServeMux()
    mux.Handle(myservicev1connect.NewUserServiceHandler(
        &UserServer{svc: newUserService()},
        interceptors,
    ))

    // Go 1.24 or newer serves unencrypted HTTP/2 (gRPC without TLS) from the standard library.
    protocols := new(http.Protocols)
    protocols.SetHTTP1(true)
    protocols.SetUnencryptedHTTP2(true)

    srv := &http.Server{
        Addr:              ":8080",
        Handler:           mux,
        Protocols:         protocols,
        ReadHeaderTimeout: 10 * time.Second,
    }

    go func() {
        <-ctx.Done()
        shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
        defer cancel()
        _ = srv.Shutdown(shutdownCtx)
    }()

    slog.Info("rpc server listening", slog.String("addr", srv.Addr))
    if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
        slog.Error("rpc server stopped", slog.Any("err", err))
        os.Exit(1)
    }
}
```

On Go 1.23, wrap the mux with `h2c.NewHandler(mux, &http2.Server{})` from `golang.org/x/net/http2/h2c` instead of `Protocols`. Production deployments terminate TLS (HTTP/2 over ALPN) at the server or at a proxy that forwards HTTP/2.

A Connect handler is an `http.Handler`, so the same `ServeMux` can host REST routes, health checks and metrics. Useful siblings from the Connect organization: `connectrpc.com/grpchealth` (health service), `connectrpc.com/grpcreflect` (reflection for `grpcurl`), `connectrpc.com/otelconnect` (OpenTelemetry interceptor) and `connectrpc.com/cors` (browser clients).

---

## Mapping errors to Connect codes

```go
func mapError(err error) error {
    switch {
    case err == nil:
        return nil
    case errors.Is(err, domain.ErrInvalidEmail), errors.Is(err, domain.ErrInvalidUsername):
        return connect.NewError(connect.CodeInvalidArgument, err)
    case errors.Is(err, domain.ErrUserNotFound):
        return connect.NewError(connect.CodeNotFound, err)
    case errors.Is(err, domain.ErrUnauthorized):
        return connect.NewError(connect.CodeUnauthenticated, err)
    case errors.Is(err, domain.ErrUserExists):
        return connect.NewError(connect.CodeAlreadyExists, err)
    case errors.Is(err, context.DeadlineExceeded):
        return connect.NewError(connect.CodeDeadlineExceeded, err)
    case errors.Is(err, context.Canceled):
        return connect.NewError(connect.CodeCanceled, err)
    default:
        slog.Error("unmapped rpc error", slog.Any("err", err))
        return connect.NewError(connect.CodeInternal, errors.New("internal error"))
    }
}
```

Connect codes match gRPC codes one to one. Attach structured detail with `connect.NewErrorDetail` and a message from `google.rpc.*` types (for example `errdetails.BadRequest`) when clients need field-level feedback. The internal fallback returns a generic message and logs the cause, which keeps SQL text and hostnames out of responses.

---

## Interceptors

```go
func loggingInterceptor(logger *slog.Logger) connect.UnaryInterceptorFunc {
    return func(next connect.UnaryFunc) connect.UnaryFunc {
        return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
            start := time.Now()
            res, err := next(ctx, req)
            attrs := []slog.Attr{
                slog.String("procedure", req.Spec().Procedure),
                slog.Duration("elapsed", time.Since(start)),
            }
            if err != nil {
                attrs = append(attrs,
                    slog.String("code", connect.CodeOf(err).String()),
                    slog.Any("err", err),
                )
                logger.LogAttrs(ctx, slog.LevelWarn, "rpc failed", attrs...)
                return res, err
            }
            logger.LogAttrs(ctx, slog.LevelInfo, "rpc ok", attrs...)
            return res, nil
        }
    }
}
```

A unary interceptor covers unary calls only. For streams implement the complete `connect.Interceptor` interface (`WrapUnary`, `WrapStreamingClient`, `WrapStreamingHandler`). Auth follows the same shape: read `req.Header().Get("Authorization")`, verify, and place the subject in the context with a typed key (see `concurrency.md`).

Order interceptors outermost to innermost: recovery, logging, auth, validation. Validation sits late so unauthenticated callers fail before any schema work, and `connect.WithRecover` handles panics in handlers.

---

## Server streaming

```go
func (s *UserServer) StreamEvents(
    ctx context.Context,
    req *connect.Request[myservicev1.StreamEventsRequest],
    stream *connect.ServerStream[myservicev1.Event],
) error {
    events, errs := s.svc.Subscribe(ctx, req.Msg.GetUserId())
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case e, ok := <-events:
            if !ok {
                return nil
            }
            if err := stream.Send(eventToProto(e)); err != nil {
                return err
            }
        case err := <-errs:
            return mapError(err)
        }
    }
}
```

The loop follows the same shape as SSE in `backend-stack.md`: honour `ctx.Done()` so a disconnected client stops upstream work. Keep the `Subscribe` goroutines tied to `ctx` as well, so a cancelled stream shuts them down (verified by `goleak` in tests).

---

## Client

```go
client := myservicev1connect.NewUserServiceClient(
    &http.Client{Timeout: 0}, // per-call deadlines come from ctx
    "https://api.example.com",
    connect.WithInterceptors(retryInterceptor(), tracingInterceptor()),
)

ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

res, err := client.CreateUser(ctx, connect.NewRequest(&myservicev1.CreateUserRequest{
    Email:    "a@b.com",
    Username: "alice",
    Age:      30,
}))
if err != nil {
    if connectErr := new(connect.Error); errors.As(err, &connectErr) {
        slog.Error("rpc failed",
            slog.String("code", connectErr.Code().String()),
            slog.String("message", connectErr.Message()),
        )
    }
    return err
}
slog.Info("created", slog.String("id", res.Msg.GetUser().GetId()))
```

The default protocol is Connect. Add `connect.WithGRPC()` to speak gRPC framing against a grpc-go server, or `connect.WithGRPCWeb()` for gRPC-Web proxies. Share one `http.Client` (and its transport) per process, because it owns the connection pool. For HTTP/2 over cleartext in tests or internal links on Go 1.24 or newer, build the client transport with `Protocols` set to unencrypted HTTP/2 only.

Calls require an explicit deadline. A request without one waits as long as the server allows.

---

## Testing RPC services

```go
func TestCreateUser_rejects_short_username(t *testing.T) {
    // Given
    mux := http.NewServeMux()
    mux.Handle(myservicev1connect.NewUserServiceHandler(
        &UserServer{svc: fakeService{}},
        connect.WithInterceptors(validate.NewInterceptor()),
    ))
    srv := httptest.NewServer(mux)
    t.Cleanup(srv.Close)
    client := myservicev1connect.NewUserServiceClient(srv.Client(), srv.URL)

    // When
    _, err := client.CreateUser(t.Context(), connect.NewRequest(&myservicev1.CreateUserRequest{
        Email: "a@b.com", Username: "ab", Age: 30,
    }))

    // Then
    require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
}
```

`httptest.NewServer` exercises the whole stack: serialization, interceptors and status mapping. `t.Context()` needs Go 1.24; use `context.Background()` on older toolchains. Test streaming by reading from `stream.Receive()` until it returns false and then checking `stream.Err()`.

---

## When raw grpc-go is needed

```go
lis, err := net.Listen("tcp", ":8080")
if err != nil {
    return fmt.Errorf("listen: %w", err)
}
srv := grpc.NewServer(grpc.ChainUnaryInterceptor(loggingUnary, recoveryUnary))
myservicev1grpc.RegisterUserServiceServer(srv, &userServer{})
return srv.Serve(lis)
```

Code generation comes from `protoc-gen-go-grpc`, a different plugin from `protoc-gen-connect-go`. Both can appear in one `buf.gen.yaml`; a service picks the package it imports. Most teams choose one per service.

---

## When RPC is the wrong boundary

Browsers, mobile apps, third-party developers and ad hoc scripts do well with REST plus OpenAPI. RPC pays off between services inside one organization. At the public boundary, JSON over HTTP wins on debuggability and tooling. `oapi-codegen` produces Go servers and clients from an OpenAPI 3 document in the same generated-contract spirit, with the same parse-at-the-edge discipline from `data-modeling.md`.

## Pitfalls

- Hand-editing files under `gen/`. Edit the `.proto` and regenerate.
- Skipping `buf breaking` on a shared schema.
- Returning raw `err` from handlers. Unwrapped errors turn into `CodeUnknown`; map explicitly.
- Using `time.Now()` deadlines on the server side in place of the incoming `ctx`; Connect propagates client deadlines through the context.
- Streaming handlers that ignore `ctx.Done()`.
- Large messages: the default read limit is generous but finite. Set `connect.WithReadMaxBytes` deliberately on public endpoints.

## Sources

- Connect for Go: https://connectrpc.com/docs/go/getting-started
- Buf documentation: https://buf.build/docs
- protovalidate: https://github.com/bufbuild/protovalidate
- connectrpc.com/validate: https://github.com/connectrpc/validate-go
- Connect compared with gRPC: https://connectrpc.com/docs/introduction
