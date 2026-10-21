# Language-server and checker triage

Open this file when a user expects symbol navigation, diagnostics, rename or hover from agy, when a checker returns empty or contradictory results, or when someone runs a language server outside this plugin and wants it diagnosed.

Three different systems all get called "LSP support":

1. a language-server or checker executable installed on the machine;
2. a client that starts it and speaks its protocol, or reads its output;
3. an agy-visible tool that hands the result to the model.

agy 1.4.3 has the first (whatever the user installed) and, through `run_command`, a crude version of the second (the normaliser and the recipes in `cli-recipes.md`). It has no tool of the third kind: the tool list holds no LSP or diagnostics entry, and an editor that keeps a live server for itself gives agy nothing. A plugin cannot register a server for agy, because the plugin format has no LSP section. Re-probe on a newer agy build before repeating this as fact; `agy --help` and the tool list in a fresh session answer it for free.

## Establish the capability boundary

```sh
node "<skill-dir>/scripts/diagnostics.mjs" --tools
agy plugin list            # shows which plugins are installed; no entry here adds an LSP tool
```

Classify the request:

| User need | Required capability | Honest fallback in agy |
| --- | --- | --- |
| compile or type errors | compiler or type checker | the project's own command, or the normaliser |
| lint findings | linter | the project's configured linter, run without `--fix` |
| go to definition | symbol tool | `gopls definition`, `tsserver-query.mjs definition`, otherwise `rg` plus import tracing (textual) |
| find references | indexed workspace tool | `gopls references`, `tsserver-query.mjs references`, otherwise scoped `rg` (textual) |
| symbol rename | server rename edit | list references, edit region by region, compile and test |
| hover or type display | server hover | `tsserver-query.mjs quickinfo`, or `reveal_type` in a scratch copy |
| live post-edit diagnostics | a hook wired to a client | an explicit normaliser run after the edit |

A fallback is a different instrument from a protocol result, and the report says which one produced each claim. Text search finds lexical matches and leaves symbol identity unproven. A clean compile shows that the compiler accepts the code, and says nothing about every diagnostic an editor would show.

## Diagnosing an external server or contradictory results

Go in protocol order and stop at the first broken boundary. Reinstalling at every failure cannot repair a wrong root, an unsupported capability, a stale document version or a client that does not exist.

### 1. Executable and version

```sh
command -v <server>
<server> --version
```

Confirm the resolved binary rather than the package-manager record. A wrapper script can launch a different runtime than the one you expect. Version skew between an editor extension, a global binary, the project toolchain and the lockfile is a common source of contradictory output. Report the path that resolved (project-local, virtual environment or global) next to the version.

### 2. Root selection

Servers pick a project root from marker files (`tsconfig.json`, `go.mod`, `Cargo.toml`, `pyrightconfig.json`, `compile_commands.json`, `pom.xml`, `Package.swift`). In a monorepo the wrong root initializes fine and returns empty symbols and incomplete diagnostics. Capture the canonical root path, the config file selected, the target file, and whether generated, vendored and build directories are excluded. Run the checker from the directory that owns the config.

### 3. Initialization and capabilities

A client sends `initialize`, reads the capability object, then sends `initialized`. Rename, workspace symbols, semantic tokens and pull diagnostics are all optional features; read the response instead of assuming support. `lsp-setup/scripts/verify-lsp.mjs` performs this exchange for one file and reports whether the server published diagnostics.

### 4. Document lifecycle

For file-scoped features the document has to be opened with the right language id and version, and every edit has to be sent before the next question. Save-only servers need the file written to disk. When an edit lands in the wrong column, check position encoding: UTF-16 code units are the protocol default, while byte offsets and scalar counts are different numbers. `tsserver-query.mjs` takes an editor-style 1-based line and a 1-based column counted in UTF-16 units.

### 5. Indexing

Rust, Java, Kotlin, Haskell and Elixir servers index or compile before they answer fully. A bounded wait is the correct behavior; an unbounded one is a hang. When progress never completes, look at excluded paths and the build file, and give the first run a long `--timeout` once.

### 6. Result interpretation

An empty result can mean any of these:

- the server returned a valid empty set;
- the document was never opened;
- indexing is incomplete;
- the root is wrong;
- the feature is unsupported;
- the request timed out or was cancelled;
- the response belonged to an older document version;
- the client filtered it.

Tell them apart with logs and capability data. An empty list becomes "no problems" only after that step.

### 7. agy enrollment

| Boundary | Evidence | Typical correction |
| --- | --- | --- |
| executable | `command -v`, version output | use the project-pinned install and PATH |
| runtime | server startup stderr | align Node, JVM, .NET, Python or the native runtime |
| root | selected config and working directory | start from the package that owns the config |
| initialization | capability response | drop unsupported assumptions |
| document | path, language id, version | synchronise the right document |
| indexing | progress or log completion | wait with a bound, or fix excluded paths |
| feature | declared capability plus one request | rely on confirmed features only |
| agy enrollment | the session's tool list | stay in command-line mode when no tool exists |

## PATH and environment differences

The PATH of an `agy` session can differ from the user's interactive shell, especially for tools installed under `~/.local/bin`, `~/.cargo/bin`, `$(go env GOPATH)/bin`, `~/.dotnet/tools`, a Homebrew prefix that is not on the default PATH (LLVM is keg-only), or a version manager such as nvm, asdf, mise, pyenv or rbenv. When the user says a tool is installed and the normaliser reports `missing`, compare `command -v <tool>` in the session with the path the user sees, and report the mismatch without editing any shell profile. A fix such as `export PATH=...` in the user's profile is the user's decision.

## Safe rename without a rename tool

1. Collect every reference with the best tool available and record which tool answered.
2. Search transformed spellings and string keys separately from code references.
3. Edit in ownership regions and run the narrow checker after each region.
4. Finish with the project's full command and one user-visible scenario.
5. Review the diff for replacements inside strings, comments and generated files.

## Evidence record

For each claim keep:

```text
Need:
Capability expected:
Client surface:
Executable and version:
Root:
File and position:
Request or command:
Raw result or error:
Fallback command:
What this proves:
What stays unproven:
Cleanup:
```

Delete scratch logs that contain source text, environment values or private absolute paths. Confirm that no background server, port, temp directory or edited client configuration remains unless the user asked to keep it.
