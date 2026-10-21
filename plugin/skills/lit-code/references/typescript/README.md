# TypeScript Entry Point

Load this file first whenever a task touches a `.ts` or `.tsx` file. It sets the stack, the iron list of type rules, the audit script and the order in which to open the other TypeScript references. Everything here applies to one-off scripts as well as services, because a script that survives a week tends to become a service.

## Position

The compiler is the first reviewer. A type that cannot express an illegal state has removed a whole class of tests. Data is parsed once at the edge of the program; past that edge, a value's type is the proof that it was checked. Each function states a contract in its signature, and the build refuses code that breaks it.

## Stack decisions

These are fixed project choices. A deviation needs a written reason in the plan or PR, because the defaults below were picked to make the strict rules cheap to follow.

| Category | Choose | Replaces |
|---|---|---|
| Runtime | Bun (runs `.ts` directly, one binary) | ts-node, tsx |
| Package manager | `pnpm` for Node projects, `bun install` for Bun projects | npm, yarn (unless a workspace forces it) |
| Lint and format | Biome | ESLint plus Prettier |
| Type check | `tsc --noEmit` with the strict config in `tsconfig-strict.md` | skipping the check |
| Web framework | Hono | Express, Fastify, NestJS |
| Validation | Zod | joi, yup, class-validator |
| Test runner | `bun test` or vitest | jest |
| ORM | Drizzle | TypeORM, Prisma (keep Prisma only where the project already uses it) |
| HTTP client | `ky`; `undici` directly for high-volume Node backends | bare `fetch()` in production paths, `axios`, `node-fetch` |
| Logging | `pino` | `console.log` in services |
| CLI | `@clack/prompts` with `commander` | hand-rolled `process.argv` parsing |

HTTP client rule: production code wraps the network in a client that has retry, timeout and status handling. Bare `fetch()` has none of the three, so an incident turns into silent empty responses. `ky` is the default (about 5 KB, throws on non-2xx, retries, timeouts, hooks, `prefixUrl`, runs in browser, Node, Bun and Deno). Use the `undici` request API directly when a Node service needs pooling, HTTP/2 or pipelining. Skip `axios`: a supply-chain compromise of that package was reported in March 2026, and Node 18+ ships a built-in `fetch`, so `node-fetch` has no remaining job.

## The iron list

Fourteen rules. Each has a reason and a mechanical check (Biome, `tsc` or the audit script further down).

1. **Readonly by default.** Every property in a `type` or `interface` is `readonly`; arrays are `readonly T[]`. Mutable fields appear only where mutation is the documented purpose of the type.
2. **Branded types for distinct identifiers.** `type UserId = Brand<string, "UserId">`. A raw `string` is rejected wherever a branded type exists.
3. **Exhaustive switch.** A `switch` over a discriminated union ends in `default: return assertNever(x)`, and every case returns or breaks.
4. **`unknown` replaces `any`.** `any` is absent from annotations, return types and parameters. Narrow `unknown` with a guard or a schema.
5. **No type assertions that lie.** `as any` and `as unknown` are rewritten into proper types. `as const` and `satisfies` are the sanctioned forms.
6. **No non-null assertion.** `x!` becomes a narrowing check or `x?.y`.
7. **No suppression comments.** `@ts-ignore` and `@ts-expect-error` give way to a fix in the type.
8. **No `enum`.** Use an `as const` object plus a literal union.
9. **Zod at every trust boundary.** API payloads, user input, file contents and environment variables go through a schema. Internal values use plain types.
10. **Typed errors.** Domain failures are `Error` subclasses with typed fields. Use a `Result` when the caller is one or two frames away and must decide; throw when the failure travels through many layers.
11. **`as const` for module constants.** Constant objects and arrays are frozen to their literal types.
12. **`import type` for type-only imports.** `verbatimModuleSyntax` enforces it.
13. **Named exports.** `export default` appears only where a framework requires it (a Next.js page, a Bun entry that exports the app).
14. **Every `catch` earns its place.** A catch block either narrows with `instanceof` and handles each case, or rethrows. The only catch-all lives at a top-level boundary (CLI entry, HTTP handler, worker loop) and carries `// no-excuse-ok: catch`.

### Why an unnarrowed catch is a defect

`catch` receives `unknown`, so the language gives no safety there until you narrow. A block that logs and moves on treats `TypeError`, `RangeError` and a domain error identically; when a new failure appears, nothing flags it. The fix is always one of two shapes.

```typescript
// Rejected: empty and swallowing forms
try { await fetchData() } catch {}
try { await fetchData() } catch (e) { /* later */ }
try {
  await api.get("/users")
} catch (e) {
  console.error("failed", e)
}

// Accepted: narrow, handle the known case, rethrow the rest
try {
  await api.get("/users")
} catch (e) {
  if (e instanceof HttpError) {
    logger.warn(`API ${e.status}: ${e.message}`)
    return fallback
  }
  throw e
}

// Accepted: the single top-level boundary
async function main(): Promise<void> { // no-excuse-ok: catch
  try {
    await run()
  } catch (e) {
    console.error("unhandled:", e)
    process.exit(1)
  }
}
```

### Where readonly steps aside

| Situation | Reason |
|---|---|
| Framework state (React `useState`, signals) | The framework owns the update cycle |
| Builders and accumulators (buffers, caches) | The object exists to change; add a one-line comment saying so |
| ORM write payloads (Drizzle insert and update objects) | The library API takes mutable shapes |
| Test fixtures | Setup and teardown mutate them |

## Which construct for which data

| Situation | Use |
|---|---|
| Request or response from outside, user input, file content | Zod schema with `z.infer` |
| Internal value object | `type` with `readonly` fields |
| A function with several outcomes | Discriminated union keyed on `kind` |
| Contract that classes or modules implement | `interface` |
| Fixed set of constants | `as const` plus literal union |
| Distinct primitive (`UserId` and `OrderId`) | Branded type |
| Dictionary | `Record<K, V>` or an index signature |

The single governing rule: data that crosses a trust boundary passes through Zod; everything else is a plain `readonly` type. `data-modeling.md` carries the full decision flow.

## New project scaffold

The scaffold script writes a strict project in one step:

```bash
bun run ../../scripts/typescript/new-project.ts my-api
bun run ../../scripts/typescript/new-project.ts my-api --path ./projects
```

Output: `package.json` (Hono, Zod, Biome), `tsconfig.json` (full strict set), `biome.json`, `src/index.ts`, `.gitignore`. It runs on macOS, Linux and Windows. The script path is relative to this references folder; from the skill folder it is `scripts/typescript/new-project.ts`.

For a manual setup run `bunx tsc --init`, then replace the generated file with the config from `tsconfig-strict.md`.

Flags that go beyond `"strict": true`:

| Flag | Effect |
|---|---|
| `noUncheckedIndexedAccess` | `arr[0]` has type `T \| undefined`, so the check is forced |
| `exactOptionalPropertyTypes` | `{ x?: string }` and `{ x: string \| undefined }` become distinct types |
| `verbatimModuleSyntax` | Type-only imports must use `import type` |
| `noFallthroughCasesInSwitch` | A forgotten `break` or `return` becomes a compile error |
| `noPropertyAccessFromIndexSignature` | `.key` on an index signature requires bracket access |

## Reference loading order

Open files as the task needs them; each stands alone.

| Task | Open |
|---|---|
| Strict `tsconfig.json` and Biome settings | `tsconfig-strict.md` |
| Branded types, `as const`, `satisfies`, narrowing, `assertNever` | `type-patterns.md` |
| Choosing `type`, `interface` or Zod; readonly; parse at the edge | `data-modeling.md` |
| `Result`, typed errors, `cause`, HTTP error mapping | `error-handling.md` |
| Starting a project: runtime, package manager, framework, test runner | `bootstrap.md` |
| Hono service with OpenAPI, Scalar and Swagger UI | `backend-hono.md` |

## No-excuse audit

`scripts/typescript/check-no-excuse-rules.ts` scans the TypeScript sources for the patterns below. Run `bun run scripts/typescript/check-no-excuse-rules.ts <file-or-dir>...` from the skill folder after every editing session and before declaring a task done. Exit code 0 means clean, 1 means findings and 2 means an input error. Under headless `agy -p`, a refused `run_command` ends the run, so read the script header first to confirm its arguments, then request the permission once.

| Rule id | Finds | Opt-out comment |
|---|---|---|
| `no-any-assertion` | `as any` | none; redesign the type |
| `no-unknown-assertion` | `as unknown` | none; redesign the type |
| `no-ts-ignore` | `@ts-ignore` | none; fix the type |
| `no-ts-expect-error` | `@ts-expect-error` | none; fix the type |
| `no-enum` | `enum` declarations | none; use `as const` |
| `no-non-null-assertion` | postfix `x!` | none; narrow or use `?.` |
| `no-throw-literal` | `throw "text"` or `throw 123` | none; throw an `Error` subclass |
| `no-mutable-export` | `export let`, `export var` | none; use `export const` |
| `no-any-annotation` | `: any` in a parameter, return or variable type | `// no-excuse-ok: any` |
| `no-explicit-any-return` | `(): any` or `(): Promise<any>` | `// no-excuse-ok: any` |
| `empty-catch` | `catch {}` or `catch (e) {}` with an empty body | `// no-excuse-ok: catch` |
| `catch-without-narrowing` | `catch (e)` that neither uses `instanceof` nor rethrows | `// no-excuse-ok: catch` |

Biome adds `noExplicitAny`, `noNonNullAssertion`, `noDefaultExport` and `useImportType`. The audit script covers what Biome has no rule for. Leave the opt-out comment only at a genuine boundary and place it on the line it excuses.

## Verification order for a TypeScript change

1. `bunx biome check .` (or `pnpm exec biome check .`): lint and format.
2. `bunx tsc --noEmit`: the type check, with the strict flags from the shared config.
3. `bun test` or `pnpm exec vitest run`: behaviour.
4. The audit script above.
5. A run of the real entry point (start the server and request one route, or execute the CLI once). Green unit tests leave the wiring unproven.

Record the commands and their exit codes in the evidence note for the task. A change set that touched only types still gets steps 1 to 4.

## Tests follow the same list

Tests keep the iron list: branded identifiers, typed errors, exhaustive switches. Configure `biome.jsonc` overrides for `**/*.test.ts` so that a handful of allowances apply.

| In tests the following is fine | Reason |
|---|---|
| `expect()` assertions | The runner's contract |
| Literal numbers and strings in fixtures | Test data |
| Bracket access to private members | Inspecting internals |
| Mutable fixtures | Setup and teardown rewrite them |

## Existing code

When a touched file predates these rules, write the new lines in the strict style and leave the old lines alone in the same change. A conversion belongs in its own change with its own tests (see the `refactor` skill). Record the leftover violations in the report so the reader sees the gap.

## Activation

This reference applies whenever the work edits or creates a `.ts` or `.tsx` file, including throwaway scripts and test files.
