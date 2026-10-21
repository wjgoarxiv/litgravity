# Reviewing agy plugin and skill diffs

When the changed files belong to an agy plugin (a `plugin/` folder with `plugin.json`, `hooks.json`, `skills/`, `agents/`, `rules/`), add these questions to the lane briefs. A passing unit test can still miss a broken skill path or a hook that never runs.

## Manifest and enrollment

- Each skill id appears in the manifest or folder listing, in the route table the prompt hook reads, in the skill folder, and in any fixture that pins the skill list. An orphan on any surface is a MAJOR finding.
- `agy plugin validate plugin --json --strict` reports zero errors and zero warnings. It is free and offline. `agy -p "/skills"`, `"/hooks"` and `"/agents"` list what loaded and also cost nothing.
- Plugin names share one global namespace and the first copy found wins silently, so a project copy and a user copy of the same plugin deserve a note.

## Skill files

- Frontmatter has exactly `name` (equal to the folder) and a quoted one-line `description` of 20 to 220 bytes. A file without a frontmatter block is skipped.
- Only the first 24,000 bytes of a `SKILL.md` body load. Depth beyond that belongs in `references/`, `templates/` and `scripts/`.
- Every relative path a skill names exists in the package (reference closure), and no folder named `evidence/`, `plans/`, `.litgravity/` or `node_modules/` sits inside a skill.

## Hooks

- `hooks.json` has a strict shape: SessionStart, PreInvocation, PostInvocation and Stop take flat lists, PreToolUse and PostToolUse take `{matcher, hooks}` groups. One wrong group makes agy skip the whole file while `/hooks` still lists it.
- A `PreToolUse` hook must answer every call. An empty object is read as a denial with no reason, and `allow` may lift the user's own approval prompts. Review the matcher scope and the decision of every branch.
- There is no `UserPromptSubmit` event. The prompt reaches a hook through the transcript path, so the parsing of that file is a trust boundary.
- Hook stdout and stdin handling is defensive: malformed JSON fails open unless blocking is the documented intent.
- Handlers run with the plugin folder as the working directory, so commands are `node ./hooks/<name>.mjs`.

## Agents

- Read-only agents use a `tools:` allowlist that holds no writer. The roster the planning guard treats as read-only is `lit-planner`, `librarian-researcher`, `lit-verifier`, `quality-reviewer` and the Korean prose agents, so names match exactly.
- `lit-executor` and `qa-runner` can write. A brief that spawns a child without `TypeName` hands it every tool.

## Installer and package

- Writes stay inside the documented plugin folders, symlinked and foreign destinations fail closed, and uninstall removes only what the installer owns.
- The user's real `~/.gemini` settings are never edited by tests; tests run in a temporary home.
- The pack listing matches its pinned fixture, and every version field stays where it was unless a bump was approved.

## Real surface

Model calls draw on a small quota. A review may report the live proof as a stated limitation and spend nothing. When a live call is justified, the plan names the number, each call uses `agy -p … < /dev/null`, and a refused `run_command` in a headless run ends the run with no output, which the review records as the evidence it is.
