# Terraform: language-server and checker setup

- **Server id:** `terraform`, launched as `terraform-ls serve`
- **Extensions:** `.tf .tfvars`
- **Checkers agy can drive:** `terraform validate`, `terraform fmt -check`, `tflint`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `terraform validate -json` (after `terraform init`) and `terraform fmt -check -recursive` are the evidence
- **Evidence command when nothing is normalised:** `terraform validate -json`

## What this gives you in agy

Terraform validation needs an initialised working directory. `terraform init` downloads providers and modules, so it belongs to the user; `terraform fmt -check` works without it.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- the `terraform` binary (or OpenTofu) next to the language server

## Install (the user runs these)

**macOS**

- `brew tap hashicorp/tap && brew install hashicorp/tap/terraform`
- `brew install hashicorp/tap/terraform-ls`
- optional lint: a tflint release from https://github.com/terraform-linters/tflint/releases

**Linux**

- add the HashiCorp package repository (https://developer.hashicorp.com/terraform/install), then `sudo apt install terraform terraform-ls` (or `sudo dnf install terraform terraform-ls`)
- release zips: https://releases.hashicorp.com/terraform-ls/
- optional lint: a tflint release from https://github.com/terraform-linters/tflint/releases

**Windows**

- `winget install Hashicorp.Terraform` or `choco install terraform`
- `choco install terraform-ls`
- optional lint: `choco install tflint`

Confirm afterwards:

```sh
command -v terraform-ls terraform tflint; terraform version
```

`terraform validate` reads `.terraform/`, which `terraform init` creates. Without init it reports missing providers.

## Project configuration

- `.terraform.lock.hcl` and the `.terraform/` provider cache
- `versions.tf` pinning `required_version` and providers
- `.tflint.hcl` for lint rules (`tflint --init` downloads plugins, so the user runs it)

```hcl
terraform {
  required_version = ">= 1.6"
}
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `tflint` | lint CLI with provider-aware rules |
| `tofu validate` | OpenTofu projects |
| `trivy config .` | security misconfiguration scan |

## Troubleshooting

- **PATH:** both `terraform-ls` and `terraform` must resolve.
- **No provider completion or validation:** `terraform init` has not been run; the user runs it.
- **`.tfvars` not analysed:** open the containing module so the server has root context.
- **Backend credentials:** `terraform init` can contact the remote backend; use `terraform init -backend=false` when only validation is needed, and let the user choose.
- **Several roots in one repository:** run the checks per module directory.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" main.tf                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" main.tf --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
