# TypeScript and JavaScript: language-server and checker setup

- **Server id:** `typescript`, launched as `typescript-language-server --stdio`
- **Extensions:** `.ts .tsx .mts .cts .js .jsx .mjs .cjs` (`.vue`, `.svelte` and `.astro` need their own servers)
- **Checkers agy can drive:** `tsc` (project mode), `eslint`, and the `tsserver-query.mjs` helper for definition, references, type and rename preview
- **Normalised by `lsp/scripts/diagnostics.mjs`:** yes, `tsc --noEmit --pretty false`; navigation through `lsp/scripts/tsserver-query.mjs`
- **Evidence command when nothing is normalised:** `npx tsc --noEmit -p tsconfig.json`

## What this gives you in agy

TypeScript is the one language where agy gets a real symbol tool without a language server. `tsserver-query.mjs` starts the project's own `tsserver`, opens one file and answers a single `definition`, `references`, `quickinfo` or `rename` request. The language-server wrapper below is optional for agy and useful to an editor.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Node.js, a current LTS release (`node --version`)
- the `typescript` package in the project, because `tsc` and `tsserver-query.mjs` both use it

## Install (the user runs these)

**macOS**

- project-local (preferred): `npm install --save-dev typescript typescript-language-server`
- global: `npm install -g typescript typescript-language-server`
- Homebrew alternative for the wrapper: `brew install typescript-language-server` (it still needs a `typescript` package)

**Linux**

- project-local (preferred): `npm install --save-dev typescript typescript-language-server`
- global: `npm install -g typescript typescript-language-server`; with a system Node a prefix such as `npm config set prefix ~/.local` avoids `sudo`
- other package managers: `pnpm add -D typescript typescript-language-server`, `yarn add -D ...`, `bun add -d ...`

**Windows**

- project-local (preferred): `npm install --save-dev typescript typescript-language-server`
- global: `npm install -g typescript typescript-language-server`; the binaries land in `%AppData%\npm`, which must be on PATH
- install Node first with `winget install OpenJS.NodeJS.LTS` when it is missing

Confirm afterwards:

```sh
command -v typescript-language-server; ls node_modules/.bin/tsc; npx tsc --version
```

`typescript-language-server` is a thin wrapper over `tsserver`; it needs the `typescript` package next to it, in the project `node_modules` or globally. Only `typescript` matters for the agy path.

## Project configuration

- `tsconfig.json` (or `jsconfig.json` for plain JavaScript) at the package root decides `strict`, `paths`, `include` and `references`
- in a monorepo each package owns its `tsconfig.json`; run the checker from the package that owns the file
- `eslint.config.js` or `.eslintrc.*` when the project lints with ESLint

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `deno lsp` | Deno projects (`deno check` is the matching one-shot checker) |
| `biome lsp-proxy` | Biome as lint and format server (`biome check --reporter=json` on the CLI) |
| `vscode-eslint-language-server --stdio` | ESLint diagnostics (`npm i -g vscode-langservers-extracted`) |
| `oxlint --lsp` | fast Oxc linting where the project already uses oxlint |
| `vue-language-server --stdio` | `.vue` files (`vue-tsc --noEmit` on the CLI) |
| `svelteserver --stdio` | `.svelte` files (`svelte-check` on the CLI) |
| `astro-ls --stdio` | `.astro` files (`astro check` on the CLI) |

## Troubleshooting

- **PATH:** global npm binaries need the directory printed by `npm prefix -g` plus `/bin` on PATH; open a new shell after `npm i -g`.
- **"Could not find a valid tsserver":** the `typescript` package is missing; install it in the project or globally.
- **Path aliases unresolved:** the check ran without the project config. Use project mode (`-p tsconfig.json`) and state which config applied.
- **Solution-style root tsconfig** (`"files": []` plus `references`): the root checks nothing; run from the package, or use `tsc -b --noEmit` when the project already builds that way (it can write `.tsbuildinfo`).
- **Different results from the editor:** the editor may use its bundled TypeScript; compare `npx tsc --version` with the editor's version.
- **JavaScript files report nothing:** `checkJs` is off. The loose per-file mode of the normaliser turns it on; project mode follows the project's own setting.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/index.ts                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/index.ts --via=checker           # force the checker path
node "<skill-dir>/../lsp/scripts/diagnostics.mjs" src/index.ts               # normalised CLI diagnostics
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

For navigation, `node "<skill-dir>/../lsp/scripts/tsserver-query.mjs" definition src/index.ts 10 5` answers from the same `tsserver` the wrapper uses.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
