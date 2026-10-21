# YAML: language-server and checker setup

- **Server id:** `yaml-ls`, launched as `yaml-language-server --stdio`
- **Extensions:** `.yaml .yml`
- **Checkers agy can drive:** `yamllint`, `check-jsonschema`, `actionlint` for GitHub workflows
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `yamllint -f parsable <file>` is the evidence
- **Evidence command when nothing is normalised:** `yamllint -f parsable <file>`

## What this gives you in agy

YAML checking has two layers: syntax and style (yamllint) and schema validation (the language server or check-jsonschema). The server validates only when a schema applies to the file; otherwise it checks syntax.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- Node.js for the language server
- Python tooling for `yamllint` and `check-jsonschema` (`uv tool install` or `pipx install`)

## Install (the user runs these)

**macOS**

- `npm install -g yaml-language-server` or `brew install yaml-language-server`
- `brew install yamllint`, and `brew install check-jsonschema` for schema checks
- GitHub workflows: `brew install actionlint`

**Linux**

- `npm install -g yaml-language-server`
- `sudo apt install yamllint` (or `pipx install yamllint`), `pipx install check-jsonschema`
- GitHub workflows: an actionlint release from https://github.com/rhysd/actionlint/releases

**Windows**

- `npm install -g yaml-language-server`
- `pip install yamllint check-jsonschema`
- GitHub workflows: `scoop install actionlint`

Confirm afterwards:

```sh
command -v yaml-language-server yamllint check-jsonschema
```

Validation needs a schema. Without one the server checks syntax only.

## Project configuration

- a `# yaml-language-server: $schema=<url>` modeline in the file, or `yaml.schemas` in the client settings
- `.yamllint`, `.yamllint.yml` or `.yamllint.yaml` for lint rules
- Kubernetes manifests, GitHub workflows, Compose files and OpenAPI documents each have a public schema (https://www.schemastore.org/)

```yaml
# yaml-language-server: $schema=https://json.schemastore.org/github-workflow.json
name: ci
on: [push]
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `yamllint -f parsable` | lint CLI with line and column output |
| `check-jsonschema --schemafile <schema> <file>` | schema validation CLI |
| `actionlint` | GitHub Actions workflows, with expression checking |

## Troubleshooting

- **No validation:** no schema matched; add a modeline or a `yaml.schemas` entry.
- **Wrong schema applied:** SchemaStore guesses by file name; pin the schema explicitly.
- **PATH:** open a new shell after a global npm install.
- **Multi-document files:** a `---` separator starts a new document and some schemas validate only the first; check one document at a time.
- **Tabs:** YAML forbids tab indentation; yamllint reports the exact column.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" .github/workflows/ci.yml                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" .github/workflows/ci.yml --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
