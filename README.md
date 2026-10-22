<p align="center"><picture><source media="(prefers-reduced-motion: reduce)" srcset="./docs/assets/cover-motion-still.webp" /><source media="(prefers-reduced-motion: no-preference)" srcset="./docs/assets/cover-motion.webp" /><img src="./docs/assets/cover.webp" width="100%" alt="LitFamily cover: seven armored machines stand in their bays, and the LitGravity machine in the seventh bay, gyroscope rings around a dark spherical head, wakes with orange cores in its head and chest and a lit frame, under LITFAMILY and KEEP THE WORK LIT." /></picture></p>

<h1 align="center">LitGravity</h1>
<p align="center"><strong>Keep the work lit.</strong></p>

<p align="center">LitGravity gives Google's Antigravity CLI (<code>agy</code>) the habit of planning before it edits, checking what it built, and leaving a handoff, so the next conversation starts where this one stopped. One npm command installs it as an agy plugin.</p>

<p align="center">
<a href="https://www.npmjs.com/package/@litfamily/litgravity"><img src="https://img.shields.io/npm/v/@litfamily/litgravity?color=FF6337&amp;label=npm" alt="npm version" /></a>
<a href="https://www.npmjs.com/package/@litfamily/litgravity"><img src="https://img.shields.io/npm/dm/@litfamily/litgravity?color=D7F75B" alt="npm downloads per month" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
<a href="https://github.com/wjgoarxiv/litgravity/stargazers"><img src="https://img.shields.io/github/stars/wjgoarxiv/litgravity?style=flat" alt="GitHub stars" /></a>
</p>

<p align="center"><a href="#install"><img src="./docs/assets/readme/icon-book.svg" width="16" alt="" /> Install</a> &nbsp; <a href="#demo"><img src="./docs/assets/readme/icon-play.svg" width="16" alt="" /> Demo</a> &nbsp; <a href="#safety-and-uninstall"><img src="./docs/assets/readme/icon-shield.svg" width="16" alt="" /> Safety</a> &nbsp; <a href="#quick-start">Quick start</a> &nbsp; <a href="#what-you-get">What you get</a> &nbsp; <a href="#what-agy-limits-today">agy limits</a> &nbsp; <a href="./README_ko-KR.md">한국어</a></p>

## Demo

What ignition looks like, captured from the real hook and status line on this Mac: the typed prompt, the injected route note, and the status line carrying the lit-loop map.

<!-- demo-gif --><p align="center"><img src="./docs/assets/litgravity/demo-ignition.webp" width="960" alt="Terminal capture. The prompt reads lit add a --shout flag that prints the greeting in capitals, with a test. The hook answers with the LIT mark and LIT IGNITED · lit-loop, names the lit-loop skill file to read first, and notes that tool events go to the conversation ledger. Below, the status line shows the model, the context gauge at 42 percent, the lit-loop chip with its clock, and the PIN through RECORD map with PIN lit." /></p>

## Why LitGravity

agy starts fast: you type a line and it gets to work. The trouble shows up later. A long conversation fills its context, the next one begins without what the last one learned, and "done" often means the model said so. You end up re-explaining where you were and checking by hand what really works.

LitGravity gives each conversation a routine. Start a prompt with `lit` and a hook, which runs before the first model call, tells agy which LitGravity skill to read before it touches anything. A bigger change gets a written plan in `plans/` first. The work is checked against that plan with tests and a look at the real surface, and whatever nobody could check is marked as unverified. Before you stop, a handoff in `.litgravity/handoff/` records what was built, how it was checked and what is left.

```text
you type    lit plan a tiny todo app
it does     reads the plan skill, explores the repo, writes plans/todo-app.md with ordered tasks and checks
it ends     "Plan saved. Run `lit start plans/todo-app.md` when you are happy with it."
```

agy still runs the conversation and picks the model, while LitGravity adds the routine around it. That routine lives in plain files you can read:

| What agy does | What lit adds |
|---|---|
| Starts from one typed line | A plan in `plans/` before the first edit |
| Forgets the last conversation | Checks against the plan, marks the unchecked as unverified |
| Calls it done when the model says so | A handoff in `.litgravity/` the next turn reads |

## Install

You need Node.js 20 or newer and the Antigravity CLI, signed in once. In a terminal, run:

```bash
npx @litfamily/litgravity install
```

The installer shows every destination first. By default it copies the plugin to `~/.gemini/config/plugins/litgravity`, so LitGravity is available in every project; `--scope project` copies it to `./.agents/plugins/litgravity` for one project. It validates the plugin with `agy plugin validate` before and after copying. agy loads a plugin's hooks, skills and agents without a trust step, so there is nothing to approve. Then check the result:

```bash
npx @litfamily/litgravity doctor
```

`doctor` lists the installed copy, the validation result, the six hook events and a smoke run of each hook script, every skill and agent, every engine with its pre-warm command, the host programs the skills call, and the Python the engines will use. It ends with `LitGravity: ready` when nothing is broken.

<p align="center"><img src="./docs/assets/litgravity/install-doctor.webp" width="960" alt="Terminal capture. The install command ends with Status: Ready, and the doctor command ends with LitGravity: ready after thirty passing checks." /></p>

Useful switches: `--dry-run` previews and writes nothing; `--yes` lets an agent or CI shell install (a shell without a terminal otherwise only previews); `--status-line` adds the optional LitGravity status line to agy's user settings (never on by default).

The status line is one row under the prompt, drawn in the LitFamily status-line style: the `[🔥LIT v…]` mark, then every segment in LitGravity's flame orange. It reads `model [effort] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m`, then the active lit route as a pink `🔥 LIT` chip with its clock, then where the route stands on its map (PIN, RED, GREEN, VERIFY, REVIEW, RECORD for the open criterion of litwork and lit-loop, read from its evidence files; interview, plan, work, review, done for planning and start-work, with the plan's rows), the lanes of a lit-team, and whatever agy also reports: cost, background tasks, the branch and the title. The context and quota gauges turn yellow at 70% and red at 90%. On a narrow terminal the extras go first and the route and the context gauge stay. `NO_COLOR` turns colour off and `LITGRAVITY_HUD_ASCII=1` keeps every glyph ASCII. If agy already shows another status line, the installer refuses to touch it; `install --status-line --replace-status-line` swaps it after saving the old value, and `uninstall` puts that value back.

### Let a coding agent install it

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

## Quick start

1. Open agy in a project. Type `/skills` to see the LitGravity skills and `/hooks` to see the plugin's hooks.
2. Start a prompt with `lit`. Plain `lit` runs the default loop; the word after it picks the route: `lit plan`, `lit review`, `lit research`, `lit debug`, `lit handoff`, `lit recap`, `lit brainstorm`, `lit korean`. Any skill id works as that word (`lit debugging`, `lit structural-search`), and `/litgravity:<skill-id>` runs a skill as a slash command.
3. Approve a plan, then `lit start plans/<slug>.md` builds it row by row with tests.
4. Before you stop, `lit handoff`. Next time, `lit recap` reads where you were.

`npx @litfamily/litgravity list` prints every skill with the words that reach it. A `lit` while its route is already active gets a short "continues" note, `lit <other route>` switches, a bare `lit` picks up a plan you started with `lit start`, and `lit new` starts over.

## The status line

One row under the prompt shows where the work stands: the model and its effort tier, the context and quota gauges, the active route with its clock, and the map of that route with the current stage lit. The capture below is a real render from this Mac, before and after a `lit` prompt.

<p align="center"><img src="./docs/assets/litgravity/status-states.webp" width="960" alt="Terminal capture of the status line. Before lit it shows the model and the context gauge at 42 percent. After lit it adds the lit-loop chip with its clock and the PIN through RECORD map with PIN lit." /></p>

When the terminal narrows, the extras give way first and the route and the context gauge stay. Where colour is off, the same row renders in plain text:

```text
[LIT] | GF3.8 | ctx [#--] 42%/1049k | [LIT] . lit-loop 2:20 | [PIN] = RED . - GREEN . - VERIFY . - REVIEW . - RECORD .
```

## What you get

**39 skills**, each a dense agy skill read on demand, with the references, scripts, templates and engines it needs inside its own folder. agy loads only the first 24,000 bytes of a `SKILL.md`, so the long material sits in the skill's `references/` folder and the skill names the file to open.

A lit turn runs the same routine through these parts. A bigger change gets a written plan first, the work is built row by row with tests under a goal record that outlives one conversation, a second look reviews it before anything merges, research shows its sources, documents and prose read clean, and the turn ends with a handoff the next conversation reads:

| Part | Contents | Role |
|---|---|---|
| 39 skills | Dense agy skills with their references, scripts and engines | Plan, build, check, research, write, hand off |
| 11 agents | Child agents agy starts under their type names | Plan, execute, verify, review, Korean prose |
| 6 hooks | Run at session start, each turn, each tool call, and the stop gate | Route `lit`, hold unfinished turns, ledger every tool |

agy loads only the first 24,000 bytes of a `SKILL.md`, so the long material sits in the skill's `references/` folder and the skill names the file to open. The skill groups are loop and goals, ideas and planning, building, review and cleanup, research and knowledge, teams, prose, continuity and guidance, interface and docs, documents and figures, film and covers, and tools; `npx @litfamily/litgravity list` prints every skill with the words that reach it.

The document, diagram, README-cover, figure and motion skills ship pinned engines: `office`, `diagram`, `readme`, `sciviz` and `motion`. Each installs into `~/.local/share/litgravity/runtime/<name>` and nowhere else. Install them once with `npx @litfamily/litgravity runtime install all` (or one name); `runtime status` shows each one. A skill checks its engine first and asks agy to run the install command when it is missing. Engines that need Python pick a supported interpreter by themselves: a `python3` newer than 3.14 has no wheels for the pinned packages, so they walk to `python3.14`, `python3.13` and so on, honour `LITGRAVITY_OFFICE_PYTHON`, `LITGRAVITY_SCIVIZ_PYTHON` or `LITGRAVITY_MOTION_PYTHON`, and answer `BLOCKED` with the exact fix when no interpreter fits. The skills also call programs already on your machine: LibreOffice, pandoc, Poppler, Chrome or Chromium, ffmpeg, libwebp, ast-grep, XeLaTeX and the language checkers that `lsp` drives. `doctor` names what is missing and the command that installs it; LitGravity never installs software globally.

**11 agents**, started by agy with `invoke_subagent` under their type name: lit-planner, lit-executor, lit-verifier, qa-runner, quality-reviewer, librarian-researcher, and five Korean prose agents (korean-style-analyzer, korean-prose-editor, meaning-preservation-auditor, native-flow-reviewer, polish-orchestrator). Reviewers and the Korean agents get read and search tools only.

**6 hook events**:

- SessionStart adds the LitGravity route list, an update notice and a pointer to a fresh handoff note, once per new conversation.
- PreInvocation is the `lit` router. agy has no prompt hook, so on the first model call of a turn the router reads the newest prompt from the transcript, applies the re-entry rule and injects one step that names the skill file to read.
- PostInvocation and Stop run the checks that agy cannot run in advance (see the limits below). Stop also holds a turn: a lit-plan turn until `plans/<slug>.md` exists, start-work while an approved plan has open rows, litgoal and lit-loop while a goal record has an open criterion, at most three holds in a row without progress. Say `pause`, or write `BLOCKED at row N:`, `PAUSED at row N:` or `CANCELLED:` in the ledger, to release it. A motion turn ends when the skill's own done-check passes on the last render, or after two holds with a plain not-done notice.
- PreToolUse refuses child agents that could write while lit-plan is active.
- PostToolUse writes one ledger line per tool call while a route is active, in `.litgravity/ledger/<conversation>.jsonl`, with key shapes redacted. A silent ledger means the hooks are not loaded.

**Models**: `npx @litfamily/litgravity models` lists the models and effort tiers your agy offers, read from agy itself, so a model Google adds later shows up with no LitGravity update.

## What agy limits today

These are the facts of agy 1.4.3, probed on a real install. LitGravity works inside them and says so where it matters.

- **No blocking before a write.** agy's PreToolUse hook has to decide every call it sees; an empty answer counts as a denial, and an `allow` may lift your own approval prompts. So LitGravity leaves file writes and shell commands alone before they happen. A lit-plan turn that changed anything outside `plans/` is told to undo it right after, and prose that stacks negations or hedges is reported after it is written. The one hard stop is a child agent that could write during a lit-plan turn.
- **Headless runs cannot ask.** In `agy -p`, a `run_command` or `write_file` that needs permission is denied, and the denial ends the run with an empty answer (the JSON lists it under `denied_actions`). `read_file` inside the workspace works. The skills read first and report `BLOCKED` with the permission they need. For scripted use add allow rules to agy's settings or pass `--dangerously-skip-permissions`, at your own risk. Use a project-scope install (`--scope project`) when a headless run has to read the skill files, because a plugin whose real path lies outside the workspace was denied its `read_file` in the same probe.
- **Seeing images.** agy's model reads a PNG through `read_file`. Every look step in the visual skills relies on that, and it was proven with a picture whose only content was a word the prompt never mentioned.
- **Starter Quota.** Every model call counts against your account's quota, so tests and probes use `agy plugin validate` and `/hooks`, `/skills`, `/agents`, which cost nothing, and a build of LitGravity spends only a handful of real calls.
- **No compaction event, no slash-command folder, no MCP server from a plugin here.** `lit-handoff` writes `.litgravity/handoff/latest.md` and a new conversation is pointed at it. Skills are the commands (`/litgravity:<skill-id>`). `wikify` runs as script subcommands inside the skill.
- **No lsp tool.** The `lsp` and `lsp-setup` skills drive language checkers from the command line instead.

## What a planning turn may do

`lit plan` turns are planning only. Most of that is asked, then checked afterwards, because agy offers no safe way to stop a write before it happens (see the limits above):

- The router tells the model to write only under `plans/` and `.litgravity/` and to keep the shell to plain read-only commands. Your own approval prompts still decide whether a write or command runs.
- After every model call and at the end of the turn, the boundary check compares the workspace with its state at the start of the turn. A file changed or removed outside `plans/` is reported and the model is asked to undo it, at most twice per turn. A command that changed nothing on disk leaves no trace for this check.
- Child agents are refused before they start unless they are read-only: lit-planner, librarian-researcher, lit-verifier, quality-reviewer and the Korean prose agents.

Route state lives outside the project, under `~/.local/state/litgravity/`, away from the files a planning turn is asked to touch. If that state is damaged, the child-agent limit and the plan gate stay on; if it goes missing, the hooks fall back to the route journal kept beside it.

## Held turns and the ledger

Some turns are allowed to wait. A lit-plan turn with no plan file yet is held at the end until `plans/<slug>.md` exists, at most three holds in a row without progress. Start-work waits while an approved plan has open rows, and litgoal and lit-loop wait while a goal record has an open criterion. Say `pause`, or write `BLOCKED at row N:`, `PAUSED at row N:` or `CANCELLED:` in the ledger, to release a hold. The capture below is the real hold from a planning turn that wrote nothing.

<p align="center"><img src="./docs/assets/litgravity/handoff-hold.webp" width="960" alt="Terminal capture. After the prompt lit plan a tiny todo app with no plan file written, the Stop hook answers decision continue with the lit-plan gate reason asking for the plan file. A second block shows a ledger line recording a read_file tool call." /></p>

While a route is active, every tool call lands in `.litgravity/ledger/<conversation>.jsonl` with key shapes redacted, one line per call. Before you stop, `lit handoff` writes `.litgravity/handoff/latest.md` with what was built, how it was checked and what is left, so the next conversation starts from that note.

## Safety and uninstall

- The installer writes only its own plugin folder, its data directory (`$XDG_DATA_HOME/litgravity`) and, when you ask, the status line key in agy's user settings, after a backup. It never reads agy's credential files.
- A symlinked, foreign or edited destination stops the install before the first write, with the command to move it aside. `--dry-run` never mutates.
- Hooks fail open: if one breaks, your conversation continues.
- Engine caches live under `~/.local/share/litgravity/runtime/`. `uninstall` keeps them, so delete that folder to free the space.
- Set `LITGRAVITY_HOOK_TRACE=<file>` before starting agy to log one line per hook call. It is off otherwise.
Three commands cover the lifecycle, and every one previews with `--dry-run`:

| Task | Command |
|---|---|
| Install | `npx @litfamily/litgravity install` |
| Update | `npx @litfamily/litgravity install` (validates, replaces in place) |
| Refresh engines | `npx @litfamily/litgravity runtime install all` |
| Check | `npx @litfamily/litgravity doctor` |
| Remove | `npx @litfamily/litgravity uninstall --yes` |

Files that conversations created in your projects (`plans/`, `.litgravity/`) stay where they are.

## Family

LitGravity is one of the seven LitFamily packages. Each one brings the same way of working to a single coding agent, and each installs and runs on its own: install the one for the agent you use, and it needs none of the others.

The seven armored machines on the cover are those seven packages, and LitGravity is the orbit machine in the seventh bay. The cover is brand motion made with the LitFamily motion skill: drawn and animated artwork, with no agy session recorded in it. If your system asks for reduced motion, you see a still frame instead.

<p align="center"><img src="./docs/assets/litfamily-machines.png" width="100%" alt="The seven LitFamily machines side by side, all lit: LitClaude, LitHermes, LitCodex, LitOpenCode, LitGrok, LitMuse and LitGravity, under LITFAMILY and KEEP THE WORK LIT." /></p>

[LitFamily](https://github.com/wjgoarxiv/litfamily) lists all seven and the agent each one is for.

## License

MIT. See [LICENSE](./LICENSE).
