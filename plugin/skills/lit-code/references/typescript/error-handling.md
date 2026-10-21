# Error Handling

Typed errors, exhaustive matching, the Result pattern, error causes and resource safety. The goal is that every failure a caller can act on shows up in a type, and every failure it cannot act on travels upward with its context intact.

---

## Typed errors

Error classes carry structured fields, so callers learn exactly what went wrong without parsing a message.

```typescript
class UserNotFoundError extends Error {
  readonly name = "UserNotFoundError"
  constructor(readonly userId: UserId) {
    super(`user ${userId} not found`)
  }
}

class PermissionDeniedError extends Error {
  readonly name = "PermissionDeniedError"
  constructor(
    readonly userId: UserId,
    readonly requiredRole: string,
  ) {
    super(`user ${userId} needs role ${requiredRole}`)
  }
}
```

```typescript
// Weak: the caller has only a string to inspect
throw new Error("user not found")

// Strong: the caller narrows with instanceof and reads typed fields
throw new UserNotFoundError(userId)
throw new PermissionDeniedError(userId, "admin")
```

Set `readonly name` on each class. `instanceof` is the primary check; `error.name` is a stable string for logs and for serialisation across process boundaries, and it survives minification.

Throw `Error` subclasses only. A thrown string or number has no stack trace, so the audit rule `no-throw-literal` rejects it.

A shared base class groups a family of errors for one `instanceof` check at the boundary:

```typescript
abstract class DomainError extends Error {
  abstract readonly httpStatus: number
}

class OrderClosedError extends DomainError {
  readonly name = "OrderClosedError"
  readonly httpStatus = 409
  constructor(readonly orderId: OrderId) {
    super(`order ${orderId} is closed`)
  }
}
```

---

## Result: expected failures without exceptions

A failure the immediate caller must decide about (not found, validation, conflict) is returned as a discriminated union.

```typescript
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
```

### Usage

```typescript
type UserError =
  | { readonly kind: "not_found"; readonly id: UserId }
  | { readonly kind: "forbidden"; readonly reason: string }

function getUser(id: UserId): Result<User, UserError> {
  const user = db.find(id)
  if (!user) return err({ kind: "not_found", id })
  if (!user.active) return err({ kind: "forbidden", reason: "deactivated" })
  return ok(user)
}

const result = getUser(userId)
if (!result.ok) {
  switch (result.error.kind) {
    case "not_found":
      log.warn(`missing: ${result.error.id}`)
      break
    case "forbidden":
      log.error(`denied: ${result.error.reason}`)
      break
    default:
      assertNever(result.error)
  }
  return
}
const user = result.value // narrowed to User
```

### Result or throw

Rule of thumb: when the caller is one or two frames away and has a sensible reaction, return a Result. When the error must climb many layers, throw a typed subclass.

| Scenario | Pattern | Reason |
|---|---|---|
| Repository to service | Result | The caller sits next to the failure and must pick a branch |
| Parsing input at the boundary | Throw (Zod throws) or `safeParse` | The HTTP layer converts it into a 400 |
| Infrastructure failure (network, out of memory) | Throw | No local recovery exists |
| Service to service, deep internal | Throw a typed subclass | Threading `.ok` checks through every layer costs more than it protects |
| HTTP handler to response | Catch and translate | Boundary code owns the mapping to status codes |

Result gives the compiler a way to force handling, at the price of boilerplate in long call chains. If an error would pass unchanged through three or more layers, a typed subclass is the cleaner tool.

### Library or home-grown

The `Result`, `ok` and `err` above take ten lines, and that is enough for most projects. A library such as `neverthrow` adds chaining (`.map`, `.andThen`) and pays off only where code chains results frequently.

---

## Error cause: keeping context

Wrap a low-level error with the `cause` option so the original stack survives.

```typescript
try {
  await db.query(sql)
} catch (error) {
  if (error instanceof ConnectionError) {
    throw new DatabaseError("query failed", { cause: error })
  }
  throw error
}
```

The wrapped error is readable at `error.cause` and appears in stack traces. Wrap at layer boundaries, where the new message adds meaning (which query, which record), and rethrow unchanged elsewhere.

---

## Translating at the boundary

An HTTP service converts errors to responses in one place:

```typescript
app.onError((error, c) => {
  if (error instanceof UserNotFoundError) {
    return c.json({ error: error.message }, 404)
  }
  if (error instanceof PermissionDeniedError) {
    return c.json({ error: error.message }, 403)
  }
  console.error("unhandled:", error)
  return c.json({ error: "internal server error" }, 500)
})
```

The catch-all at the bottom is the top-level boundary the audit rule allows; mark the function or line with `// no-excuse-ok: catch` if the script flags it. The response for unknown errors carries a fixed message, and the detail goes to the log, so stack traces never reach clients.

For a CLI, the same role belongs to `main()`: catch, print one line, set the exit code.

---

## Async patterns

```typescript
// Promise.allSettled: partial failure is acceptable
const results = await Promise.allSettled(urls.map((url) => ky.get(url).json()))
const successes = results
  .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
  .map((r) => r.value)

// Timeouts with AbortSignal
async function getWithTimeout(url: string, ms: number): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(ms) })
}

// Cancel on demand and combine signals
const controller = new AbortController()
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)])
```

Rules for async error flow:

- Every promise is awaited, returned or explicitly handled; a floating promise loses its rejection. Biome's `noFloatingPromises` rule (nursery in Biome 2.x) or the `void` operator marks intentional fire-and-forget.
- `Promise.all` rejects on the first failure and leaves the other tasks running; use `allSettled` when each outcome matters.
- Retry only idempotent operations, with a cap and jittered backoff; `ky` provides `retry` options.
- Pass an `AbortSignal` into long operations so a timeout or a shutdown stops the work.

## Resource safety

Release resources in `finally`, or use explicit resource management (`using` and `await using`, needs TypeScript 5.2 or newer and a runtime with `Symbol.dispose`, such as Bun or Node 24):

```typescript
async function withConnection<T>(pool: Pool, fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await pool.acquire()
  try {
    return await fn(conn)
  } finally {
    conn.release()
  }
}
```

---

## Sources

- MDN: [Error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- MDN: [Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- MDN: [AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
