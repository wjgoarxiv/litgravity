# Bootstrap: Runtime, Package Manager, Tooling

The first hour of a TypeScript project fixes its runtime, package manager, framework and toolchain, and those choices compound for years. This file gives the defaults for 2026, the decision tree behind them, and a quick start that ends with a running, documented service.

## Runtime decision tree

```
Is it a CLI, a script or a single-binary tool?
  yes -> Bun. `bun run script.ts` executes TypeScript directly; no build step.

Is it a backend service?
  Edge platform (Cloudflare Workers, Vercel, Deno Deploy) -> match the platform runtime
  Bun supported on the target                              -> Bun + Hono
  Needs Node-only native modules (sharp, binding-based drivers) -> Node + Hono
  anything else                                            -> Bun + Hono

Is it a frontend?
  Vite, whatever the UI framework. Bun or pnpm installs the packages.

Is it a library published to npm?
  tsdown (or unbuild) targeting Node 20+. pnpm workspaces for a monorepo.
```

## Bun as the default

Use Bun for scripts and CLIs (`bun run` starts faster than a `tsx` or `ts-node` wrapper), for new backends (Hono runs natively and `bun --hot` reloads code in place), for tests (`bun test` is built in) and for installs (`bun install` outpaces pnpm and far outpaces npm). `bunx` stands in for `npx` and `bun create` scaffolds templates.

Switch to Node when a dependency loads native modules Bun cannot (rare in 2026, so read the dependency's release notes first), when the production platform only offers a Node runtime, or when the work is a contribution to a Node-only project. State the reason in the plan so the next reader sees it was a decision.

## Package manager: pnpm on Node

When the project runs on Node, install with pnpm.

- A content-addressable store cuts disk use by a large factor on a machine with many projects.
- The strict `node_modules` layout turns phantom dependencies into install-time failures; with npm they surface in production.
- Workspaces are first class.
- Installs finish faster than with npm.

Yarn classic is unmaintained, and Yarn Berry's Plug'n'Play mode confuses editor tooling more often than a team wants to debug. npm remains acceptable only inside a legacy project you do not control.

```bash
# Convert a project from npm or yarn to pnpm
pnpm import                        # reads package-lock.json or yarn.lock, writes pnpm-lock.yaml
rm -rf node_modules package-lock.json yarn.lock
pnpm install
```

Pin the manager in `package.json` so every machine and CI runner agrees: `"packageManager": "pnpm@<version>"` (use `corepack enable` to honour it). Commit the lockfile.

## Backend framework: Hono

Hono is the framework for every new HTTP service.

- Types flow from route definition through middleware to the handler.
- It runs on Bun, Node, Cloudflare Workers, Deno and AWS Lambda from one codebase.
- Benchmarks place it ahead of Express and Fastify.
- Documentation and maintenance are active.

Pair Hono with `hono-openapi`, `@scalar/hono-api-reference` and `@hono/swagger-ui` from the first commit, so the OpenAPI document and both explorers exist before the second route does. The copy-ready `app.ts` lives in [backend-hono.md](backend-hono.md).

Frameworks this stack replaces, and the reason for each:

| Framework | Reason it stays out of new services |
|---|---|
| Express | Callback-era design; no typed request flow; slower than current peers |
| Fastify | Works well; Hono's TypeScript ergonomics and multi-runtime reach win |
| NestJS | Decorator-and-DI machinery is more than about 95 percent of services need |
| bare `Bun.serve` or `node:http` | Routing, validation and middleware would be rebuilt by hand |

## Frontend tooling: Vite

Vite replaces webpack, parcel and rollup-as-app-bundler for React, Vue, Svelte, Solid, Preact or plain TypeScript.

```bash
bun create vite my-app --template react-ts
cd my-app
bun install
bun run dev
```

Pair a data-heavy single-page app with TanStack Query and TanStack Router. Add `vitest` as the runner because it shares Vite's resolver.

## Lint and format: Biome

Biome folds ESLint and Prettier into one Rust binary that runs roughly thirty times faster.

```bash
bun add --dev @biomejs/biome
bunx biome init
```

Use the full config from `tsconfig-strict.md` (Biome 2.x schema). Reach for ESLint only when the project depends on a plugin Biome has no equivalent for, or when contributing to an ESLint-based repository. Run exactly one of the two tools in a project, because two formatters produce endless diffs against each other.

## Test runner

| Runner | Pick it when |
|---|---|
| `bun test` | Bun project, unit tests, no vite-style path resolution needed |
| `vitest` | Vite frontend, DOM tests, snapshots, browser mode, or a vitest-only feature |

Jest is a poor fit for a new project: its CommonJS-first design fights ESM, and TypeScript support needs extra transforms.

## TypeScript configuration

For a Bun and Hono backend the config is the strict one from `tsconfig-strict.md` with the Bun additions:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

`verbatimModuleSyntax` makes `import type` mandatory for type-only imports, which pairs with the lint rule. `noEmit` turns `tsc` into a pure checker because `bun run` and `bun build` compile.

## Quick start: Bun and Hono backend

```bash
mkdir my-api && cd my-api
bun init -y
bun add hono hono-openapi @scalar/hono-api-reference @hono/swagger-ui zod
bun add --dev @biomejs/biome typescript @types/bun
bunx biome init
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "build": "bun build src/index.ts --target bun --outdir dist",
    "typecheck": "tsc --noEmit",
    "lint": "biome check --write src tests",
    "test": "bun test"
  }
}
```

Wire the `app.ts` from [backend-hono.md](backend-hono.md) into `src/index.ts`. The result is a validated service that publishes its own OpenAPI document, reachable in about fifteen minutes.

The scaffold script performs these steps in one command and writes the strict configs: `bun run ../../scripts/typescript/new-project.ts my-api` (path relative to this references folder).

## Verifying the bootstrap

Run all of these in the new project before the first commit, and keep the output in the evidence note:

1. `bun run typecheck` exits 0.
2. `bunx biome check .` exits 0.
3. `bun run dev` starts, and `curl -s localhost:3000/health` returns `{"status":"ok"}`.
4. `curl -s localhost:3000/openapi.json` returns a document with `"openapi":"3.1.0"`.
5. `bun test` exits 0 with at least one real test.

Under a headless `agy -p` run the dev server blocks the shell. Start it with the `run_command` async option (or a trailing `&` plus a saved PID), probe it, then stop the process before the final reply.

## When a from-scratch bootstrap is the wrong move

| Situation | Better start |
|---|---|
| Internal tool with auth, admin screens and dashboards | Next.js full-stack; most wiring arrives free |
| Documentation site | Astro or VitePress |
| Real-time features (WebRTC, heavy sockets) | Bun + Hono + a dedicated real-time library |
| Data-heavy SPA | Vite + React + TanStack Query + TanStack Router |

For a greenfield backend service the answer is Bun and Hono.
