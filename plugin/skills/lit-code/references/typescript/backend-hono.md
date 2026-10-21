# Hono Backend Stack (2026)

> **Canonical stack**: `hono` + `hono-openapi` + `@scalar/hono-api-reference` + `@hono/swagger-ui`
> **Runtime**: Bun (TypeScript runs natively)
> **Validator**: Zod v4 (implements Standard Schema, so OpenAPI generation needs no adapter)

Use this file when building or reviewing an HTTP service on Hono. It carries the package set, a complete application file, the API surface of each package, project layout for growing services, middleware, testing, a typed client, production hardening and a list of pitfalls with their fixes.

---

## 1. Package versions

Versions verified against the npm registry in spring 2026. Re-check with `npm view <package> version` before pinning in a long-lived project, and let the lockfile freeze the result.

| Package | Range | Role |
|---|---|---|
| `hono` | `^4.12.5` | Framework core (peer dependency of the Scalar integration) |
| `hono-openapi` | `^1.3.0` | Route annotations, validation middleware, spec generation |
| `@scalar/hono-api-reference` | `^0.10.11` | Scalar API reference page |
| `@hono/swagger-ui` | `^0.6.1` | Swagger UI page |
| `zod` | `^4.4.1` | Schemas (stable v4 line) |

### Dependency block

```json
{
  "dependencies": {
    "hono": "^4.12.5",
    "hono-openapi": "^1.3.0",
    "@scalar/hono-api-reference": "^0.10.11",
    "@hono/swagger-ui": "^0.6.1",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/bun": "latest"
  }
}
```

`hono-openapi` declares peer dependencies that current package managers (npm 7+, pnpm, bun) install automatically: `@hono/standard-validator` (^0.2), `@standard-community/standard-json` (^0.3), `@standard-community/standard-openapi` (^0.2) and `openapi-types` (^12). When validation misbehaves after an install, confirm these four sit in `node_modules`.

---

## 2. Complete `app.ts`

A runnable file with a health check, a validated query route, a validated body route, the OpenAPI document and both documentation UIs.

```typescript
import { Hono } from "hono"
import { describeRoute, openAPIRouteHandler, resolver, validator } from "hono-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { swaggerUI } from "@hono/swagger-ui"
import { z } from "zod"

// 1. Schemas (Zod v4, Standard Schema native)

const QuerySchema = z.object({
  name: z.string().optional(),
})

const MessageSchema = z.object({
  message: z.string(),
})

const CreateUserSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
})

// 2. Application with described routes

const app = new Hono()

app.get("/health", (c) => c.json({ status: "ok" }))

app.get(
  "/hello",
  describeRoute({
    tags: ["Greetings"],
    summary: "Say hello",
    description: "Returns a greeting message",
    responses: {
      200: {
        description: "Successful greeting",
        content: {
          "application/json": { schema: resolver(MessageSchema) },
        },
      },
    },
  }),
  validator("query", QuerySchema),
  (c) => {
    const query = c.req.valid("query")
    return c.json({ message: `Hello ${query.name ?? "Hono"}!` })
  },
)

app.post(
  "/users",
  describeRoute({
    tags: ["Users"],
    summary: "Create a user",
    responses: {
      201: {
        description: "User created",
        content: {
          "application/json": { schema: resolver(MessageSchema) },
        },
      },
    },
  }),
  validator("json", CreateUserSchema),
  (c) => {
    const body = c.req.valid("json")
    return c.json({ message: `Created user ${body.name}` }, 201)
  },
)

// 3. OpenAPI document

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Hono API",
        version: "1.0.0",
        description: "Example service documented with hono-openapi",
      },
      servers: [{ url: "http://localhost:3000", description: "Local server" }],
    },
  }),
)

// 4. Scalar reference UI

app.get(
  "/scalar",
  Scalar({
    url: "/openapi.json",
    theme: "saturn",
    pageTitle: "Hono API Reference",
  }),
)

// 5. Swagger UI mounted next to it

app.get("/swagger", swaggerUI({ url: "/openapi.json", title: "Swagger UI" }))

// 6. Bun entrypoint

export default app
```

Run it with `bun run --hot app.ts`. Endpoints after start-up:

- `GET /health` for liveness
- `GET /hello?name=world` for the documented query route
- `POST /users` for the validated JSON body route
- `GET /openapi.json` for the raw OpenAPI 3.1 document
- `GET /scalar` for the Scalar UI
- `GET /swagger` for Swagger UI

Probe each with `curl -s` and check the status code and the body; a documentation page that renders proves the spec parses.

---

## 3. `hono-openapi` API

### Import path

One import path serves everything; the package has no subpath exports such as `hono-openapi/zod`. It auto-detects the validator vendor through Standard Schema.

```typescript
import {
  describeRoute,        // middleware that attaches OpenAPI metadata to a route
  describeResponse,     // attach response schemas directly to a handler
  validator,            // validation middleware (wraps @hono/standard-validator)
  resolver,             // wrap a schema for use inside a response definition
  openAPIRouteHandler,  // serves the generated OpenAPI document
  generateSpecs,        // generate the document programmatically (build-time caching)
} from "hono-openapi"
```

### `describeRoute()`

Annotates a route. Use `resolver()` for every response body schema.

```typescript
app.get(
  "/users/:id",
  describeRoute({
    tags: ["Users"],
    summary: "Get user",
    description: "Retrieve a single user by id",
    responses: {
      200: {
        description: "User found",
        content: { "application/json": { schema: resolver(UserSchema) } },
      },
      404: { description: "User not found" },
    },
  }),
  handler,
)
```

The middleware is a pass-through at request time; it only stores the metadata object for the spec generator to collect.

### `validator()`

Validates `query`, `json`, `param`, `form` (and the other targets Hono validators accept) and registers the request schema in the OpenAPI document. A manual `requestBody` block in `describeRoute()` is unnecessary.

```typescript
validator("query", QuerySchema)   // ?name=foo
validator("json", JsonBodySchema) // request body
validator("param", ParamSchema)   // /users/:id
validator("form", FormSchema)     // multipart/form-data
```

An optional third argument is a hook that runs after validation and can shape the failure response:

```typescript
validator("json", CreateUserSchema, (result, c) => {
  if (!result.success) {
    return c.json({ errors: result.error.map((issue) => issue.message) }, 422)
  }
})
```

Without a hook, a failed validation returns a 400 with the validator's default body. Pick one error shape for the whole service and apply it through a shared hook function.

### `openAPIRouteHandler()`

Builds the document on first request and returns the cached copy afterward.

```typescript
app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      info: { title: "Hono API", version: "1.0.0" },
      servers: [{ url: "http://localhost:3000" }],
    },
  }),
)
```

`/openapi.json` is the common mount point; some projects use `/openapi/spec.json` with the UI under `/openapi/ui`. Whatever the choice, give the UI pages the same URL.

### OpenAPI version

`hono-openapi` emits **OpenAPI 3.1.0** and the version string is fixed in the generator. A consumer that needs 3.0.x post-processes the document or uses the older `@hono/zod-openapi` package, which wraps `Hono` in an `OpenAPIHono` class.

---

## 4. Scalar (`@scalar/hono-api-reference`)

```typescript
import { Scalar } from "@scalar/hono-api-reference"
```

`apiReference` is still exported as an alias but is deprecated in favour of `Scalar`.

### Mount paths

`/scalar` matches the middleware name, `/docs` is generic, `/openapi/ui` nests under the spec prefix.

### Configuration

The middleware accepts Scalar's universal configuration plus Hono-specific `pageTitle` and `cdn`.

```typescript
app.get("/scalar", Scalar({
  // Source (required)
  url: "/openapi.json",

  // Appearance
  theme: "saturn",         // alternate | default | moon | purple | solarized | bluePlanet
                           // | deepSpace | saturn | kepler | elysiajs | fastify | mars
                           // | laserwave | none
  pageTitle: "My API Docs",
  customCss: ".sidebar { font-size: 14px; }",
  favicon: "/favicon.svg",

  // Behaviour
  layout: "modern",        // modern | classic
  darkMode: true,
  forceDarkModeState: "dark",
  hideDarkModeToggle: false,
  hideModels: false,
  hideSearch: false,
  hideTestRequestButton: false,
  showOperationId: false,
  showSidebar: true,

  // Servers and proxy
  proxyUrl: "https://proxy.scalar.com",
  baseServerURL: "http://localhost:3000",
  servers: [{ url: "http://localhost:3000" }],

  // Delivery
  cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference",
}))
```

Further options (`authentication`, `hiddenClients`, `defaultHttpClient`, `plugins`, `pathRouting`, `mcp`) are listed in Scalar's configuration reference; open it before relying on one, because the option set changes between minor releases.

### Request-aware configuration

Pass a function when the configuration depends on the environment:

```typescript
app.get("/scalar", Scalar((c) => ({
  url: "/openapi.json",
  proxyUrl: c.env.ENVIRONMENT === "development" ? "https://proxy.scalar.com" : undefined,
})))
```

The function receives the Hono context and may be async.

---

## 5. Swagger UI (`@hono/swagger-ui`)

```typescript
import { swaggerUI } from "@hono/swagger-ui"

app.get("/swagger", swaggerUI({
  url: "/openapi.json", // spec location (required)
  title: "Swagger UI",  // page title
  version: "latest",    // Swagger UI release served from the CDN
}))
```

Standard Swagger UI options (`presets`, `plugins`, `urls`) pass through. The middleware loads assets from a CDN, so an offline environment needs the package's self-hosted variant or the Scalar page only. It accepts a `url` (or `urls`) and has no `spec` option for an inline document; Scalar's `content` option serves an embedded document.

Mount path choices: `/swagger`, `/ui`, `/docs`.

---

## 6. Bun entrypoint

Minimal shape for `bun run`:

```typescript
import { Hono } from "hono"

const app = new Hono()
// routes ...

export default app
```

Choose the port explicitly in a deployed service:

```typescript
export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
}
```

(Read `PORT` through the validated `env` object from `data-modeling.md` in a real service.)

Scripts:

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

On Node, serve with `@hono/node-server`:

```typescript
import { serve } from "@hono/node-server"
import { app } from "./app.ts"

serve({ fetch: app.fetch, port: 3000 })
```

Export `app` by name in modules that tests import, and keep the `export default` only in the entry file that the runtime needs.

---

## 7. Zod v3 versus v4

| Feature | Zod v3 | Zod v4 |
|---|---|---|
| Standard Schema | absent | native |
| Extra package for `hono-openapi` | `zod-openapi@4` | none |
| Import | `import { z } from "zod"` | `import { z } from "zod"` (or `zod/v4`) |

A project still on Zod v3 installs `zod-openapi@4`, adds metadata through `.openapi()` and names component references with `.meta({ ref: "Name" })`. `resolver()` keeps working, with the conversion relying on that package. Zod v4 projects need nothing extra, and `z.date()` converts to `{ type: "string", format: "date-time" }` automatically.

---

## 8. Growing beyond one file

### Layout

```text
src/
  index.ts            # entry: builds the app, exports the runtime shape
  app.ts              # createApp(): mounts middleware, routes, docs
  env.ts              # EnvSchema.parse(process.env)
  routes/
    health.ts
    users.ts          # one Hono sub-app per resource
  schemas/
    user.ts           # Zod schemas and inferred types
  services/
    users.ts          # business logic, no Hono imports
  errors.ts           # DomainError subclasses
tests/
  users.test.ts
```

Handlers stay thin: parse, call a service, shape the response. Services import no Hono types, which keeps them testable without HTTP.

### Sub-apps

```typescript
// routes/users.ts
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { z } from "zod"

const ParamSchema = z.object({ id: z.string().uuid() })
const UserSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const users = new Hono().get(
  "/:id",
  describeRoute({
    tags: ["Users"],
    responses: {
      200: {
        description: "User found",
        content: { "application/json": { schema: resolver(UserSchema) } },
      },
      404: { description: "User not found" },
    },
  }),
  validator("param", ParamSchema),
  async (c) => {
    const { id } = c.req.valid("param")
    const user = await findUser(id)
    if (!user) return c.json({ error: "not found" }, 404)
    return c.json(user, 200)
  },
)
```

```typescript
// app.ts
import { Hono } from "hono"
import { users } from "./routes/users.ts"

export function createApp() {
  return new Hono().route("/users", users)
}
export type AppType = ReturnType<typeof createApp>
```

Chain route definitions (`new Hono().get(...).post(...)`) so the resulting type records every route, which the typed client in section 10 consumes. Call `openAPIRouteHandler(app, ...)` with the final composed app so mounted sub-routes appear in the document.

### Middleware

```typescript
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { secureHeaders } from "hono/secure-headers"
import { requestId } from "hono/request-id"
import { bodyLimit } from "hono/body-limit"
import { timeout } from "hono/timeout"

app.use("*", requestId())
app.use("*", logger())
app.use("*", secureHeaders())
app.use("/api/*", cors({ origin: ["https://app.example.com"], credentials: true }))
app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024 }))
app.use("/api/*", timeout(10_000))
```

Order matters: middleware runs in registration order, so the request id and logger come first and authentication follows `cors`. In production restrict `cors` origins to a list; a wildcard with credentials is rejected by browsers anyway.

### Authentication example

```typescript
import { bearerAuth } from "hono/bearer-auth"

app.use("/api/*", bearerAuth({
  verifyToken: async (token) => await verifyJwt(token), // returns boolean
}))
```

Compare secrets with a constant-time function and load them from validated environment variables.

### Errors

```typescript
import { HTTPException } from "hono/http-exception"

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse()
  if (error instanceof DomainError) return c.json({ error: error.message }, error.httpStatus as 400 | 404 | 409)
  console.error("unhandled:", error)
  return c.json({ error: "internal server error" }, 500)
})

app.notFound((c) => c.json({ error: "not found" }, 404))
```

Typed errors from `error-handling.md` map to status codes here and nowhere else.

---

## 9. Testing without a server

Hono apps answer `app.request()` directly, which skips the network and keeps tests fast.

```typescript
import { describe, expect, test } from "bun:test"
import { createApp } from "../src/app.ts"

describe("POST /users", () => {
  const app = createApp()

  test("creates a user from a valid body", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada", age: 36 }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ message: "Created user Ada" })
  })

  test("rejects a negative age with 400", async () => {
    const res = await app.request("/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada", age: -1 }),
    })
    expect(res.status).toBe(400)
  })
})
```

Add one test per documented response code, and one test that fetches `/openapi.json` and asserts every route you registered appears in `paths`. That last test catches a handler that lost its `describeRoute`.

---

## 10. Typed client

`hc` derives a fully typed client from the app type, giving the front end compile-time checks against the real routes.

```typescript
import { hc } from "hono/client"
import type { AppType } from "../server/src/app.ts"

const client = hc<AppType>("http://localhost:3000")
const res = await client.users[":id"].$get({ param: { id: "7b0e5f0a-0000-4000-8000-000000000000" } })
if (res.ok) {
  const user = await res.json() // typed from the route's response
}
```

Import the app type with `import type` so no server code ships to the browser.

---

## 11. Production notes

| Concern | Action |
|---|---|
| Documentation exposure | Mount `/scalar` and `/swagger` only when `env.NODE_ENV !== "production"`, or put them behind auth |
| Spec caching | `openAPIRouteHandler` caches after the first call; call `generateSpecs` in a build step to ship a static `openapi.json` |
| Graceful shutdown | Handle `SIGTERM`, stop accepting connections, finish in-flight requests, then exit |
| Health checks | Separate `/health` (process up) from `/ready` (dependencies reachable) |
| Logging | Use `pino` with the request id from `requestId()` on every line |
| Limits | `bodyLimit` and `timeout` on every write route |
| Secrets | Read through the validated `env` object and keep them out of logs and error bodies |

---

## 12. Pitfalls

1. **`openAPISpecs` in older tutorials.** The current export is `openAPIRouteHandler`.
2. **Importing from `hono-openapi/zod`.** The package exposes a single root import.
3. **Missing `@hono/standard-validator`.** It is a peer dependency; reinstall if validation errors look unrelated to your schema.
4. **`@hono/zod-openapi` mixed in.** That older package replaces `Hono` with `OpenAPIHono`. Pick `hono-openapi` for the middleware style shown here and keep one of the two per project.
5. **Swagger UI `spec` option.** The middleware takes a `url`; use Scalar's `content` for an inline document.
6. **Routes registered after `openAPIRouteHandler` is first hit.** Routes added later are absent from the cached spec; register everything before serving traffic.
7. **Unchained sub-apps.** Writing `const r = new Hono(); r.get(...)` as separate statements drops the route types, and `hc` then sees an empty client.
8. **Validator targets.** `validator("json", ...)` reads the body only when the request sends `content-type: application/json`; tests that omit the header receive a 400.
9. **Default exports.** The iron list asks for named exports; the entry file is the one exception because Bun reads `export default`.

---

## 13. Real-world pattern

Public monorepo starters use `hono-openapi` and Scalar together by wrapping the mounting in one helper:

```typescript
import type { Hono } from "hono"
import { Scalar } from "@scalar/hono-api-reference"
import { openAPIRouteHandler } from "hono-openapi"

export function setupOpenAPI(app: Hono, prefix = "/openapi") {
  app.get(
    `${prefix}/spec.json`,
    openAPIRouteHandler(app, {
      documentation: { info: { title: "Backend", version: "1.0.0" } },
    }),
  )
  app.get(`${prefix}/ui`, Scalar({ theme: "deepSpace", url: `${prefix}/spec.json` }))
}
```

Adding `swaggerUI` is a parallel mount of the same spec URL, as shown in section 2.

---

## 14. Quick start

```bash
mkdir my-api && cd my-api
bun init -y
bun add hono hono-openapi @scalar/hono-api-reference @hono/swagger-ui zod
bun add -d typescript @types/bun
# write app.ts from section 2, then
bun run --hot app.ts
```

Verify: `curl -s localhost:3000/health`, `curl -s localhost:3000/openapi.json | head -c 200`, and open `/scalar` in a browser or fetch it and confirm an HTML 200.

---

## 15. Recipes

### Declaring a security scheme in the document

Extend the `documentation` option so Scalar and Swagger UI show an authorise button, then reference the scheme from protected routes.

```typescript
openAPIRouteHandler(app, {
  documentation: {
    info: { title: "Hono API", version: "1.0.0" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
})
```

A public route overrides the global requirement with `describeRoute({ security: [] })`.

### Server-sent events

```typescript
import { streamSSE } from "hono/streaming"

app.get("/events", (c) =>
  streamSSE(c, async (stream) => {
    for (let i = 0; i < 5; i++) {
      await stream.writeSSE({ event: "tick", data: String(i) })
      await stream.sleep(1000)
    }
  }),
)
```

Describe the route with a `text/event-stream` response entry so the document records it. Pass `c.req.raw.signal` into any upstream request the stream makes, so a closed browser tab cancels the work.

### Multipart upload with a size cap

```typescript
const UploadSchema = z.object({ file: z.instanceof(File) })

app.post(
  "/upload",
  bodyLimit({ maxSize: 5 * 1024 * 1024, onError: (c) => c.json({ error: "file too large" }, 413) }),
  validator("form", UploadSchema),
  async (c) => {
    const { file } = c.req.valid("form")
    return c.json({ name: file.name, bytes: file.size }, 201)
  },
)
```

### Rate limiting

Hono ships no limiter in core. Use a store-backed middleware (a Redis- or KV-based package, or a Cloudflare rate-limit binding) and place it before the validator so rejected requests stop early. Key on an authenticated identity first and the client address second, and return `429` with a `Retry-After` header.
