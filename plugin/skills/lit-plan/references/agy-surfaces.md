# agy surfaces and the proof each one needs

Use this table while drafting rows for a repository that is an agy plugin (LitGravity itself, or another plugin built the same way). Include only the rows that apply; a generic command that observes none of the changed surfaces is padding. Paths follow the LitGravity layout and shift with the target repository.

| Changed surface | Minimum plan evidence |
| --- | --- |
| `plugin/skills/<id>/SKILL.md` and its folder | the repository test that checks skill structure and depth, the legacy-token scanner when prose changed, a closure check that every relative path the skill names exists, `agy plugin validate --json` for the 24,000-byte body limit (only the first 24,000 bytes of a SKILL.md load) |
| `plugin/plugin.json` | `agy plugin validate plugin --json` with zero errors, plus the version lockstep check when a version moved |
| `plugin/hooks.json` | the strict-shape test (`{ "<name>": { "<Event>": [...] } }`, flat lists for SessionStart, PreInvocation, PostInvocation and Stop, `{matcher, hooks}` groups for PreToolUse and PostToolUse) and `agy plugin validate --json --strict`; one wrong group makes agy skip the whole file while `/hooks` still lists it |
| `plugin/hooks/**` scripts | malformed-stdin fixtures, transcript fixtures for the prompt router, prompt-injection fixtures treated as data, and a direct run of each script the way agy runs it (JSON on stdin, JSON on stdout, cwd = the plugin folder) |
| `plugin/agents/*.md` | frontmatter parse (`name`, `description`, `tools`, `model`), the validator's agent checks, and a spawn probe that shows the grant a read-only agent really has |
| `plugin/rules/AGENTS.md` | the 24,000-byte rule limit and the validator's rule checks; a rule loads whenever the plugin is enabled, so every byte costs context in every conversation |
| installer, doctor, uninstall (`lib/`, `bin/`) | installer tests against the fake host, the write-boundary guard test, symlink and foreign-folder cases, and a throwaway-home run of the real `agy` |
| package files, `package.json`, `files[]` | `npm pack --dry-run --json --ignore-scripts` read through `[0].files` and compared with the pinned file list |
| scripts and tooling | a direct invocation with inputs that prove the observable contract, plus a failure-path invocation when the script validates input |
| documentation and CI files | the docs test if present, and a dry command confirming that every referenced script and path exists |

## Host facts a plan must respect

- agy loads a plugin from `.agents/plugins/<name>/` in a project (no install, no trust prompt) or from `~/.gemini/config/plugins/<name>/`. Plugin names share one namespace; when two plugins claim a name, the first found wins and the other disappears silently.
- Hooks read `transcriptPath` for the prompt, because the payload has no prompt field. `UserPromptSubmit` does not exist; `PreInvocation` with `invocationNum` 0 is the first model call of a user turn. `SessionStart` fires once per new conversation and not on resume.
- A `PreToolUse` hook must answer every call with a decision. An empty object is read as a denial with no reason (observed on 1.4.3, where it blocked every tool of a planning turn), and `allow` may lift the user's own approval prompts, which no hook should do for file writes and commands. A plan for hooks therefore keeps the matcher on tools that never prompt (child agents) and checks writes after the fact.
- `agy plugin validate <dir> --json` is free and offline; `agy -p "/hooks"`, `"/skills"` and `"/agents"` list loaded customizations without a model call. Real model calls count against the user's quota, so a plan caps them and says how many a row uses.
- Headless runs (`agy -p`) auto-deny `run_command` unless agy runs in a permissive mode. A row whose proof needs a command in a headless run states that.
- The status line is configured only in the user-level settings file. A plan never edits the user's real settings; installer tests run in a temporary HOME.

## Release neutrality

State in the plan whether the work is release-neutral: no version bump, tag, publish, package upload or generated release note unless the user approved release work separately. `npm publish`, version edits, tags and pushes are never implicit verification commands. Prefer the narrowest package check that observes the changed surface.
