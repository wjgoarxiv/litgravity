# LitGravity reference

<p align="right"><b>English</b> · <a href="./reference_ko-KR.md">한국어</a></p>

The [README](../README.md) covers install and daily use.

## The status line

The status line is one row under the prompt, drawn in the LitFamily status-line style: the `[🔥LIT v…]` mark, then every segment in LitGravity's flame orange. It reads `model [effort] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m`, then the active lit route as a pink `🔥 LIT` chip with its clock, then where the route stands on its map (PIN, RED, GREEN, VERIFY, REVIEW, RECORD for the open criterion of litwork and lit-loop, read from its evidence files; interview, plan, work, review, done for planning and start-work, with the plan's rows), the lanes of a lit-team, and whatever agy also reports: cost, background tasks, the branch and the title. The context and quota gauges turn yellow at 70% and red at 90%. On a narrow terminal the extras go first and the route and the context gauge stay. `NO_COLOR` turns colour off and `LITGRAVITY_HUD_ASCII=1` keeps every glyph ASCII. If agy already shows another status line, the installer refuses to touch it; `install --status-line --replace-status-line` swaps it after saving the old value, and `uninstall` puts that value back.

Where colour is off, the same row renders in plain text:

```text
[LIT] | GF3.8 | ctx [#--] 42%/1049k | [LIT] . lit-loop 2:20 | [PIN] = RED . - GREEN . - VERIFY . - REVIEW . - RECORD .
```

Some moments change the look of the row. While `lit adhd` (or `lit-rewind`, the skill typed whole or after `/`, or the skill the model loads by itself) is the route, every cell turns its own colour of a slow rainbow. When the turn ends on a question, a typed approval, a BLOCKED report or a goal that needs a decision, the row turns amber and reads `⚠ YOUR TURN · <why>` until you type. During `lit review work` the five lanes (goal, qa, quality, security, context) appear as each reports, in its own colour with its verdict mark and a count such as `2/5`. A plan or goal finished during the route shows `✦ DONE ✦` for twenty seconds. Other conversations in the same workspace appear as one count, `+2 running · 1 idle` (shortened to `+3 others` when the row is tight), read from the small liveness record each conversation's hooks keep; a start-work that just finished counts as done for a minute. agy repaints the line when it chooses, so every look is static, and `NO_COLOR` keeps the labels in plain text.

## Let a coding agent install it

Paste this into a coding agent opened in any folder:

```text
Install LitGravity, the LitFamily plugin for Google's Antigravity CLI.
Use only the official npm package @litfamily/litgravity. Show me your plan and wait for my yes before changing anything.
1. Check that Node.js 20+ and agy are on PATH (`agy --version`).
2. Preview: npx @litfamily/litgravity install --dry-run
3. Install: npx @litfamily/litgravity install --yes
4. Verify: npx @litfamily/litgravity doctor and report its last line.
5. Tell me what was written (the installer prints a "Written:" list) and anything it refused.
```

## Install an extension by hand

The [README](../README.md#extensions) covers the `extensions` command, which runs these same four steps.

If you would rather do it by hand, the four steps are plain shell lines. wjgoarxiv-skills is public at <https://github.com/wjgoarxiv/wjgoarxiv-skills>. Clone it once (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`). Each extension then goes in with four lines, pasted one at a time in zsh or bash from the workspace you use agy in, with `<id>` and the clone path filled in:

```bash
find .agents/skills _agents/skills ~/.gemini/config/skills ~/.gemini/skills -maxdepth 2 -name SKILL.md -exec grep -l -E '^name: *"?<id>"? *$' {} + 2>/dev/null
if [ -e ~/.gemini/config/skills/<id> ] || [ -L ~/.gemini/config/skills/<id> ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv ~/.gemini/config/skills/<id> "$b/" && echo "moved to $b/<id>"; fi
mkdir -p ~/.gemini/config/skills && [ ! -e ~/.gemini/config/skills/<id> ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" ~/.gemini/config/skills/<id>
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' <id> "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > ~/.gemini/config/skills/<id>/.litfamily-extension.json
```

The first line only looks. agy 1.5.6 loads a skill by its name from four folders (a workspace's `.agents/skills` and `_agents/skills`, then `~/.gemini/config/skills` and `~/.gemini/skills`), and when two share a name it keeps one without saying so, so the line prints the `SKILL.md` of every skill with that name and prints nothing when there is none. Move any copy it names outside the install folder aside the same way. The second line moves an existing copy, whole, into a dated folder under `~/.gemini/extension-backups/`, which agy never loads; your own files inside it stay there. The third copies the extension into the emptied place, so an old copy can never nest or mix with the new one. The fourth writes a small receipt, `.litfamily-extension.json`, inside the copy: the id, the source folder, the variant and the time.

For one workspace only, run the first line, then these three in the workspace root:

```bash
if [ -e .agents/skills/<id> ] || [ -L .agents/skills/<id> ]; then b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-project; mkdir -p "$b" && mv .agents/skills/<id> "$b/" && echo "moved to $b/<id>"; fi
mkdir -p .agents/skills && [ ! -e .agents/skills/<id> ] && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" .agents/skills/<id>
printf '{"id":"%s","source":"%s","variant":"litgravity","installed_at":"%s"}\n' <id> "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .agents/skills/<id>/.litfamily-extension.json
```

Start a new conversation (or type `/skills reload`), and the skill answers as `/<id>`. To update it, run the same lines again: the old copy moves to a new dated backup and the receipt is rewritten. To remove it, run the second line alone. Nothing is ever deleted, so clear old backups out of `~/.gemini/extension-backups/` when you no longer need them (`extensions prune-backups` does it for you).

`litgravity install` writes only its own plugin folder, so upgrading or removing LitGravity never touches the copy, and the stub (`litgravity:<id>`) and the copy (`<id>`) keep different names.

The nine moved skills took their pinned engines (`office`, `diagram`, `readme`, `sciviz`, `motion`) with them, and `litgravity runtime` and the hook that held a film turn until its render passed went too. The agy copies in wjgoarxiv-skills carry their own engine installers, keep their own engine cache and run their checks as commands, so they need nothing from LitGravity's internals.

## What agy limits today, in detail

These are the facts of agy 1.4.3, probed on a real install. LitGravity works inside them and says so where it matters.

- **No blocking before a write.** agy's PreToolUse hook has to decide every call it sees; an empty answer counts as a denial, and an `allow` may lift your own approval prompts. So LitGravity leaves file writes and shell commands alone before they happen. A lit-plan turn that changed anything outside `plans/` is told to undo it right after, and prose that stacks negations or hedges is reported after it is written. The one hard stop is a child agent that could write during a lit-plan turn.
- **Headless runs cannot ask.** In `agy -p`, a `run_command` or `write_file` that needs permission is denied, and the denial ends the run with an empty answer (the JSON lists it under `denied_actions`). `read_file` inside the workspace works. The skills read first and report `BLOCKED` with the permission they need. For scripted use add allow rules to agy's settings or pass `--dangerously-skip-permissions`, at your own risk. Use a project-scope install (`--scope project`) when a headless run has to read the skill files, because a plugin whose real path lies outside the workspace was denied its `read_file` in the same probe.
- **Seeing images.** agy's model reads a PNG through `read_file`. Every look step in the visual skills relies on that, and it was proven with a picture whose only content was a word the prompt never mentioned.
- **Starter Quota.** Every model call counts against your account's quota, so tests and probes use `agy plugin validate` and `/hooks`, `/skills`, `/agents`, which cost nothing, and a build of LitGravity spends only a handful of real calls.
- **No compaction event, no slash-command folder, no MCP server from a plugin here.** `lit-handoff` writes `.litgravity/handoff/latest.md` and a new conversation is pointed at it. Skills are the commands (`/litgravity:<skill-id>`). `wikify` runs as script subcommands inside the skill.
- **No lsp tool.** The `lsp` and `lsp-setup` skills drive language checkers from the command line instead.
