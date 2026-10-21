# PHP: language-server and checker setup

- **Server id:** `php`, launched as `intelephense --stdio`
- **Extensions:** `.php`
- **Checkers agy can drive:** `php -l`, `phpstan`, `psalm`, `phpcs`
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `php -l <file>` for syntax and `vendor/bin/phpstan analyse --error-format=json` when the project has it
- **Evidence command when nothing is normalised:** `vendor/bin/phpstan analyse --error-format=json`

## What this gives you in agy

PHP evidence comes from the interpreter's lint mode (syntax only) and from a static analyser such as PHPStan when the project adopted one. Intelephense is a Node package and serves the editor.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- PHP on PATH for `php -l`: macOS `brew install php`, Debian or Ubuntu `sudo apt install php-cli`, Windows from https://windows.php.net/download/ or `scoop install php`
- Node.js for Intelephense
- Composer for project tools: `brew install composer`, `sudo apt install composer`

## Install (the user runs these)

**macOS**

- `npm install -g intelephense`
- project analyser: `composer require --dev phpstan/phpstan`

**Linux**

- `npm install -g intelephense`
- project analyser: `composer require --dev phpstan/phpstan`

**Windows**

- `npm install -g intelephense`
- project analyser: `composer require --dev phpstan/phpstan`

Confirm afterwards:

```sh
command -v intelephense php composer; php -v; ls vendor/bin/phpstan
```

Intelephense premium features need a licence key that belongs to the user and goes into the editor's own settings; LitGravity does not handle it.

## Project configuration

- `composer.json` and `vendor/` for autoload resolution
- `phpstan.neon` or `phpstan.neon.dist` for the analysis level; `psalm.xml` for Psalm
- `.php-cs-fixer.php` or `phpcs.xml` for style rules

```yaml
parameters:
  level: 6
  paths:
    - src
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `phpactor language-server` | open-source alternative server |
| `vendor/bin/psalm --output-format=json` | Psalm static analysis |
| `vendor/bin/phpcs --report=json <file>` | style findings |

## Troubleshooting

- **PATH:** open a new shell after a global npm install.
- **No Node.js:** install Node, then the package.
- **Wrong PHP version inferred:** set the `phpVersion` initialization option (`intelephense.environment.phpVersion` in editors) to match the project.
- **Classes not found:** run `composer install` (the user approves it) so the Composer autoloader under `vendor` exists.
- **`php -l` passes but the page fails:** lint is syntax only; PHPStan or the test suite covers types and behaviour.

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" src/App.php                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" src/App.php --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
