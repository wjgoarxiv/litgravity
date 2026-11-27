# LitGravity reference

<p align="right"><b>English</b> · <a href="./reference_ko-KR.md">한국어</a></p>

The [README](../README.md) covers install and daily use.

## The status line

The status line is one row under the prompt (a card on a truecolor terminal, see below), drawn in the LitFamily status-line style: the `[🔥LIT v…]` mark (on truecolor the ` 🔥LIT v… ` pill), then every segment in LitGravity's flame orange. It reads `model [effort] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m`, then the active lit route as a pink `🔥 LIT` chip with its clock, then where the route stands on its map (PIN, RED, GREEN, VERIFY, REVIEW, RECORD for the open criterion of litwork and lit-loop, read from its evidence files; interview, plan, work, review, done for planning and start-work, with the plan's rows), the lanes of a lit-team, and whatever agy also reports: cost, background tasks, the branch and the title. The context and quota gauges turn yellow at 70% and red at 90%. On a narrow terminal the extras go first and the route and the context gauge stay. `NO_COLOR` turns colour off and `LITGRAVITY_HUD_ASCII=1` keeps every glyph ASCII. If agy already shows another status line, the installer refuses to touch it; `install --status-line --replace-status-line` swaps it after saving the old value, and `uninstall` puts that value back.

On a truecolor terminal it is a framed card with the same facts in more room. The title edge holds the mark, the route with its clock and one state word (READY, the current stage, YOUR TURN, DONE, REVIEW, REWIND, ERROR). Inside come the stage map in whole words with the last tool and its age at the right, the goal's or plan's gauge with `next ▸`, threads and lanes in shared columns, and the skills of the route. The bottom edge keeps the model, the context and quota gauges with the reset time, the branch, cost and version. The border runs pink through violet to LitGravity's orange, turns amber while the turn waits on you and red on an error. Every part is read from a file or from agy's payload; a part with no fact behind it is left out. A half-sunk sun on a glittering sea stands in the cells no text uses, three rows tall where there is room and one or two where there is not. To give it room, the words after `next ▸` may be cut to their start on the working and waiting cards. YOUR TURN paints the scene amber and `lit adhd` turns it with the rainbow.

The card needs 60 columns and, when the terminal tells its height, 20 rows; from 24 rows it has one more row, so the whole sun shows. Lanes make it taller. A short window hides the skills before the lanes and never a lane that failed or is blocked. Anywhere else there is one row: a narrow or short window (in the sunset colours), `NO_COLOR`, 256 and 16 colours (`LITGRAVITY_HUD_COLOR=256` asks for them), `LITGRAVITY_HUD_ASCII=1` and a terminal whose `COLORFGBG` names a light background. The scene is a still picture, because agy redraws a status line on events and leaves it alone while it idles.

Pills and gauges end round or square, the same everywhere: the status line, its card and the installer. `LITGRAVITY_HUD_GLYPHS=round` (or `nerd`) asks for round, `square` (or `basic`) for square. `install --glyphs round` and `update --glyphs square` save the same choice for every later session, over SSH too; a plain install keeps it and `--glyphs auto` drops it. The environment variable comes first, then the saved choice. Without either, or with `auto`, Windows Terminal, VS Code, WezTerm, Ghostty and kitty get round ends, an SSH session gets square ones, and elsewhere an installed Nerd Font decides, told by font file names and looked up once a day.

`--round` on `install` or `update` adds one icon font when no icon font is here: the symbols-only Nerd Font v3.5.1 (`SymbolsNerdFontMono-Regular.ttf` and its licence) into `~/Library/Fonts`, or `${XDG_DATA_HOME:-~/.local/share}/fonts` on Linux. The archive and both files are checked by SHA-256, nothing is overwritten, and an install goes on without the font when anything fails. `LITGRAVITY_ICON_FONT_SOURCE=<zip>` reads a local copy of that archive. `uninstall` removes the files it added while they are unchanged. The last line of an install and the line above doctor's verdict say where things stand: `ROUND_ENDS: shown` (the status line is on and you saved round), `ready` (this terminal draws the ends itself), `check` (an icon font is here, and only your eyes can tell whether the terminal uses it) or `square`, with the reason and one fix. When you see boxes, set the terminal's own font to a full Nerd Font, add the symbols font as its fallback font (iTerm2 Non-ASCII Font, VS Code `terminal.integrated.fontFamily`, kitty `symbol_map`), or save `--glyphs square`. Terminal.app has no fallback setting, so it needs a full Nerd Font.

Where colour is off, the same row renders in plain text:

```text
[LIT] | GF3.8 | ctx [#--] 42%/1049k | [LIT] . lit-loop 2:20 | [PIN] = RED . - GREEN . - VERIFY . - REVIEW . - RECORD .
```

Some moments change the look of the row. While `lit adhd` (or `lit-rewind`, the skill typed whole or after `/`, or the skill the model loads by itself) is the route, every cell turns its own colour of a slow rainbow. When the turn ends on a question, a typed approval, a BLOCKED report or a goal that needs a decision, the row turns amber and reads `⚠ YOUR TURN · <why>` until you type. During `lit review work` the five lanes (goal, qa, quality, security, context) appear as each reports, in its own colour with its verdict mark and a count such as `2/5`. A plan or goal finished during the route shows `✦ DONE ✦` for twenty seconds. Other conversations in the same workspace appear as one count, `+2 running · 1 idle` (shortened to `+3 others` when the row is tight), read from the small liveness record each conversation's hooks keep; a start-work that just finished counts as done for a minute. agy repaints the line when it chooses, so every look is static, and `NO_COLOR` keeps the labels in plain text.

## Let a coding agent install it

Paste this into a coding agent opened in any folder:

```text
Install LitGravity, the LitFamily plugin for Google's Antigravity CLI.
Use only the official npm package @litfamily/litgravity; add no other source, and do not approve hooks, trust or sign-in for me.
1. Check that Node.js 20+ and agy are on PATH (`agy --version`).
2. Preview: npx --yes @litfamily/litgravity@latest install --dry-run --round --status-line
   Show me what it would change. A preview that ends with FAIL has changed nothing.
3. Ask me these, with the defaults:
   - Keep every default? (yes: the install line of step 5 as it stands)
   - Where should it work? Default: every project. For one project, run every command in that folder with --scope project and leave out --status-line.
   - Add the short rule file to agy's rules folder? Default: yes. For no: add --no-agent-file to every install and update command below. For good, I can choose it later with: npx --yes @litfamily/litgravity@latest config agentFile off
   - Show the status line under agy's prompt? It is the part I see, round ends show there, and it is on only with --status-line. Default: yes. If agy already shows another status line, I choose between leaving out --status-line and adding --replace-status-line (the old one is saved and uninstall puts it back).
   - Add an icon font for round ends? --round adds SymbolsNerdFontMono-Regular.ttf and its licence file to ~/Library/Fonts on macOS or ~/.local/share/fonts on Linux ($XDG_DATA_HOME/fonts when that is set), only when no icon font is here, from the official Nerd Fonts release with its SHA-256 checked. Nothing on Windows. For no: leave out --round.
   - I can choose round or square ends later with: npx --yes @litfamily/litgravity@latest update --yes --glyphs auto|round|square
4. Wait for my yes.
5. Install: npx --yes @litfamily/litgravity@latest install --yes --round --status-line
   To update on another day: npx --yes @litfamily/litgravity@latest update --yes --round
6. Check: npx --yes @litfamily/litgravity@latest doctor
   Its last line must start with "LitGravity: ready", and the install must have printed a line that starts with ROUND_ENDS:. If a step fails, show me the lines and stop.
7. Show me this and ask if both ends are round:  LIT 
   Round: npx --yes @litfamily/litgravity@latest update --yes --glyphs round
   Boxes: npx --yes @litfamily/litgravity@latest update --yes --glyphs square
   For round ends there I set the terminal's own font to a full Nerd Font, or add the symbols font as its fallback font (Terminal.app has no fallback setting).
   Over SSH or on a phone: leave it unless I see round ends. To undo: npx --yes @litfamily/litgravity@latest update --yes --glyphs auto
8. Tell me what was written (the "Written:" list), anything the installer refused, and what only I can do: quit agy and start it again if it is open, and sign in to agy once. Nothing in agy waits for an approval.
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
- **`/goal` and `run_workflow` (1.5.10).** agy's own `/goal` lives in the interactive prompt only, and a hook cannot type a slash command, so an armed plan goal is checked by LitGravity's Stop hook at every turn end (at most 7 seconds) and the reply hands you `/goal <cond>` to paste. `run_workflow` runs a Python script of agents (`agent`, `parallel`, `pipeline`, a model tier per agent, `workspace="branch"` for an isolated clone); `ultra-brainstorm` and `lit team` use it, and workflow agents cannot ask you anything.

## Autopilot and parking

A start-work run on an approved plan is driven by the Stop hook until the plan says it is done. The full contract is in `plugin/skills/start-work/references/autopilot.md`; this is the short version.

- **Closing.** Every row ticked and the `## Done when` line `check: \`<cmd>\`` exiting 0 closes the run with one line. The check must be a plain test command (`npm test`, `npm run <script>`, `node --test …`, `pytest`, `cargo test`, `go test`, `make test`, …). It runs with no shell and stops after 20 seconds, because Stop has 30 seconds and may spend 7 on a goal check. A check over that limit leaves the run "not proven done". A child lane still running keeps the run open.
- **Pushes and the inbox.** At most two pushes per unchanged plan state, then one inbox, then quiet. A ticked row, a new parked step or a lane gone quiet for 30 minutes is a new state.
- **Rows.** `BLOCKED: <what is needed>` under a row means a user answer can unblock it; `IMPOSSIBLE: <reason>` means none can. A reply starting `WAITING-ON-USER:` brings the inbox.
- **Parked steps.** The model writes `ledger-append.mjs --kind park --command "<cmd>" --cwd <dir>` instead of running a step outside its grants. `[B]` steps are local (new files and folders, `git add` of named files inside the project), `[X]` steps are everything else, held steps are ones the reader cannot follow, and steps that name secrets or agy's home are refused.
- **Answers.** `lit approve` runs the shown `[B]` steps without a shell; `lit approve x`, typed exactly and alone, also runs the `[X]` steps through `/bin/sh` in their own process group. Both run only the steps the last inbox showed, re-check each one first and stop within 25 seconds; `lit approve x` runs outside agy's own approval prompts. `npx @litfamily/litgravity inbox` (after the next release) prints the hooks' own list of what each answer would run, with no model in between, so you can check the inbox the model relayed. `lit deny` refuses the same command in the same folder for the rest of the run; `lit skip-row [N]`, `lit pause` and `lit resume` do what they say. Korean forms work too: `lit 승인`, `lit 거절`, `lit 멈춤`, `lit 재개`. If the run's own state file is damaged, every answer runs nothing; type `lit cancel` to end that run, and the damaged file is kept beside it as `<conversation>.run.json.unreadable`.
- **Charter.** `Run charter: commit on <branch> in <repo>` lets the run commit on that branch. An edit to that line between lit-plan's question and your `yes` voids it.
- **Native goal.** Only a plan with a `goal: native` line is offered `/goal`, and the condition ends itself: `…, or the latest reply starts with WAITING-ON-USER:, or after 30 turns`.
- **What agy does not allow (BLOCKED).** PreToolUse cannot abstain, so nothing stops the model from running a step it should have parked; parking is guidance. Stop's text reaches only the model, so the model has to repeat the inbox to you. No hook can type `/goal`.

**Suggestions without `lit`.** A prompt that does not start with `lit` may get a short note naming a skill that fits (figures, decks, Word documents, debugging, motion) plus "none", or one compact catalog line. Each hint passed recall ≥ 0.85 and near-miss false hits ≤ 0.10 on a sealed held-out half of the test prompts. A slash command gets nothing.

## The skill plan, the goal files and the adhd cursor

- **Skill plan.** The activation note lists up to three skills. The first is the route; the others come from the words of the task (a schematic, a film, a deck, a web page, a figure, a diagram, an explainer, a crucible pass). An extension that is missing from `.agents/skills/<id>` and `~/.gemini/config/skills/<id>` is shown with its install line. `lit +a +b <task>` replaces the guess with your names, in your order; a name that is no skill is dropped with a note.
- **Goal files.** `.litgravity/goal/consent.json` holds the asked condition for 30 minutes; `owner.json` records a goal LitGravity armed on your `yes`, which also starts start-work on the plan (a refused start arms no goal); a plan whose check cannot be a goal is asked as `Approve plan and start work? (yes / no)`. Only lit-plan's question arms one, and the read-only skills never do. `lit cancel` and a met check remove `owner.json`; a new conversation drops one that is older than seven days or whose plan is gone, and says so once.
- **The adhd cursor.** `lit adhd` keeps one small file per folder under the LitGravity state root (`adhd/<hash>.cursor.json`): when the card was drawn, the finishes you saw and the action it showed. Only the default card moves it. A damaged cursor reads as a first look.
