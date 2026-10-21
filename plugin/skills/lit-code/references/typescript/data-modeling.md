# Data Modeling

Which construct fits which data, how to shape it, and why `readonly` is the default. The decisions here set what the rest of the program can assume, so make them before writing function bodies.

---

## Decision flow

```
Fixed set of named constants?
  yes -> as const object + literal union type
Just a tag on a primitive (string, number)?
  yes -> branded type
A contract that several implementations satisfy?
  yes -> interface
Does the data cross a trust boundary (user input, API, file, env)?
  yes -> Zod schema + z.infer<typeof schema>
A set of alternative outcomes?
  yes -> discriminated union (kind / type field)
Structured data with named fields?
  yes -> type alias with readonly properties
none of the above -> the value probably needs no new type
```

---

## Containers

### type alias: internal data

The default for structured data inside the codebase. Zero runtime cost.

```typescript
type User = {
  readonly id: UserId
  readonly name: string
  readonly email: string
}

type Point = {
  readonly x: number
  readonly y: number
}
```

Every property is `readonly`; mutability appears only where mutation is the documented purpose.

### interface: contracts and extension

Choose `interface` when classes implement it, when it extends another contract, or when declaration merging is needed.

```typescript
interface Repository<T> {
  get(id: string): Promise<T | null>
  save(entity: T): Promise<void>
}

interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>
}
```

### type versus interface

| Use | When |
|---|---|
| `type` | Unions, intersections, mapped and conditional types, utility types, plain data shapes |
| `interface` | A contract meant to be implemented or extended, or a shape that needs declaration merging |
| Default | `type`, unless there is a concrete reason for `interface` |

Interfaces report errors by name and extend cheaply, which pays off for public library contracts. Types compose more freely, which pays off in application code.

### Zod schema: trust boundary guard

Schemas validate at runtime and infer static types at compile time, so one declaration serves both.

```typescript
import { z } from "zod"

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0),
})
type CreateUser = z.infer<typeof CreateUserSchema>

const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
})
type UserResponse = z.infer<typeof UserResponseSchema>
```

Governing rule: data crossing a trust boundary goes through Zod, and everything else uses plain types or interfaces. Internal-only values skip Zod because runtime validation costs time and couples the module to the library.

Zod v4 also offers top-level format helpers (`z.email()`, `z.uuid()`, `z.url()`); either spelling works inside a project, so pick one and keep it uniform. Parse environment variables once at start-up:

```typescript
const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})
export const env = EnvSchema.parse(process.env)
```

`env` then carries typed, validated values to every module, and a missing variable stops the process at boot with a readable message.

### as const: fixed constants

```typescript
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number]

const STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DELETED: "deleted",
} as const
type Status = (typeof STATUS)[keyof typeof STATUS]
```

Type-safe, tree-shakeable and free of runtime overhead, this is the replacement for `enum`. Feed `ROLES` into `z.enum(ROLES)` so the schema and the type share one source.

### Discriminated union: several outcomes

```typescript
type GetUserResult =
  | { readonly kind: "found"; readonly user: User }
  | { readonly kind: "not_found"; readonly id: UserId }
  | { readonly kind: "forbidden"; readonly reason: string }
```

Each variant carries a `kind` field, and `switch (result.kind)` narrows to the matching variant. See `type-patterns.md` for the exhaustive form.

---

## Quick lookup

| Situation | Use |
|---|---|
| Request or response from outside, user input | Zod schema + `z.infer` |
| Internal value object | `type` with `readonly` properties |
| Function with several outcomes | Discriminated union |
| Contract for implementations | `interface` |
| Fixed constants | `as const` + literal union |
| Distinct primitive (`UserId` versus `OrderId`) | Branded type |
| Dictionary or key-value map | `Record<K, V>` or an index signature |

---

## Readonly by default

```typescript
// Default: readonly everywhere
type Config = {
  readonly apiUrl: string
  readonly timeout: number
}

// Arrays and maps follow
function getUsers(): readonly User[] { /* ... */ }
type Index = ReadonlyMap<UserId, User>
type Tags = ReadonlySet<string>

// Derive a readonly view of an existing type
type ReadonlyUser = Readonly<User>
```

`Readonly<T>` is shallow. For nested structures declare `readonly` at each level, or define a small `DeepReadonly<T>` helper when a type is genuinely deep.

When mutation is the point, say so in a doc comment:

```typescript
/** Counter state. Mutation is the whole purpose of this type. */
type CounterState = {
  count: number // intentionally mutable
}
```

Update immutable values by building new ones:

```typescript
const renamed: User = { ...user, name: "Ada" }
const withTag: readonly string[] = [...tags, "new"]
```

---

## Parse once at the edge

Validate at the boundary and return a typed value. Code beyond the boundary treats the type as proof.

```typescript
// Weak: validates, then passes the raw string onward
function processEmail(email: string): void {
  if (!email.includes("@")) throw new Error("invalid")
  // downstream code still sees a plain string
}

// Strong: parse into a branded type at the boundary
const EmailSchema = z.string().email().brand<"Email">()
type Email = z.infer<typeof EmailSchema>

function sendWelcome(email: Email): void { /* ... */ }

const parsed = EmailSchema.parse(rawInput) // Email, or a thrown ZodError
sendWelcome(parsed) // no second validation
```

Use `safeParse` where a failure is an ordinary outcome and the caller builds an error response:

```typescript
const result = CreateUserSchema.safeParse(body)
if (!result.success) return c.json({ errors: result.error.issues }, 400)
const input = result.data // CreateUser
```

---

## Mapping between layers

Keep the database row, the domain value and the wire format as separate types, with one small mapper between each pair. The mapper is the only place that knows both shapes.

```typescript
type UserRow = { readonly id: string; readonly name: string; readonly created_at: Date }

const toUser = (row: UserRow): User => ({
  id: UserId(row.id),
  name: row.name,
  createdAt: row.created_at,
})
```

This keeps column renames and API versioning local to the mapper and out of business logic.

---

## Sources

- TypeScript Handbook: [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- Zod: [documentation](https://zod.dev)
- Total TypeScript: [Type vs Interface](https://www.totaltypescript.com/type-vs-interface-which-should-you-use)
