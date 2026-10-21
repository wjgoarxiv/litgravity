# Data Modeling: Three Layers of Parsing

Go has neither Pydantic nor Zod, and it does not need them when three layers are wired deliberately. Input is parsed once at each layer boundary into the next layer's types, and code past that boundary treats the types as proof.

## The layers

```text
HTTP / RPC / CLI / env / files        raw bytes and strings, untrusted
        |
        |  Layer 1: validator/v10 struct tags (or protovalidate for proto)
        v
Wire DTOs (handlers package)          shape and ranges checked
        |
        |  Layer 2: smart constructors  NewEmail(s) -> (Email, error)
        v
Domain types (internal/domain)        invariants proven by the type; no validation inside
        |
        |  Layer 3: explicit mappers between domain types and sqlc rows
        v
Storage rows (internal/store/sqlc)    generated, tag-free, mapped by hand
```

A domain function that receives a raw string and validates it signals that an upstream boundary failed. Move the check to the boundary and change the parameter to the domain type.

---

## Layer 1: HTTP boundary with `go-playground/validator/v10`

```go
package handlers

import (
    "errors"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/go-playground/validator/v10"

    "myservice/internal/domain"
)

// CreateUserRequest is the wire format. Tags drive shape validation only.
type CreateUserRequest struct {
    Email    string `json:"email"    binding:"required,email"`
    Username string `json:"username" binding:"required,alphanum,min=3,max=32"`
    Age      int    `json:"age"      binding:"required,gte=13,lte=130"`
    Country  string `json:"country"  binding:"required,iso3166_1_alpha2"`
}

func (h *Handler) CreateUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        var vErr validator.ValidationErrors
        if errors.As(err, &vErr) {
            c.JSON(http.StatusBadRequest, gin.H{"errors": fieldErrors(vErr)})
            return
        }
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
        return
    }

    email, err := domain.NewEmail(req.Email)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    username, err := domain.NewUsername(req.Username)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.svc.Create(c.Request.Context(), email, username, req.Age)
    if err != nil {
        h.writeServiceError(c, err)
        return
    }
    c.JSON(http.StatusCreated, user)
}

func fieldErrors(vErr validator.ValidationErrors) map[string]string {
    out := make(map[string]string, len(vErr))
    for _, fe := range vErr {
        out[fe.Field()] = fe.Tag() + "(" + fe.Param() + ")"
    }
    return out
}
```

gin reads the `binding` tag by default. Outside gin, create a `validator.New(validator.WithRequiredStructEnabled())` instance and call `Struct(v)`, setting `SetTagName("validate")` or reusing `binding` as you prefer. Put `fe.Namespace()` into error output when nested structs make field names ambiguous, and register `RegisterTagNameFunc` so errors report the JSON field name rather than the Go field name:

```go
v.RegisterTagNameFunc(func(f reflect.StructField) string {
    name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
    if name == "-" {
        return ""
    }
    return name
})
```

### Tag reference

| Tag | Meaning |
|---|---|
| `required` | value differs from the type's zero value |
| `omitempty` | skip the remaining rules when empty |
| `min=N`, `max=N` | length of strings, slices and maps, or value of numbers |
| `gte`, `lte`, `gt`, `lt` | numeric comparison |
| `len=N` | exact length |
| `email` | email address |
| `url`, `http_url`, `uri` | URL forms |
| `uuid`, `uuid4`, `uuid7` | UUID text forms |
| `alphanum`, `alpha`, `numeric` | character class |
| `iso3166_1_alpha2` | country code (US, KR, JP) |
| `iso4217` | currency code (USD, KRW) |
| `oneof=a b c` | enumerated literal values |
| `dive` | apply the following rules to each element |
| `eqfield=Other` | cross-field equality (password confirmation) |
| `required_if=Field value` | conditional presence |
| `excluded_with=Field` | mutual exclusion |

Pointer fields combine with `omitempty` for optional input, and slices need `dive` to reach their elements (`binding:"required,min=1,dive,email"`).

### Custom validators

Register at start-up from an explicit function, kept out of `init()` so tests control it:

```go
func RegisterValidators() error {
    v, ok := binding.Validator.Engine().(*validator.Validate)
    if !ok {
        return errors.New("gin validator engine is not validator/v10")
    }
    return v.RegisterValidation("strongpassword", validateStrongPassword)
}

func validateStrongPassword(fl validator.FieldLevel) bool {
    s := fl.Field().String()
    return len(s) >= 12 && hasUpper(s) && hasDigit(s) && hasSymbol(s)
}
```

Use custom validators sparingly. Business rules belong in smart constructors where unit tests can reach them without HTTP.

---

## Layer 2: domain smart constructors

Full pattern in `type-patterns.md`. The recap:

```go
package domain

import (
    "errors"
    "strings"
    "unicode"
)

var ErrInvalidUsername = errors.New("invalid username")

type Username struct{ raw string }

func NewUsername(s string) (Username, error) {
    s = strings.TrimSpace(s)
    if n := len(s); n < 3 || n > 32 {
        return Username{}, ErrInvalidUsername
    }
    for _, r := range s {
        if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
            return Username{}, ErrInvalidUsername
        }
    }
    return Username{raw: s}, nil
}

func (u Username) String() string { return u.raw }
```

Every domain type with invariants carries:

1. An unexported field that holds the raw form.
2. A `New<Type>(raw) (<Type>, error)` constructor as the single entry point.
3. A `String()` method for logs and messages.
4. `MarshalText` and `UnmarshalText` when the type crosses encoding boundaries (JSON bodies, queue payloads, config).
5. Optionally `Scan` and `Value` for `database/sql` interop, which sqlc overrides can supply.

Wrap the sentinel with detail (`fmt.Errorf("%w: length %d", ErrInvalidUsername, n)`) so logs explain the rejection while `errors.Is` still matches.

---

## Layer 3: storage rows and domain types

sqlc creates row structs from `.sql` files. Leave them tag-free and convert explicitly:

```go
package store

func (s *UserStore) Get(ctx context.Context, id domain.UserID) (domain.User, error) {
    row, err := s.q.GetUser(ctx, string(id))
    if err != nil {
        return domain.User{}, fmt.Errorf("get user %s: %w", id, err)
    }
    return rowToUser(row)
}

func rowToUser(r sqlc.User) (domain.User, error) {
    email, err := domain.NewEmail(r.Email)
    if err != nil {
        // A stored value broke the invariant: a data bug, reported as an internal error.
        return domain.User{}, fmt.Errorf("db invariant: user %s email: %w", r.ID, err)
    }
    username, err := domain.NewUsername(r.Username)
    if err != nil {
        return domain.User{}, fmt.Errorf("db invariant: user %s username: %w", r.ID, err)
    }
    return domain.User{
        ID:       domain.UserID(r.ID),
        Email:    email,
        Username: username,
        Created:  r.CreatedAt,
    }, nil
}
```

The mapper is verbose because each field is a visible decision, and a refactor shows every site that needs attention. `sqlc.yaml` overrides can bind a column type straight to a domain type once its `Scan` and `Value` methods exist; see `sqlc-pgx.md`.

---

## Discriminated unions at the boundary

A wire payload with variants carries a discriminator next to opaque data. Decode the discriminator first, then decode the payload into the matching sealed variant:

```go
type EventDTO struct {
    Type    string          `json:"type"    binding:"required,oneof=created updated deleted"`
    Payload json.RawMessage `json:"payload" binding:"required"`
}

func ParseEvent(dto EventDTO) (event.Event, error) {
    switch dto.Type {
    case "created":
        return decode[event.Created](dto.Payload)
    case "updated":
        return decode[event.Updated](dto.Payload)
    case "deleted":
        return decode[event.Deleted](dto.Payload)
    default:
        return nil, fmt.Errorf("unknown event type %q", dto.Type)
    }
}

func decode[T event.Event](raw json.RawMessage) (event.Event, error) {
    var v T
    dec := json.NewDecoder(bytes.NewReader(raw))
    dec.DisallowUnknownFields()
    if err := dec.Decode(&v); err != nil {
        return nil, fmt.Errorf("decode %T: %w", v, err)
    }
    return v, nil
}
```

The `oneof` tag rejects unknown discriminators at layer 1, and `exhaustive` on the switch (when `Type` becomes a typed enum) makes sure a new variant gets a decoder. `DisallowUnknownFields` makes misspelled keys fail loudly.

---

## Strict JSON decoding

`json.Unmarshal` ignores unknown fields and tolerates trailing data. For request bodies, build the decoder explicitly:

```go
func DecodeStrict(r io.Reader, dst any) error {
    dec := json.NewDecoder(io.LimitReader(r, 1<<20)) // 1 MiB cap
    dec.DisallowUnknownFields()
    if err := dec.Decode(dst); err != nil {
        return fmt.Errorf("decode body: %w", err)
    }
    if dec.More() {
        return errors.New("decode body: trailing data after JSON value")
    }
    return nil
}
```

Cap the body size on every public endpoint (`http.MaxBytesReader` in a middleware does this for all handlers). Treat numbers that must be exact (money, IDs above 2^53) as strings or `json.Number`.

---

## Enums: typed string constants

```go
type Status string

const (
    StatusPending Status = "pending"
    StatusActive  Status = "active"
    StatusClosed  Status = "closed"
)

func ParseStatus(s string) (Status, error) {
    switch st := Status(s); st {
    case StatusPending, StatusActive, StatusClosed:
        return st, nil
    default:
        return "", fmt.Errorf("invalid status %q", s)
    }
}

func (s *Status) UnmarshalText(b []byte) error {
    parsed, err := ParseStatus(string(b))
    if err != nil {
        return err
    }
    *s = parsed
    return nil
}

func (s Status) MarshalText() ([]byte, error) { return []byte(s), nil }
```

String-backed enums are readable in logs, stable in JSON, and survive reordering. `iota` integers on a wire or database boundary turn a reordered constant block into a silent data change. Reserve `iota` for in-process values that never persist. Enforce the allowed values at the HTTP edge with `binding:"oneof=pending active closed"` and, for exhaustiveness, switch on the type with the `exhaustive` linter on.

---

## Optional fields

In order of preference:

1. **A meaningful zero value**: `Age int` where 0 means unknown, valid only when 0 is unreachable as real data.
2. **`sql.Null*` or `pgtype` wrappers** for nullable database columns. sqlc emits them (`sql.NullString`, `pgtype.Text`, or pointers with `emit_pointers_for_null_types: true`).
3. **`*T`** at the wire boundary, to tell "field absent" from "field set to zero" in PATCH bodies.

```go
type UpdateUserRequest struct {
    Email    *string `json:"email,omitempty"    binding:"omitempty,email"`
    Username *string `json:"username,omitempty" binding:"omitempty,alphanum,min=3,max=32"`
}
```

Unwrap pointers on the way into the domain (`if req.Email != nil { ... }`) so domain types stay free of nil checks.

---

## Time and money in models

- Store timestamps as `time.Time` in UTC (`timestamptz` in PostgreSQL). Convert to local zones in the presentation layer only.
- Inject a `Clock` interface (`Now() time.Time`) into services so tests control time (see `testing.md`).
- Represent money as integer minor units plus a currency code. Floats drift.
- Use `uuid.UUID` (google/uuid) or a typed wrapper for identifiers. UUIDv7 (`uuid.NewV7()`) sorts by creation time and indexes well.

---

## Common AI-generated antipatterns

| Pattern | Problem | Replacement |
|---|---|---|
| `func handle(req map[string]any)` | no types, no validation | a DTO struct parsed with `validator` |
| `if email != ""` inside domain code | validation in the wrong layer | take an `Email` parameter |
| `type Status int` with `iota` on the wire | reordering changes meaning silently | `type Status string` with literals |
| `json:"id,string"` coercion tags | hides malformed input | strict decode, fail fast |
| `json.Unmarshal` followed by range checks | validation after the fact, easy to skip | struct tags or `UnmarshalText` |
| Reusing the handler DTO as the domain type | wire format leaks into business logic | two types and an explicit mapper |
| `validate` tags on sqlc rows | tags vanish on regeneration | validate at layer 1 and 2 |

## Sources

- go-playground/validator: https://github.com/go-playground/validator
- gin binding: https://gin-gonic.com/docs/examples/binding-and-validation/
- Parse, don't validate: https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- sqlc overrides: https://docs.sqlc.dev/en/latest/howto/overrides.html
