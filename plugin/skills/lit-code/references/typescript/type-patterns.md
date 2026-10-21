# Type Patterns

Techniques that move bugs from runtime to compile time. Each section gives the pattern, a working snippet, and the situation that calls for it.

---

## Branded types: distinct primitives

Two values can share a runtime type and still mean different things. A brand adds a compile-time tag, so the compiler refuses to mix them up.

```typescript
declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

type UserId = Brand<string, "UserId">
type OrderId = Brand<string, "OrderId">
type Milliseconds = Brand<number, "Milliseconds">
type Seconds = Brand<number, "Seconds">

// The single place where a raw string becomes an identifier
const UserId = (value: string): UserId => value as UserId
const OrderId = (value: string): OrderId => value as OrderId

declare function getUser(id: UserId): Promise<User>

getUser(UserId("abc"))   // accepted
getUser(OrderId("abc"))  // error: OrderId is not assignable to UserId
getUser("abc")           // error: string is not assignable to UserId
```

The constructor functions hold the only `as` casts in the codebase for these types; keep them in one module and let the audit script allow them there (a brand cast is `as UserId`, which the rules accept because it names a concrete type).

With Zod at a boundary, the schema mints the brand after validation:

```typescript
import { z } from "zod"

const UserIdSchema = z.string().uuid().brand<"UserId">()
type UserId = z.infer<typeof UserIdSchema>

const id: UserId = UserIdSchema.parse(rawInput)
```

Unit conversion keeps arithmetic honest:

```typescript
const seconds = (ms: Milliseconds): Seconds => (ms / 1000) as Seconds
```

Apply a brand to identifiers, indices into different arrays, currency amounts, units of measure, sanitised strings (`SafeHtml`) and anything where swapping two arguments compiles today and fails in production.

---

## as const: literal types from values

`as const` freezes a value to its narrowest type and makes arrays into readonly tuples. It is the foundation of enum-free TypeScript.

```typescript
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number] // "admin" | "user" | "guest"

const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL: 500,
} as const
type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] // 200 | 404 | 500

// The array doubles as a runtime list, so validation and the type share one source
const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value)
```

Use it for any closed set of constants. Skip it for sets that users or configuration extend at runtime, where a `Set<string>` or a `Record<string, T>` fits.

Why not `enum`: numeric enums accept any number, string enums are nominal and refuse plain string literals, and both emit runtime code. An `as const` object emits only the object and works with structural typing.

---

## satisfies: validate without widening

`satisfies` checks a value against a type and keeps the inferred literal types.

```typescript
type Config = Record<string, string | number>

// Annotation widens every property to string | number
const widened: Config = { api: "https://api.example.com", timeout: 30 }
widened.api // string | number

// satisfies validates the shape and preserves the narrow types
const config = {
  api: "https://api.example.com",
  timeout: 30,
} satisfies Config
config.api     // string
config.timeout // number
```

Combine with `as const` for lookup tables whose keys the compiler must remember:

```typescript
const ROUTES = {
  home: "/",
  user: "/users/:id",
} as const satisfies Record<string, `/${string}`>

type RouteName = keyof typeof ROUTES // "home" | "user"
```

Use `satisfies` for config objects, route tables, theme tokens and handler maps where both validation and narrowing matter.

---

## Discriminated unions: modelling every outcome

A union whose members share a literal field (`kind`, `type`, `status` or `_tag`) lets the compiler narrow on that field.

```typescript
type GetUserResult =
  | { readonly kind: "found"; readonly user: User }
  | { readonly kind: "not_found"; readonly id: UserId }
  | { readonly kind: "forbidden"; readonly reason: string }
```

Prefer a union over optional fields that are only valid in some combinations. `{ user?: User; reason?: string }` allows states that never occur; the union allows exactly the three that do.

State machines follow the same shape:

```typescript
type Upload =
  | { readonly state: "idle" }
  | { readonly state: "sending"; readonly sentBytes: number; readonly totalBytes: number }
  | { readonly state: "done"; readonly url: URL }
  | { readonly state: "failed"; readonly error: Error }
```

---

## Exhaustive switch: assertNever

End every `switch` over a union with a default branch that passes the leftover value to `assertNever`.

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`)
}

function describe(result: GetUserResult): string {
  switch (result.kind) {
    case "found":
      return result.user.name
    case "not_found":
      return `No user ${result.id}`
    case "forbidden":
      return `Denied: ${result.reason}`
    default:
      return assertNever(result)
  }
}
```

Adding a fourth variant turns the `assertNever(result)` call into a compile error until a case handles it. The `throw` inside is a last line of defence for data that bypassed the type system, such as JSON from an older client.

For a lookup in place of a switch, use an exhaustive record:

```typescript
const LABEL: Record<GetUserResult["kind"], string> = {
  found: "Found",
  not_found: "Missing",
  forbidden: "Denied",
}
```

A new `kind` fails to compile here until its label exists.

---

## Narrowing: let the compiler follow the logic

TypeScript narrows through `typeof`, `instanceof`, `in`, equality, truthiness and discriminants.

```typescript
function process(value: string | number | null): string {
  if (value === null) return "nothing"
  // value: string | number
  if (typeof value === "string") return value.toUpperCase()
  // value: number
  return String(value * 2)
}
```

### Custom type guards

```typescript
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null
}

const items = [1, null, 2, undefined, 3]
const clean = items.filter(isNonNull) // number[]
```

### Assertion functions

```typescript
function assertDefined<T>(value: T | undefined, what: string): asserts value is T {
  if (value === undefined) throw new Error(`${what} is required`)
}

const first = list[0] // T | undefined under noUncheckedIndexedAccess
assertDefined(first, "first element")
first.id // narrowed to T
```

### Narrowing unknown

```typescript
function parsePort(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0 && raw < 65536) return raw
  throw new TypeError(`invalid port: ${String(raw)}`)
}
```

At a trust boundary prefer a Zod schema to a hand-written guard (see `data-modeling.md`).

---

## import type: separating values from types

```typescript
import type { User, Config } from "./types" // erased at runtime
import { createUser } from "./services"      // kept at runtime
import { loadUsers, type UserFilter } from "./users" // mixed form
```

`verbatimModuleSyntax` makes the compiler enforce this, and the Biome rule `useImportType` fixes violations automatically.

---

## Template literal types

Build string types from parts when the format is part of the contract.

```typescript
type Method = "GET" | "POST"
type Endpoint = `/${string}`
type RouteKey = `${Method} ${Endpoint}`

const key: RouteKey = "GET /users" // accepted
// const bad: RouteKey = "PUT /users" // error
```

---

## Utility types: quick reference

| Need | Use |
|---|---|
| Every property readonly | `Readonly<T>` |
| Every property optional | `Partial<T>` |
| Every property required | `Required<T>` |
| Select properties | `Pick<T, "a" \| "b">` |
| Drop properties | `Omit<T, "a" \| "b">` |
| Key-value map | `Record<K, V>` |
| Keep union members matching U | `Extract<T, U>` |
| Drop union members matching U | `Exclude<T, U>` |
| Function result type | `ReturnType<typeof fn>` |
| Function parameter tuple | `Parameters<typeof fn>` |
| Unwrap a promise | `Awaited<Promise<T>>` gives `T` |
| Remove null and undefined | `NonNullable<T>` |

---

## Pitfalls

| Pitfall | Fix |
|---|---|
| `Object.keys(obj)` returns `string[]` | Iterate `Object.entries` with a typed helper, or keep the key list as an `as const` array |
| `JSON.parse` returns `any` | Assign to `unknown` and parse with a schema |
| An `Array.isArray` check on `readonly T[]` narrows to `any[]` | Write a guard with `value is readonly T[]` |
| Optional property assigned `undefined` under `exactOptionalPropertyTypes` | Omit the key, or declare the property as `x?: string \| undefined` when "set to nothing" is meaningful |
| Spread of a union loses the discriminant | Build each variant explicitly |

---

## Sources

- TypeScript Handbook: [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- TypeScript Handbook: [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- Total TypeScript: [as const](https://www.totaltypescript.com/as-const)
