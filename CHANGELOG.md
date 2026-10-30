# Changelog

## Unreleased

- lit-adhd no longer offers `go` to start a plan while other lanes work: another conversation of the workspace that is running or waits on you, or, under `HERDR_ENV=1`, a working or blocked herdr agent on this repo. The box says to answer the waiting lane or wait for them, and the last line says not to type `go` yet. When `go` arrives the hook re-checks the step and starts nothing if the run finished or is not this conversation's. The HANDOFF step now comes from the newest HANDOFF file, skips Next items already marked done, and ranks above an ended conversation.

## 0.1.4 — 2026-10-28

- The interface check now starts its headless Chrome with a stand-in keychain, so macOS no longer pops up "keychain not found" while it runs.
- Releases are now built and published from GitHub Actions with npm provenance. The npm page shows a green check that links each version to this repository and the commit it was built from, so a copy published under another name cannot claim to be this one.

## 0.1.3 — 2026-10-28

Plans:

- After `lit plan` saves a plan, type `go` in the same conversation within 30 minutes and start-work picks it up.
- If a plan's tasks touch a folder outside the project, the plan asks for a `Scope roots: <path> (<actions>)` line before it is saved, and the plan checker points at any path that line does not cover. The line is a reminder, not a lock.

Status line:

- Each conversation keeps a small record of whether it is running, idle or ended. The status line uses it to show the other conversations in the same workspace as one count, such as `+2 running · 1 idle`, and shows a start-work that just finished as done for a minute.

lit-adhd:

- The brief now opens with three lines: what is done, what is happening now, and what comes next. It also lists idle and finished conversations, reads plans before transcripts, says how many plan files it skipped, and, when nothing else suggests a next step, uses the `## Next` item of this folder's HANDOFF file. The box is a plain code fence.

Project:

- `TRADEMARK.md` explains how the LitGravity and LitFamily names and logos may be used. The code stays MIT.

## 0.1.2 — 2026-10-27

New skills (42 in all):

- `lit-adhd` (also `lit-rewind`) tells you where your recent agy conversations stand: what each asked, did and waits on, how far the plans and goals have come, and one next step. Type `go`, `ㄱㄱ` or `진행` within 30 minutes and it starts that step. The brief is drawn in code, works in Korean and English, and masks credentials, environment values, one-time codes and terminal control sequences before anything is shortened.
- `lit-hijack` ports the know-how in someone else's published work into your own skill or system, clean-room: captures with provenance, a licence check, an overlap check that also covers Hangul, nine phase checks, a separate implementer, and a build brief that holds no source text.
- `lit-schematic` draws P&IDs, PFDs, equipment layouts, journal apparatus figures and isometric cutaways from a full symbol library, routes the lines, and checks the drawing with a QA gate and a look at the render.

Workflow:

- Routes can nest. `lit brainstorm` in the middle of `lit-loop` pauses the loop instead of ending it, and `lit continue` resumes it where it stopped. `lit approve` and `lit deny` record a start-work decision.
- The status line shows paused routes and running lanes, turns rainbow on every way into lit-adhd, and has three new looks: YOUR TURN in amber with the reason when a turn ends waiting on you, the five review-work lanes with their verdicts as each one reports, and a short DONE mark when a plan or goal finishes.

Making things:

- Diagrams, schematics, figures and films now come out rich by default; ask for minimal when you want it.
- `lit-pptx` adds five tonalities (computational brutalism, neo-brutalism, bauhaus, riso, newsroom), a shared slide grid and JetBrains Mono, and renders decks in their embedded fonts.
- `frontend-ui-ux` adds five house styles, a design lock that keeps a project on its chosen style, a small component kit, layout starters and new probe rules.
- Films get a house style, a shot grid, a starting page, a storyboard round before the full render, a story and protagonist, a three.js route for 3D (with Blender when it is installed), a layered score, and new checks for overlapping text, empty frames and dead air.
- The design skills ask you to pick a theme first, with the recommended one on top, unless you already named one or said to choose.
- The READMEs gain a "What you can make" gallery of real outputs.

Safety:

- `lit-hijack` captures and film asset downloads reach only public `https` hosts, on every redirect, connect to the address that was checked, and stop reading once a body passes its size cap.
- `lit-hijack` refuses a repository path that leaves the clone.

## 0.1.1 — 2026-10-26

- The README studio's HyperFrames and Remotion cover templates pin newer `hono` and `fast-uri` in their lockfiles, picking up upstream fixes. A fresh template setup installs these versions.
- Both READMEs are rewritten with real captures of the install check, the status line states, a held handoff and a short demo, plus overview tables. The images stay in the repository, so the npm page loads them from GitHub.

## 0.1.0 — 2026-10-22

First release of LitGravity, the LitFamily member for Google's Antigravity CLI (probed on agy 1.4.3).

### Plugin

- The `litgravity` plugin: `plugin.json`, a root `hooks.json` with six events, `rules/AGENTS.md`, 39 skills, 11 agents and the opt-in status line script.
- The status line (`hud/statusline.mjs`, `hud/render.mjs`) in the LitFamily status-line style: the bold `[🔥LIT v…]` mark on the pink, violet, cyan gradient, then one accent (LitGravity's flame orange, 255 99 55) for every segment, `|` after the mark and `│` between segments, and the family order `model [effort] │ ctx [█▎░] n%/size │ quota [..]n%`. The active route follows as the pink `🔥 LIT` chip with its clock (`🔥 LIT IGNITED · <route> 🔥` for the first 90 seconds), then its place on the family map: PIN, RED, GREEN, VERIFY, REVIEW, RECORD for the open criterion, read from its evidence file names, or interview, plan, work, review, done with start-work's plan rows, and lit-team's lanes. Context and quota gauges turn yellow at 70% and red at 90%. agy's cost, task count, branch and title follow when they arrive. The line fits the terminal width, has 256-colour, 16-colour, no-colour and ASCII forms, strips control characters from host strings, and always prints one line and exits 0, because agy turns a failing status line off.
- Bare `lit` activation through `PreInvocation`: the router reads the newest `<USER_REQUEST>` from `transcriptPath` on the first model call of a turn and injects one ephemeral step. agy has no `UserPromptSubmit` event. Every full activation also tells the model to read first, because a headless run ends with no output when a command or file write is refused.
- Re-entry (M8 D1): the first `lit` of a conversation sends the full activation; the same route again sends a note under 600 bytes without the skill re-read and keeps the route state; `lit <other route>` switches with a full activation; a bare `lit` or `lit continue` resumes a plan already started with start-work; `lit new` and `lit restart` start over; `lit start` is always a full activation; a bare `lit` with nothing active or resumable asks what to run. Unreadable state falls back to the full activation.
- Route words: loop, plan, work, goal, research, review, start, recap, status, handoff, init, debug, interview, crucible, commit, refactor, burnoff, burnoff-file, the brainstorm words (D2: brainstorm, brainstorming, ideation, ideate, idea, ideas), team, conference, rules, lsp, diagnostics, lsp-setup, typecheck, motion, film, video, 영상, explain, wikify, wiki, autoresearch, readme, deck, slides, pptx, ppt, docx, diagram, 다이어그램, 도식, figure, plot, code, tdd, structural, ast, ast-grep, codemod, humanize, korean, 다듬어 and 윤문. `lit review plan|work` forces a review mode (D3). Any skill id typed whole after `lit` (`lit debugging …`) or as `/litgravity:<id>` reaches that skill, and a film-making request routes to the motion skill while footage editing, captions and UI motion stay out.
- Guards: agy's `PreToolUse` cannot abstain (an empty answer is a denial), so the hook is matcher-limited to child agents (`invoke_subagent|define_subagent`), where it denies agents that could write during lit-plan. File writes, shell commands and prose are checked after the fact: a workspace snapshot taken when a lit turn starts is compared in `PostInvocation` (which injects an undo request and forces one more round, twice at most) and in `Stop`. During lit-plan anything changed outside `plans/` is reported; on every lit route except the humanizer, Markdown that gained stacked negations or hedges is reported. `Stop` also holds a planning turn once until the plan file exists, and holds start-work and litgoal turns while rows or criteria are open (three holds at most without progress).
- Motion done gate: while the motion route is active, `PostToolUse` records every `motion.mjs` command and every image `read_file` opened, and `Stop` runs the skill's done-check on the last output folder, holding the turn at most twice and then asking the reply to say the work is not done. agy's `PostToolUse` payload carries no command output, so a render that wrote no manifest shows up as "no full render has finished".
- Route state lives outside the workspace under `$XDG_STATE_HOME/litgravity/` with a journal, so a damaged state file keeps a planning limit on. Tool events go to `.litgravity/ledger/<conversation>.jsonl` with key shapes redacted. `LITGRAVITY_HOOK_TRACE=<file>` logs one line per hook call.

### Skills and engines

- All 39 family skills at their pinned depth (`test/fixtures/skill-depth.json`): bodies within the 24,000-byte limit agy loads, the long material in `references/`, scripts and templates beside them. `wikify` runs as script subcommands because a plugin cannot ship an MCP server here, and `lit-handoff` always writes `.litgravity/handoff/latest.md` because agy has no compaction event.
- `lit-typographic-motion` (films and seamless README cover loops) with its renderer, type engine, fonts, cover recipes and four slide-like negatives the gate has to keep failing. Every negative and regression declares the gates it must fail (`mustFail`); `scripts/qa-cover-recipes.mjs` counts a case as caught only when its render completed and gated the decoded file, every declared gate failed at its tier, and no undeclared FLOOR gate failed. The painted recipe's `feather-150` regression declares `G1.target` only, and look review owns the soft-wash defect.
- Five engines (`office`, `diagram`, `readme`, `sciviz`, `motion`) install only into `$XDG_DATA_HOME/litgravity/runtime/<name>`. Engines that build a Python environment use `plugin/lib/python-pick.mjs`: a `python3` newer than 3.14 has no wheels, so it tries `python3.14` to `python3.10` on PATH, honours `LITGRAVITY_OFFICE_PYTHON`, `LITGRAVITY_SCIVIZ_PYTHON` and `LITGRAVITY_MOTION_PYTHON`, and ends in `BLOCKED` with the exact fix.

### Installer and CLI

- `npx @litfamily/litgravity install` copies an owned bundle to `~/.gemini/config/plugins/litgravity` (user scope, the default) or `./.agents/plugins/litgravity` (project scope), validates it with `agy plugin validate` before and after, and fails closed on symlinked, foreign or edited destinations. `--status-line` is an explicit opt-in for the user-level settings file. A status line LitGravity did not write is refused unless `--replace-status-line` is given; then its value goes into `statusline-replaced.json` beside the timestamped settings backup, and `uninstall` restores it.
- `doctor` checks the install, the validation result, hooks and a smoke run of each hook script, skills, agents, rules, routes, engines, host programs, the Python the engines will use, and cheap checks that ship inside skills (the frontend corpus and dataset hashes, the handoff closure, the wikify script, the checker inventory, the Chrome driver, the browser tiers, motion readiness).
- `list` prints every skill with the words that reach it, its purpose and its engine; `models`, `runtime` and `uninstall` complete the set.

### Verified on agy 1.4.3

- A bare `lit` ignites (`LIT IGNITED`), a resumed bare `lit` continues the active route (`LIT CONTINUES · lit-loop`, no skill reload) and `lit new` ignites again; `lit brainstorm …` reads the brainstorm skill; `PostInvocation`, `PostToolUse` and `Stop` fire; the model reads a PNG through `read_file`.
- Headless runs auto-deny `run_command` and `write_file`, and the denial ends the run with an empty answer. A plugin whose real path lies outside the workspace was denied its skill `read_file` in a headless run, while a project-scope copy inside the workspace was read.
