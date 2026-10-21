# Strict tsconfig and Biome

The reference configuration for every TypeScript project this skill touches. Copy it, then add path aliases and project-specific `include` entries. Each setting below has a reason; when a flag blocks a legitimate pattern, fix the pattern and keep the flag.

---

## tsconfig.json

```jsonc
{
  "compilerOptions": {
    // Strict core
    "strict": true, // switches on every strict* flag listed next
    // strictNullChecks, strictFunctionTypes, strictBindCallApply,
    // strictPropertyInitialization, noImplicitAny, noImplicitThis,
    // alwaysStrict, useUnknownInCatchVariables

    // Strictness that "strict" leaves out
    "noUncheckedIndexedAccess": true,           // obj[key] has type T | undefined
    "exactOptionalPropertyTypes": true,         // { x?: string } excludes an explicit undefined
    "noImplicitReturns": true,                  // every code path returns
    "noImplicitOverride": true,                 // overriding members need the override keyword
    "noFallthroughCasesInSwitch": true,         // a case that falls through is an error
    "noPropertyAccessFromIndexSignature": true, // index signatures need obj["key"]
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,   // case-insensitive file systems cannot hide typos

    // Module system
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,               // type-only imports use import type
    "isolatedModules": true,                    // each file transpiles alone (esbuild, swc, Bun)
    "esModuleInterop": true,
    "resolveJsonModule": true,

    // Target
    "target": "ESNext",
    "lib": ["ESNext"],

    // Emit (libraries only; applications set noEmit)
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",

    // Performance
    "skipLibCheck": true,                       // skip .d.ts files from dependencies
    "incremental": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### What each extra flag buys

| Flag | Bug it removes |
|---|---|
| `noUncheckedIndexedAccess` | `arr[0]` and `record[key]` carry `undefined`, so a missing element is handled in the type |
| `exactOptionalPropertyTypes` | `{ x?: string }` means "absent or a string". Assigning `undefined` explicitly is an error, which keeps "unset" and "set to nothing" apart in serialised payloads |
| `noImplicitReturns` | A branch that falls off the end of a function returning a value |
| `noImplicitOverride` | A subclass method that silently stops overriding after a base rename |
| `noFallthroughCasesInSwitch` | A forgotten `break` or `return` inside a `switch` |
| `noPropertyAccessFromIndexSignature` | `obj.foo` on `Record<string, X>` hides that the key may be absent; `obj["foo"]` shows the lookup |
| `verbatimModuleSyntax` | A type imported as a value, which leaves a runtime import behind |
| `isolatedModules` | Constructs a single-file transpiler cannot compile (const enums across files, re-exported types without `type`) |

### Variants

Application on Bun: add `"types": ["bun"]`, `"moduleDetection": "force"`, `"noEmit": true`, and install `@types/bun` as a dev dependency. Drop the emit block because `bun run` and `bun build` handle compilation and `tsc` is a checker only.

```jsonc
{
  "compilerOptions": {
    "types": ["bun"],
    "moduleDetection": "force",
    "noEmit": true
  }
}
```

Library for npm: keep the emit block, set `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` when the package targets Node directly (file imports then need explicit `.js` extensions), and build with `tsdown` for dual ESM and CJS output.

Monorepo: put the shared options in `tsconfig.base.json` and let each package extend it with `"extends": "../../tsconfig.base.json"` plus its own `include`. Add `"composite": true` and project `references` when packages import each other's types.

Frontend with Vite: use `"jsx": "react-jsx"`, `"lib": ["ESNext", "DOM", "DOM.Iterable"]` and `"noEmit": true`; Vite transpiles, `tsc --noEmit` checks.

### Adopting the flags in an existing project

Turn the flags on one at a time, fixing the fallout between steps, in this order: `strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. The last two produce the most errors; budget a separate change for each. Count errors with `bunx tsc --noEmit | grep -c "error TS"` before and after so the report carries numbers.

---

## biome.jsonc

Biome 2.x layout (schema 2.0 or newer). Import sorting moved from `organizeImports` to the `assist` block, and file filters moved from `files.ignore` to `files.includes` with negated globs.

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0.6/schema.json",
  "assist": {
    "actions": {
      "source": { "organizeImports": "on" }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noConfusingVoidType": "error",
        "noFallthroughSwitchClause": "error"
      },
      "style": {
        "noDefaultExport": "error",
        "useImportType": "error",
        "noNonNullAssertion": "error",
        "noParameterAssign": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "complexity": {
        "noBannedTypes": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "includes": ["**", "!**/node_modules", "!**/dist", "!**/build", "!**/.next", "!**/.nuxt", "!**/coverage"]
  },
  "overrides": [
    {
      "includes": ["**/*.test.ts", "**/*.test.tsx"],
      "linter": { "rules": { "style": { "noNonNullAssertion": "off" } } }
    }
  ]
}
```

On Biome 1.x the same intent reads `"organizeImports": { "enabled": true }` at the top level and `"files": { "ignore": [...] }`. Run `bunx biome migrate --write` to convert a 1.x file to 2.x.

### Biome rules that carry the iron list

| Rule | Enforces |
|---|---|
| `noExplicitAny` | `any` in annotations is an error |
| `noNonNullAssertion` | postfix `x!` is an error |
| `noDefaultExport` | named exports only (framework entry files get an override) |
| `useImportType` | type-only imports use `import type` |
| `noParameterAssign` | function parameters stay unmodified |
| `noUnusedVariables`, `noUnusedImports` | dead code leaves with the change that orphaned it |

Framework files that require a default export (route modules, config files such as `vite.config.ts`) get a scoped override in `overrides`, listed by path, so the rule stays on everywhere else.

### Biome and the type checker split the work

Biome reads syntax and some type-aware information; it does not run the TypeScript checker. A green `biome check` leaves type errors undetected, so both commands appear in every gate.

---

## CI gate

```bash
bunx biome check .
bunx tsc --noEmit
bun test
```

For a pnpm project replace `bunx` with `pnpm exec` and `bun test` with `pnpm exec vitest run`. Add the audit script (`scripts/typescript/check-no-excuse-rules.ts`) as a fourth step. Order the steps from cheapest to most expensive so a style slip fails in seconds.

---

## Sources

- TypeScript: [tsconfig reference](https://www.typescriptlang.org/tsconfig)
- Biome: [configuration](https://biomejs.dev/reference/configuration/)
- Total TypeScript: [tsconfig cheat sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet)
