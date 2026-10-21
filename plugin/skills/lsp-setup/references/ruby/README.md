# Ruby: language-server and checker setup

- **Server id:** `ruby-lsp`, launched as `ruby-lsp`
- **Extensions:** `.rb .rake .gemspec .ru`
- **Checkers agy can drive:** `rubocop`, `ruby -wc`, Sorbet `srb tc` when the project uses it
- **Normalised by `lsp/scripts/diagnostics.mjs`:** no; `bundle exec rubocop --format json <files>` is the evidence
- **Evidence command when nothing is normalised:** `bundle exec rubocop --format json`

## What this gives you in agy

Ruby's static story depends on the project: RuboCop for lint, Sorbet or Steep for types where adopted. `ruby-lsp` from Shopify wraps RuboCop for diagnostics in an editor.

agy has no language-server tool and a plugin cannot register one, so this reference prepares the machine and the evidence path. The user's editor and CI use the server directly. Inside an agy session the `lsp` skill runs the checker through `run_command`, and `scripts/verify-lsp.mjs` proves that the server or checker answers for one real file. LitGravity prints every install command and leaves the running of it to the user.

## Prerequisites

- a Ruby of at least 3.0 for current `ruby-lsp` releases (`ruby -v`); the system Ruby on macOS is too old, so use Homebrew (`brew install ruby`), a version manager (rbenv, asdf, mise) or RubyInstaller

## Install (the user runs these)

**macOS**

- `gem install ruby-lsp`
- in a Bundler project: `bundle add ruby-lsp --group development`, then run it with `bundle exec ruby-lsp`

**Linux**

- `gem install ruby-lsp` (Debian or Ubuntu need `sudo apt install ruby-full` first)
- in a Bundler project: `bundle add ruby-lsp --group development`

**Windows**

- install Ruby with RubyInstaller (`winget install RubyInstallerTeam.RubyWithDevKit.3.4`), then `gem install ruby-lsp`

Confirm afterwards:

```sh
command -v ruby-lsp rubocop; ruby -v; bundle exec ruby-lsp --version
```

ruby-lsp can use RuboCop for diagnostics. Keep both versions aligned with `Gemfile.lock`. It creates a `.ruby-lsp/` directory inside the project for its composed bundle; list it in `.gitignore`.

## Project configuration

- `Gemfile` and `Gemfile.lock` at the root
- `.rubocop.yml` for lint rules; `.ruby-version` for the interpreter
- `sorbet/config` when the project uses Sorbet

```ruby
group :development do
  gem "ruby-lsp", require: false
  gem "rubocop", require: false
end
```

Report the current state of these files. Write or edit one only when the user asked for the change, keep it minimal and project-scoped, and show the diff.

## Alternatives

| command | when to choose |
| --- | --- |
| `solargraph stdio` | older alternative server (`gem install solargraph`) |
| `rubocop --lsp` | lint-only server mode |
| `srb tc` | Sorbet type check, when `sorbet/` exists |
| `steep check` | Steep type check, when `Steepfile` exists |

## Troubleshooting

- **Bundler mismatch:** run inside the bundle (`bundle exec`) so versions match the lockfile.
- **No diagnostics:** check that `.rubocop.yml` is valid and does not disable everything.
- **PATH:** a version manager (rbenv, asdf) needs a reshim after `gem install` (`rbenv rehash`, `asdf reshim ruby`).
- **System Ruby permission errors:** `gem install` against the macOS system Ruby fails; switch to a managed Ruby.
- **Native extension build failures:** install the compiler toolchain first (Xcode tools, `build-essential`).

## Verify

```sh
node "<skill-dir>/scripts/detect-lsp.mjs" .                              # server and checker status for this project
node "<skill-dir>/scripts/verify-lsp.mjs" lib/app.rb                         # real roundtrip for one file (server, else checker)
node "<skill-dir>/scripts/verify-lsp.mjs" lib/app.rb --via=checker           # force the checker path
```

`verify-lsp.mjs` exits 0 OK, 1 FAIL (not installed, crashed or timed out), 2 usage, 3 SKIP (nothing known for the extension). It prints one JSON line whose `via` field says whether a server or a checker answered; when the server was absent or failed, the `message` quotes why before the checker result. An OK with `diagnostics: 0` describes one file as one tool saw it. For project health, run the evidence command above and quote its exit code.

## Evidence to record

- the `detect-lsp.mjs` row for this language (server path, checker rows, project files)
- `command -v` and `--version` output for each executable you call ready, plus where it resolved from
- the `verify-lsp.mjs` JSON line for one real file, with its exit code
- what the user ran after you printed the commands, in their words
