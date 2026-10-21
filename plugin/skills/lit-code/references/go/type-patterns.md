# Type Patterns

Go offers a smaller type toolbox than Python, TypeScript or Rust. Four patterns recover most of the lost safety, and a fifth set of habits (assertions, pointers, `any`) keeps the escape hatches under control.

1. **Named types** brand primitives.
2. **Smart constructors with unexported fields** parse input once and carry the proof in the type.
3. **Sealed interfaces** model sum types, checked by a type switch and the `exhaustive` linter.
4. **Generics with constraints** give bounded polymorphism.

---

## 1. Named types: distinct primitives

Two defined types with the same underlying type cannot be assigned to each other without a conversion. That blocks the ordinary mix-up of an order ID passed where a user ID belongs.

```go
package domain

type UserID string
type OrderID string

func GetUser(id UserID) (User, error) { /* ... */ }

func example() {
    uid := UserID("u-123")
    oid := OrderID("o-456")

    _, _ = GetUser(uid)            // compiles
    _, _ = GetUser(oid)            // compile error: cannot use oid (variable of type OrderID) as UserID value
    _, _ = GetUser("u-123")        // compiles: an untyped constant converts implicitly
    _, _ = GetUser(UserID(oid))    // compiles: explicit conversion, visible in review
}
```

An untyped string constant converts to any string-based defined type, and any explicit conversion succeeds. Named types therefore protect against accidental mixing of two variables, and a smart constructor (next section) protects the value itself. Use a bare named type for internal identifiers where the format is trivially valid, and a constructor for anything with rules.

Good candidates: identifiers, opaque tokens, foreign keys, unit-bearing numbers.

```go
type Milliseconds int64
type Seconds int64

func (ms Milliseconds) ToSeconds() Seconds { return Seconds(ms / 1000) }
```

`Milliseconds + Seconds` fails to compile, so a unit mismatch surfaces at build time. For durations, prefer the standard `time.Duration`, which already carries units.

---

## 2. Smart constructors with unexported fields

Go has no Pydantic or Zod. This pattern fills that role, and it is the most valuable one in this file.

```go
package domain

import (
    "errors"
    "fmt"
    "net/mail"
    "strings"
)

var ErrInvalidEmail = errors.New("invalid email")

// Email is a parsed, lowercased, valid address.
// The zero value is the invalid state; obtain a real one through NewEmail.
type Email struct {
    raw string // unexported: code outside this package cannot build an Email literal
}

func NewEmail(s string) (Email, error) {
    s = strings.ToLower(strings.TrimSpace(s))
    addr, err := mail.ParseAddress(s)
    if err != nil || addr.Address != s {
        return Email{}, fmt.Errorf("%w: %q", ErrInvalidEmail, s)
    }
    return Email{raw: s}, nil
}

func (e Email) String() string { return e.raw }
func (e Email) IsZero() bool   { return e.raw == "" }

// MarshalText and UnmarshalText cover JSON, YAML (via encoding.TextUnmarshaler), flags and env parsing in one place.
func (e Email) MarshalText() ([]byte, error) { return []byte(e.raw), nil }

func (e *Email) UnmarshalText(b []byte) error {
    parsed, err := NewEmail(string(b))
    if err != nil {
        return err
    }
    *e = parsed
    return nil
}
```

Why it works:

- `Email{raw: "x"}` outside package `domain` fails to compile, since `raw` is unexported.
- The only route to a non-zero `Email` is `NewEmail`, so every `Email` value in flight has passed validation.
- `encoding.TextMarshaler` and `encoding.TextUnmarshaler` make `encoding/json`, `caarlos0/env`, `flag.TextVar` and most YAML libraries route wire input through the constructor. Writing `MarshalText` and `UnmarshalText` once is shorter than hand-writing JSON methods and covers more formats.
- A function that takes `email Email` states its precondition in the signature, so the body skips defensive checks.

Apply it to every domain value that has invariants: emails, URLs, phone numbers, money, percentages, semantic versions, formatted IDs, time ranges.

### Containing the zero value

`Email{}` is always constructible, so give the type an `IsZero` method as shown, and let boundary code reject zero values where a value is required. Tests assert that constructors never return a non-zero value alongside an error, and that functions taking `Email` are never handed `Email{}` in production paths.

### Money and ranges

```go
type Cents int64

type Money struct {
    amount   Cents
    currency string // ISO 4217 code, validated in NewMoney
}

func NewMoney(amount Cents, currency string) (Money, error) {
    if len(currency) != 3 || strings.ToUpper(currency) != currency {
        return Money{}, fmt.Errorf("currency %q: want 3 upper-case letters", currency)
    }
    return Money{amount: amount, currency: currency}, nil
}

func (m Money) Add(o Money) (Money, error) {
    if m.currency != o.currency {
        return Money{}, fmt.Errorf("add %s to %s: currency mismatch", o.currency, m.currency)
    }
    return Money{amount: m.amount + o.amount, currency: m.currency}, nil
}
```

Integer minor units avoid floating point rounding, and the constructor plus method keep the currency invariant in one place.

---

## 3. Sealed interfaces: sum types

An interface with an unexported method can only be implemented inside its own package. A type switch dispatches on the closed set of variants, and the `exhaustive` linter reports a missing case.

```go
package event

import (
    "time"

    "myservice/internal/domain"
)

// Event is a closed sum: Created, Updated or Deleted.
type Event interface {
    sealed()
    OccurredAt() time.Time
}

type Created struct {
    UserID    domain.UserID
    Email     domain.Email
    Timestamp time.Time
}

type Updated struct {
    UserID    domain.UserID
    Changes   map[string]string
    Timestamp time.Time
}

type Deleted struct {
    UserID    domain.UserID
    Reason    string
    Timestamp time.Time
}

func (Created) sealed() {}
func (Updated) sealed() {}
func (Deleted) sealed() {}

func (e Created) OccurredAt() time.Time { return e.Timestamp }
func (e Updated) OccurredAt() time.Time { return e.Timestamp }
func (e Deleted) OccurredAt() time.Time { return e.Timestamp }
```

A consumer:

```go
func Render(e event.Event) string {
    switch v := e.(type) {
    case event.Created:
        return fmt.Sprintf("created %s with %s", v.UserID, v.Email)
    case event.Updated:
        return fmt.Sprintf("updated %s: %v", v.UserID, v.Changes)
    case event.Deleted:
        return fmt.Sprintf("deleted %s (%s)", v.UserID, v.Reason)
    default:
        // Reachable only when a variant was added without updating this switch.
        panic(fmt.Sprintf("unhandled event variant %T", v))
    }
}
```

The `default: panic` plays the role of `assertNever`. The `exhaustive` linter turns the same mistake into a lint error before the program runs.

### Enabling `exhaustive` in golangci-lint v2

```yaml
version: "2"
linters:
  enable:
    - exhaustive
  settings:
    exhaustive:
      check: [switch, map]
      default-signifies-exhaustive: false
```

With `default-signifies-exhaustive: false`, a `default` branch no longer hides a missing case, so adding `event.Suspended` without handling it fails the lint run. Treat the linter as the compiler check that Go does not provide.

### Gotchas

- The marker method must be unexported (`sealed`). An exported marker lets any package join the sum.
- Choose value receivers with value cases, or pointer receivers with pointer cases, and keep to one. A switch that lists `event.Created` while the value in flight is `*event.Created` falls through silently.
- `any` and the empty interface have no marker method, so they are open sets. Keep sums behind a named interface that includes the marker.
- Add a compile-time assertion for each variant when the file layout is spread out: `var _ Event = Created{}`.
- Sums that cross a wire boundary need a discriminator and a decoder; see "Discriminated unions" in `data-modeling.md`.

### Option and result shapes

For an optional value inside a domain function, return `(T, bool)` the way map lookups do. For a fallible computation, return `(T, error)`. A generic `Option[T]` type adds ceremony without enforcement, since a caller can still read the zero value.

```go
func (r *Registry) Lookup(id domain.UserID) (User, bool) { /* ... */ }
```

---

## 4. Generics with constraints

Use generics for algorithms whose logic is identical across element types. Use interfaces when the behaviour differs per type.

```go
import (
    "cmp"
    "slices"
    "strings"
)

func Max[T cmp.Ordered](a, b T) T {
    if a > b {
        return a
    }
    return b
}

type Named interface{ Name() string }

func JoinNames[T Named](items []T, sep string) string {
    names := make([]string, 0, len(items))
    for _, it := range items {
        names = append(names, it.Name())
    }
    return strings.Join(names, sep)
}

func SortedKeys[M ~map[K]V, K cmp.Ordered, V any](m M) []K {
    keys := make([]K, 0, len(m))
    for k := range m {
        keys = append(keys, k)
    }
    slices.Sort(keys)
    return keys
}
```

`cmp`, `slices` and `maps` (standard library since Go 1.21) already cover sorting, searching, min/max and map helpers. Check them before writing a constraint of your own. Go 1.23 adds iterator helpers such as `slices.Collect(maps.Keys(m))` and `slices.Sorted(maps.Keys(m))`, which shorten the `SortedKeys` example to one line.

### When generics are the wrong tool

- Accepting "several types" is interface territory. Generics fit parametric polymorphism (one algorithm, many element types), and interfaces fit behavioural polymorphism.
- A function that returns `any` pushes casts onto every caller. Return a sealed interface and let a type switch handle the variants.
- Methods cannot introduce new type parameters in Go, so a fluent generic API often needs a package-level function instead.

---

## 5. Type assertions: the controlled escape hatch

```go
// Panics when evt is another variant.
e := evt.(event.Created)

// Comma-ok form handles both outcomes.
if e, ok := evt.(event.Created); ok {
    use(e)
}

// Errors travel through chains, so use errors.As.
var pgErr *pgconn.PgError
if errors.As(err, &pgErr) {
    handle(pgErr.Code)
}
```

`errorlint` and `forcetypeassert` flag bare assertions. Use the comma-ok form or a type switch every time, and `errors.As` for error values (see `error-handling.md`).

---

## 6. Pointers and values

Rules that survive review:

- A struct that contains a `sync.Mutex`, `sync.WaitGroup` or similar must travel by pointer. `go vet` (`copylocks`) catches accidental copies.
- Large read-only structs can move either way; measure with a benchmark before choosing a pointer for speed.
- Keep receivers consistent on one type: all value receivers or all pointer receivers. Mixed receivers confuse method sets and interface satisfaction (`recvcheck` and `staticcheck` surface this).
- A nil pointer means "absent", a zero value means "not set yet". Choose one meaning per type and document it in the type comment.
- Return concrete types from constructors and accept interfaces in parameters. Define the interface at the consumer, small enough to describe only what the consumer calls.

---

## 7. `any` and `interface{}`

Write `any` instead of `interface{}` (the `revive` and `gofumpt` rule sets prefer it). Domain code rarely needs it. Accepted uses:

- JSON payloads with unknown shape, where `json.RawMessage` plus targeted decoding is still the better option.
- Variadic arguments to `fmt` and `slog` style APIs.
- Internals of generic containers hidden behind a typed API.

A signature such as `func Handle(payload any) error` points to a missing sealed interface. Replace it with a named sum and a switch.

---

## Review checklist

1. Every ID or token has a named type; every value with rules has a constructor.
2. Constructors return `(T, error)` and are the only path to a non-zero value.
3. Sum types use an unexported marker and are switched on with `exhaustive` enabled.
4. No bare type assertions; `errors.As` handles error chains.
5. Receivers are consistent per type; locks travel by pointer.
6. `any` stays out of domain, service and store signatures.

## Sources

- "Parse, don't validate" (Alexis King): https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- exhaustive linter: https://github.com/nishanths/exhaustive
- Introduction to generics: https://go.dev/blog/intro-generics
- cmp, slices, maps packages: https://pkg.go.dev/cmp, https://pkg.go.dev/slices, https://pkg.go.dev/maps
- encoding.TextUnmarshaler: https://pkg.go.dev/encoding#TextUnmarshaler
