# CLI recipes for diagnostics and navigation

agy has no language-server tool, so each question below is answered by a command line that you run with `run_command`. Every recipe is read-only. A recipe whose tool is absent becomes a `missing` row in your report; the install command is printed for the user and left unexecuted. `<skill-dir>` is the folder that holds the `lsp` SKILL.md. Positions are 1-based unless a recipe says otherwise. Quote paths that contain spaces.

Headless note: a refused `run_command` ends an `agy -p` run, so start with the cheapest probe and read config files with `read_file` before running anything heavier.

Probe first:

```sh
node "<skill-dir>/scripts/diagnostics.mjs" --tools      # inventory with versions, one JSON array
```

## Diagnostics for any supported language

```sh
node "<skill-dir>/scripts/diagnostics.mjs" src/a.ts src/b.ts      # scoped to the files named
node "<skill-dir>/scripts/diagnostics.mjs" --all src/a.ts          # everything the checker reported
node "<skill-dir>/scripts/diagnostics.mjs" --timeout=300 crate/src/lib.rs
node "<skill-dir>/scripts/diagnostics.mjs" --summary src/a.ts      # {"ran":[...],"diagnostics":[...]}
```

Output is one JSON array of `{file, line, col, severity, code, message, source}`. The severities `missing`, `failed` and `unsupported` are gaps. Exit `0` means no errors, `1` errors present, `2` usage, `3` gaps only. A run that exits 3 leaves the work unverified.

## TypeScript and JavaScript

| Need | Command | Notes |
| --- | --- | --- |
| Diagnostics, project mode | `tsc --noEmit --pretty false -p tsconfig.json` | Output is `path(line,col): error TSnnnn: message`. Prefer `node_modules/.bin/tsc`. |
| Diagnostics for a loose file | `tsc --noEmit --pretty false --skipLibCheck --allowJs --checkJs file.ts` | No project flags apply; say so in the report. |
| Which config applied | `tsc --showConfig -p tsconfig.json` | Confirms `strict`, `paths`, `include`. |
| Why a module resolves where it does | `tsc --noEmit --traceResolution -p tsconfig.json \| rg "'./lib'"` | A definition answer for imports and re-exports. |
| Definition at a position | `node "<skill-dir>/scripts/tsserver-query.mjs" definition <file> <line> <col>` | Talks to the project's own `typescript` package. Exit 3 when `typescript` is absent. |
| References at a position | `node "<skill-dir>/scripts/tsserver-query.mjs" references <file> <line> <col>` | Returns `refs[]` with file, start and end; includes the definition. |
| Type and docs at a position | `node "<skill-dir>/scripts/tsserver-query.mjs" quickinfo <file> <line> <col>` | `displayString` carries the type. |
| Rename preview | `node "<skill-dir>/scripts/tsserver-query.mjs" rename <file> <line> <col>` | Lists every location a rename would touch; applies nothing. |
| Lint findings | `eslint --format json <files>` | Run it when the project already configures ESLint, and leave out `--fix`. |

`typescript-language-server` has no one-shot command line. When it is installed it serves an editor, and for agy the `tsserver-query.mjs` helper reaches the same `tsserver` underneath. The helper takes an editor-style 1-based line and column, with the column counted in UTF-16 code units, which matters on lines that hold emoji or other astral characters. It reports `missing` when `typescript` is absent and installs nothing.

Monorepo note: run from the package that owns the `tsconfig.json`, or let the normaliser find the nearest one above the file. A root `tsconfig.json` with `references` and `"files": []` checks nothing by itself. Use `tsc -b --noEmit` only when the project already builds that way, and report that build mode can write `.tsbuildinfo`.

Vue, Svelte and Astro files need their own checkers (`vue-tsc --noEmit`, `svelte-check`, `astro check`); the normaliser reports `unsupported` for them and the project command takes over.

## Python

| Need | Command | Notes |
| --- | --- | --- |
| Type diagnostics | `pyright --outputjson <files>` (or `basedpyright`) | `generalDiagnostics[]` with a 0-based `range`; the normaliser converts it to 1-based. |
| Type reveal | add `reveal_type(expr)` in a scratch copy, run `pyright <scratch>` | Keep the call out of the real file. |
| Lint findings | `ruff check --output-format json --no-cache <files>` | Leave out `--fix`. |
| Type diagnostics, fallback | `mypy --show-column-numbers --show-error-codes --no-error-summary --no-color-output <files>` | The normaliser uses it when pyright is absent. |
| Syntax only | `python3 -I -c "import sys; compile(open(sys.argv[1]).read(), sys.argv[1], 'exec')" <file>` | Available wherever python3 is; labelled syntax-only. |
| References, textual | `rg -n --word-regexp '<name>' --glob '*.py'` | Label as textual; it cannot tell a method from a same-named attribute. |
| Environment problems | `pyright --verbose <file> 2>&1 \| head -40` | Shows which interpreter and `venvPath` were used. |

Python has no standard one-shot go-to-definition command line. Use `rg` for candidates, follow the import chain with `read_file`, and call the result textual. The normaliser looks in the nearest `.venv/bin` and `venv/bin` before PATH, so a project-local pyright or ruff is found without activating the environment.

## Go

| Need | Command | Notes |
| --- | --- | --- |
| Diagnostics | `gopls check <files>` | Prints `file:line:col-col: message`. |
| Diagnostics, fallback | `go vet ./...` at the module root | Package level; includes compile errors. |
| Build errors | `go build ./... 2>&1` | Writes nothing for a multi-package build; add `-o /dev/null` for a single main package. |
| Definition | `gopls definition file.go:LINE:COL` | Also accepts `file.go:#BYTE_OFFSET`. |
| References | `gopls references file.go:LINE:COL` | Add `-d` to include the declaration. |
| Implementations | `gopls implementation file.go:LINE:COL` | Interface to concrete types and back. |
| Rename preview | `gopls rename -d file.go:LINE:COL newName` | `-d` prints a diff and writes nothing. Leave out `-w`. |
| Symbols in a file | `gopls symbols file.go` | Quick outline. |
| Call hierarchy | `gopls call_hierarchy file.go:LINE:COL` | Callers and callees. |

Outside a module (`go.mod` missing) gopls degrades to per-file results; start from the directory that holds `go.mod` or `go.work`. The subcommand set grows with gopls releases, so run `gopls help` once and trust its list over this table when they differ.

## Rust

| Need | Command | Notes |
| --- | --- | --- |
| Diagnostics | `cargo check --message-format=json --all-targets --quiet` | JSON lines; `compiler-message` carries `level`, `code.code` and the primary `spans[]`. |
| Lints | `cargo clippy --message-format=json --all-targets --quiet` | Run it when clippy is installed. |
| Server-grade diagnostics | `rust-analyzer diagnostics .` | Slow on large workspaces; raise `--timeout=300` on the normaliser or run it directly. |
| References, textual | `rg -n --word-regexp '<name>' --glob '*.rs'` | Label as textual. |
| Type of an expression | provoke a mismatch in a scratch copy (`let _: () = expr;`) and read the `mismatched types` message | Keep it out of the real file. |

`rust-analyzer` has `symbols`, `analysis-stats` and `ssr` subcommands; none of them applies edits without a write flag. Use `rust-analyzer ssr` only as a preview. The first `cargo check` in a fresh checkout builds dependencies, so give it a long `--timeout` once instead of retrying.

## C and C++

| Need | Command | Notes |
| --- | --- | --- |
| Diagnostics | `clangd --check=<file>` | Needs `compile_commands.json` for real flags. The normaliser parses `E[...] [code] Line N:` rows. |
| Diagnostics, fallback | `clang -fsyntax-only -fno-color-diagnostics <file>` | Add `-x c++` for C++ headers. Build-system flags are absent, so say so. |
| Compilation database | `ls compile_commands.json build/compile_commands.json` | Missing means include paths and defines are guesses. |
| Lint | `clang-tidy -p build <file>` | Needs the database; report the findings as lint. |

## Shell

```sh
shellcheck -f json file.sh          # SCnnnn codes, line and column
bash -n file.sh                     # syntax only
```

`.zsh` and `.ksh` files are linted as bash by ShellCheck, and shell-specific syntax can raise false findings; state that in the report.

## Other languages (project commands as evidence)

The normaliser has no parser for these. Cite the command and its exit code as the evidence, and say that no language checker output was normalised.

| Language | Command | Notes |
| --- | --- | --- |
| Java | `mvn -q -DskipTests compile` or `./gradlew compileJava` | Compile errors only. `javac -Xlint:all -d <scratch-dir> <files>` works for a loose file; point `-d` at a scratch directory you delete afterwards. |
| Kotlin | `./gradlew compileKotlin` | The first run resolves dependencies and takes minutes. |
| C# | `dotnet build --no-restore -v q` | Run `dotnet restore` first (the user approves it); an unrestored solution gives noise. |
| Swift | `swift build` or `swiftc -typecheck <file>` | `swiftc -typecheck` handles a single file without a package. |
| Ruby | `bundle exec rubocop --format json <files>` and `ruby -wc <file>` | `ruby -wc` is syntax plus warnings. |
| PHP | `php -l <file>` and `vendor/bin/phpstan analyse --error-format=json <files>` | `php -l` is syntax only. |
| Dart | `dart analyze --format=machine` or `flutter analyze` | The machine format prints one pipe-separated row per finding. |
| Elixir | `mix compile --warnings-as-errors` | Compiles the project and may write `_build/`. |
| Zig | `zig ast-check <file>` and `zig build --summary all` | `ast-check` is syntax and AST only. |
| Lua | `lua-language-server --check <dir> --checklevel=Warning` and `luac -p <file>` | The first is a real one-shot workspace check; the second is syntax only. |
| YAML | `yamllint -f parsable <file>` and `check-jsonschema --schemafile <schema> <file>` | The schema check needs a schema. |
| Terraform | `terraform validate -json` and `terraform fmt -check` | `validate` needs a prior `terraform init`, which downloads providers and belongs to the user. |
| Haskell | `cabal build all` or `stack build` | Slow on the first run. |
| Julia | `julia --project -e 'using Pkg; Pkg.test()'` | Runs the test suite; there is no syntax-only check. |
| Dockerfile | `hadolint <file>` | Lint only. |

## Structural search (any language)

```sh
ast-grep run -p '$FN($$$ARGS)' -l ts --json=compact src     # pattern search, read-only
ast-grep scan --json=compact                                  # rule files when the repo has sgconfig.yml
```

`ast-grep` (binary `ast-grep` or `sg`) searches by syntax tree and is a closer match to a symbol query than `rg` when the question is "every call of this shape". It is a pattern engine, so it still cannot resolve which declaration a name refers to. Use `--rewrite` only through the `structural-search` skill, which previews and applies codemods safely.

## Textual fallback (labelled)

```sh
rg -n --word-regexp '<name>' --glob '!node_modules' --glob '!target' --glob '!dist'
rg -n --type-add 'src:*.{ts,tsx,py,go,rs}' --type src '<name>\('
```

Report such a result as "textual references, N hits across M files; shadowing and dynamic access unchecked". For a rename, classify every hit as code, string or key, configuration, generated file, or documentation before editing.

## Reading a result honestly

| Observation | It means | It leaves open |
| --- | --- | --- |
| Empty array, checker listed `present` | The checker ran on the named files and found nothing | Whether the project builds, and whether untouched files are fine |
| Row with `severity: missing` | Nothing ran | Whether the code is clean or broken |
| Row with `severity: failed` | The tool started or tried to start and gave no parseable output | Anything about the code |
| `source` ending in `(syntax only)` | A parser accepted or rejected the file | Any type or lint result |
| `gopls references` returns one hit | The declaration only, in the package gopls loaded | Callers in other modules |
| `rg` finds ten hits | Ten lexical matches | Ten references |
| `--summary` shows `ran: []` | No checker started | Everything about the code |
