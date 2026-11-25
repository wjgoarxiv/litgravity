# Changelog

## 0.1.19 — 2026-11-25

- The README cover is redrawn with the framed status card round the whole screen.
- On a truecolor terminal of at least 60 columns and 20 rows the status line is a framed card: the mark, the route and one state word on the title edge, the stage map in whole words with the last tool and its age, the goal's or plan's gauge with the next step, threads and lanes in shared columns, skill chips, and the model, context, quota, branch and version on the bottom edge. A half-sunk three-row sun stands in the cells no text uses. Every state has the same card, and a part with no recorded fact behind it is left out. A short window hides skills before lanes and never a lane in trouble.
- Pills and gauges are round everywhere or square everywhere: the card, the one-row line and the installer read one answer. `LITGRAVITY_HUD_GLYPHS=round|nerd|basic` sets it; otherwise Windows Terminal, VS Code, WezTerm, Ghostty and kitty are round, SSH is square, and elsewhere an installed Nerd Font decides (font file names only, looked up once a day).
- `NO_COLOR`, 256 and 16 colours, the ASCII form, a light background named by `COLORFGBG` and a window under 60 columns in the square form print exactly what they printed before.
- `install` and `uninstall` at a terminal: the LIT mark stands centred over the cards, sized to the window; paths start with `~`; every value starts in the same column; answers fold to one row; the install steps tick off in one card that folds to `5 of 5 checked`; the closing card lists what was installed, how it is set and what to do next; a failure adds an `INSTALL STOPPED` card with its stage, reason and next step. Questions, their order, defaults, stored answers and the plain output (a pipe, CI, `--yes`, `--dry-run`) are unchanged.

## 0.1.18 — 2026-11-25

- The README cover is a new loop: a terminal in the sunset look with a short conversation, a pixel LITFAMILY wordmark, a striped half-sunk sun and the status line, in place of the seven machines. The still for reduced motion is its first frame, and the static fallback picture is that same frame.
- The README demo is a new silent loop of one request on the status line (the loop map, YOUR TURN, evidence files ticking stops, DONE, the sunset), replacing the old still, with a Korean copy for the Korean page; the agy screen around the status line is redrawn.
- At a terminal, `install`, `update` and `uninstall` draw the plan, the questions, each finished step and the result as cards. A question card names its step, says what Yes does and what No leaves alone, and marks the default: `y` or `n` answers at once, the arrow keys or Tab move, Enter takes the highlight, Esc answers nothing. The questions, their order, their defaults and the stored answers are unchanged, and Ctrl+C still ends with the same message and exit code 1.
- A failed install shows what went wrong in a red card, with the remedy below it as text you can copy. Validation warnings stay in view as their own rows.
- `NO_COLOR` keeps the cards without colour; a locale without UTF-8 draws them in ASCII. `--yes`, `--dry-run`, `TERM=dumb`, `LITGRAVITY_AGENT_FILE`, a pipe, CI and a window under 40 columns or 12 rows print exactly what they printed before.

## 0.1.17 — 2026-11-25

- On a truecolor terminal the status line is dressed as a sunset. The mark runs orange to pink, the current stage violet to LitGravity's orange, the separators pink to violet to orange, and a second row under the text holds a half-sunk sun on a glittering sea, with stars in the free cells beside the words. The text itself is unchanged: same words, same order, same gauge widths, and art only in cells no text uses. The scene stands still, because agy redraws the line on events and not while it idles. YOUR TURN keeps its amber and `lit adhd` its rainbow.
- In Windows Terminal and VS Code the gauges get round ends in the cells their brackets had.
- `NO_COLOR`, 256 and 16 colours, the ASCII form and a light background named by `COLORFGBG` print exactly what they printed before. A terminal under 60 columns, or one whose width agy does not report, gets the colours but no second row. `LITGRAVITY_HUD_COLOR=256` gives the single row back on any terminal.

## 0.1.16 — 2026-11-24

- A `lit team` lock folder with no owner record yet is left to the process that just made it for at least 5 seconds, whatever stale window the caller passed. Before, a caller with a stale window of 0 could move aside a lock another process had created a moment earlier, and that process then failed with `lock ownership receipt failed`. A takeover claim that is still being written gets the same grace.
- Both READMEs now say a request can end with `lit` (or `lit-loop`, `litwork`, `lit-hijack`) as well as start with it, and that the first reply asks a goal question built from your words when the project has a test command. They describe where the LIT mark appears and its plain one-line form, and the status line reference names the truecolor pill. The Safety section explains how a `lit team` lock left by a crashed process is reclaimed and what to do if a team command still reports `team state lock timed out`.

## 0.1.15 — 2026-11-24

- `help`, `install` and `doctor` open with the synthwave LIT mark. Its size follows the terminal width, it has a no-colour form, and a pipe, CI log or agent tool call gets the one plain line `LIT · antigravity` instead. On truecolor the HUD mark is now a pill on LitGravity's blue chrome. 256 and 16 colours keep the old bold mark.
- A request that ends with the activation word (`fix the parser bug lit`, `로그인 버튼 고쳐줘. 부탁해 lit`) now routes like one that starts with it, and the goal question uses the words before the word as the objective. A trailing `lit-loop`, `litwork` or `lit-hijack` takes its own route the same way, and a leading `lit-loop <task>` (also `litwork`, `lit-hijack`) now carries its task and asks the goal question too. A question such as `what does lit-loop do?` stays prose.
- A `lit team` state lock left by a crashed holder no longer blocks the team packet for good. The lock is reclaimed when it has no owner record and is older than the stale window, when a dead contender left a half-written takeover claim, or when it is older than 10 minutes even though its pid now names another live process. A timeout names the lock path and its holder.

## 0.1.14 — 2026-11-22

- Every goal question now comes with an answer guide right under it, so a first-time user knows what to type. The guide is a short quote: a `▶ Answer` heading, the goal as `/goal <cond>` (none on a start-only question), a `Type | What happens` table with one row per answer (`yes`, `edit`, `no`, or `yes` and `no`) and the line `Type the word alone.` The question line itself is unchanged, and its `(yes / …)` choices and the guide's rows come from one list, so they cannot drift apart. `goal-propose.mjs` prints the guide after a blank line (and returns it as `guide` with `--json`), and a lit-loop activation note carries it beside the loop goal question. The model renders the guide in your language; the answer words stay the English `yes`, `edit` and `no`, since only those count as answers.
- The README opens with a plain one-line pitch and a new "Two ways to use it" section: the easy way (put `lit` in front of a request) and the full workflow, one step at a time from brainstorm to handoff, with the one-line install under it. The Korean README has the same section.

## 0.1.13 — 2026-11-21

- A `lit` run with no plan (lit-loop, litwork, lit-hijack) can get an agy `/goal` line too. At its first activation, when the prompt names an objective, the project has a test command (`npm test`, `pytest`, `cargo test`, `go test ./...`) and no goal is active or pending, the hook records the question `Set goal for this lit-loop: /goal <cond>? (yes / no)`, where the condition is that command exiting 0 with the objective done, and tells the model to end its first reply with that exact line. A prompt hook cannot draw text for the user in agy, so this reaches you through the model and is advisory. An exact `yes` arms a goal LitGravity owns and gives the line to paste into agy's `/goal`; it starts no start-work run. `no`, `edit` or any other prompt drops the question. With no test command, `goal-propose.mjs --loop --check "<check>" <objective>` asks the same question after the first failing check, and prints `Goal skipped: <reason>.` and records nothing when the check already passes, cannot run or is not an allowlisted test command. `litgoal` and the read-only skills never ask; a loop goal never blocks the next run: a question with another objective, or from another conversation, replaces it, and an old one is dropped at the next session start.

## 0.1.12 — 2026-11-18

- One prompt can start more than one skill. The router collects every skill whose words match the task, three at most, and the activation note lists them with the first as the lead; a moved skill you have not installed comes with its install line. `lit +x +y <task>` names them yourself.
- New `ultra-brainstorm` skill. It prints the quota cost, asks how many idea agents to start (100 or more), then runs them on the cheapest model tier through one `run_workflow` script, with reducers and one judge, and ends on a top list and one question. Its cost line is a range calibrated on a real 100-agent run on agy 1.5.10 (about 28k tokens per idea agent, the system and tool prompt every workflow agent carries; 3.4M for the run): 100 agents ≈ 3.0M-4.8M tokens. A picked option label such as `(Recommended) 100 (recommended minimum)` now reads as 100. Without `run_workflow` it falls back to batched subagents, and without either it reports BLOCKED and offers `lit brainstorm`.
- `lit team <goal>` makes the conversation the orchestrator: it picks subagents, `run_workflow`, herdr panes (only with `HERDR_ENV=1` and `herdr` on PATH) or per-member worktrees by itself, then briefs, watches, merges and verifies. The packet and its state files stay as they were.
- Plans get a `## Done when` check. At approval `goal-propose.mjs` compiles it, lints it, proves it false today and asks `Approve plan, start work and set goal: /goal <cond>? (yes / edit / no)`; an exact `yes` starts start-work on that plan through the hook's own start path and arms a goal LitGravity owns. A check that cannot be a goal turns the question into `Approve plan and start work? (yes / no)` with the reason; a refused start (plan gone, a start-work run already active here) arms nothing. agy's `/goal` cannot be typed by a hook, so the reply gives you the line to paste, and the Stop hook checks the condition at every turn end and says when it is met. `lit cancel` clears only an owned goal. The old "use the goal tool if available" sentences are gone.
- `lit adhd` answers with a verdict card of about six lines (Korean by default, `en` for English); `lit adhd detail` keeps the board. The `lit-recap` skill is removed: `lit adhd recap [session]` replaces it, and `lit recap`, `litrecap` and `/litgravity:lit-recap` still work with a one-line note that it moved.

## 0.1.11 — 2026-11-16

- The handoff is saved for you. agy has no compaction event, so the Stop hook now writes `.litgravity/handoff/auto.md` at every turn end of a conversation a lit route has touched (the last request, the next plan row, the open goal criterion, the tail of the last reply; credentials redacted), and a new conversation's SessionStart carries the newest of that note and `latest.md` whole instead of only pointing at `latest.md`. It is on by default; `LITGRAVITY_AUTO_HANDOFF=0` turns both halves off and restores the pointer.
- A notice is no longer repeated in a project that already saw it. The update notice (per release), the extensions notice and the `lit adhd` nudge are recorded in `.litgravity/shown/notices.jsonl`; a missing or corrupt record shows them as before. The same file gets one `run-end` line (`waiting`, `nothing` or `sent`) when a start-work, lit-loop or litgoal turn ends.

## 0.1.10 — 2026-11-14

- New `litgravity extensions` command, so the four install lines no longer have to be pasted by hand. It writes nothing until you add `--yes`; without it, it prints which folder moves where.
  - `extensions install <id...>` (or `--family <name>`, `--all`; `--project` for `.agents/skills`) looks for another skill with the same name in every folder agy 1.5.6 loads and stops, naming its path, when there is one (`--allow-shadow` installs anyway and only warns). It moves an existing copy whole into `~/.gemini/extension-backups/<stamp>[-project]/<id>`, copies the skill in through a temporary folder so a failed copy changes nothing, and writes the receipt. The temporary folder sits outside every folder agy loads (`~/.gemini/extension-backups/.staging` for user scope, `.agents/.litgravity-staging` beside a workspace's `skills/`), so a copy cut short by Ctrl-C never appears as a second skill with the same name; if the last step fails, the old copy is put back and the ids already installed are named. The receipt keeps the four keys of the hand lines and adds `scope`, `hash`, `files`, `source_commit` and `installed_by`.
  - The source is a clone you name with `--from <path>`, or LitGravity's own shallow, sparse clone of `variants/litgravity` in `~/.cache/litgravity/extensions-src` (`$XDG_CACHE_HOME`). When git is missing or the network is down, it stops before any write and points at `--from`.
  - `extensions update [<id...>]` fetches the source and reinstalls only the extensions whose files changed; the rest are reported as current. When a planned copy stops, no receipt is touched. A dry run compares with the cached copy without fetching and says so. Naming an id that is not installed exits 1. A receipt written by the hand lines has no hash, so update compares with the installed files instead.
  - `extensions remove <id...>` moves a copy LitGravity installed into the backups and refuses a folder without its receipt, naming the path.
  - `extensions list [--json]` shows each of the nine as installed (with receipt), not installed, user-managed, or shadowed by and competing with a same-name skill elsewhere. `extensions check [--json]` changes nothing. It reports duplicates, copies without a receipt, receipts whose source is gone, a plugin copy that still carries a full old skill, and the backups with their total size, and prints the fix for each; it exits 1 when something needs action.
  - `extensions prune-backups [--older-than <days>]` lists the backups with their sizes and deletes only with `--yes`, only inside `~/.gemini/extension-backups/`.
- The nine stubs, the extensions notice, the router note, `litgravity list`, `help`, both READMEs and doctor name the command first and keep the four lines as the manual route. Doctor adds an `extensions` row with the `check` summary. When an install or update finds something for `check` (an old copy without a receipt, a duplicate), the extensions notice gets one more line pointing at `extensions check`; nothing changes on its own.
- Installing an extension over a folder that is already there is safe now. The stubs, both READMEs, the post-install extensions note, the router note, `litgravity list`, `doctor` and the autoresearch figure guide all give the same four lines, for user scope (`~/.gemini/config/skills`) and for one workspace (`.agents/skills`), pasted one at a time in zsh or bash:
  1. A read-only `find` that prints the `SKILL.md` of every skill with that name in the four folders agy 1.5.6 loads bare skills from: a workspace's `.agents/skills` and `_agents/skills`, then `~/.gemini/config/skills` and `~/.gemini/skills`. agy keeps one same-name skill without a word, a workspace copy first, so a second copy anywhere there would shadow the extension.
  2. When the destination exists, a move of the whole folder into `~/.gemini/extension-backups/<YYYYmmdd-HHMMSS>/<id>` (`…-project/<id>` for a workspace copy), a folder agy never scans. Your own files in the old copy stay there intact. An `<id>.bak` folder beside the skill would be loaded as a second skill with the same name, and agy may prefer it, so no line ever writes one.
  3. A `cp -R` into the emptied `<dest>/<id>`, guarded so it never copies over a folder that is still there (the old line copied into `<dest>/`, which mixed the new files into an old copy and left its stale files in place).
  4. A receipt, `<dest>/<id>/.litfamily-extension.json`, holding `id`, `source`, `variant` and `installed_at`. agy ignores the dot-file.

  To update, run the same lines again; to remove, run the second line alone. Nothing deletes. LitGravity's own install and update still write only the plugin folder, so they leave the extension and its receipt alone.
- When the global rule file `~/.gemini/config/rules/litgravity.md` holds text LitGravity did not write, or was edited, the refusal used to suggest moving it to `litgravity.md.saved-<date>` inside agy's rules folder, which agy and its agent read. It now suggests `~/.local/share/litgravity/saved/rules-litgravity-<time>.md` (`$XDG_DATA_HOME/litgravity/saved/`), outside every folder agy reads.
- The nine stub budgets in `skills.lock.json` grew to fit the new lines (7,000-byte ceiling, 4,800-byte floor).
- Both READMEs are shorter and easier to scan. The status line, hand install, agent prompt and limit details moved to `docs/reference.md` (and `docs/reference_ko-KR.md`), run-on paragraphs are split, Quick start points at Install, and the update line is there.

## 0.1.9 — 2026-11-11

LitGravity is now the LitFamily core for agy, complete on its own. The nine skills that make files became LitFamily extensions, kept on the extension shelf at https://github.com/wjgoarxiv/wjgoarxiv-skills, so a LitGravity install stays small; install the ones you use alongside LitGravity for the full LitFamily experience. Their ids, route words and `/litgravity:<id>` forms still work, and each one now answers with a short stub that says it is a LitFamily extension and how to install it.

- What moved, by family: decks (`lit-pptx`), documents (`lit-docx`), figures (`lit-diagram-drawer`, `lit-schematic`, `lit-scientific-visualization`), design (`frontend-ui-ux`, `visual-qa`) and video-covers (`lit-typographic-motion`, `readme-studio`).
- To keep using one, clone the repository once and copy that skill's agy folder into agy's user skills:

  ```bash
  git clone https://github.com/wjgoarxiv/wjgoarxiv-skills
  mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/<id>" ~/.gemini/config/skills/
  ```

  For one workspace only, copy it into that workspace's `.agents/skills/` instead. Start a new conversation (or type `/skills reload`) and the skill answers as `/<id>`; `lit` prompts that reach the stub hand over to it. The copy stays in place when LitGravity is upgraded or removed. Without a copy the stub gives that install line and makes nothing. `litgravity list` marks each moved skill with its family and `doctor` names them all with the line.
- Removed with the skills: the engines they shipped (`office`, `diagram`, `readme`, `sciviz`, `motion`), the `litgravity runtime` command, the Python picker, the motion done gate that held a film turn until its render passed, the motion cover QA script, and the doctor rows for the design corpus, the Chrome driver, motion readiness, LibreOffice, pandoc, Poppler, XeLaTeX, ffmpeg, libwebp and the Pretendard font. The design routes no longer ask the theme question, because the stub asks nothing. The agy copies in wjgoarxiv-skills carry their own engine installers.
- Every successful install or update ends with a short `LitFamily extensions` note: the core is complete, where the extensions live, the clone and install lines, and, on an upgrade that left one, the exact path of the old engine cache. The next agy conversation carries the same note once, through SessionStart, and asks the model to pass it on in its first reply. A dry run, a refused install and `--json` output never show it.
- After upgrading: `npx @litfamily/litgravity@latest install` replaces the old plugin folder whole, and agy has no hook trust step, so there is nothing to re-approve. Earlier releases cached the engines under `~/.local/share/litgravity/runtime/` (`$XDG_DATA_HOME/litgravity/runtime/`); nothing reads it now, the extensions keep their own cache, and `uninstall` leaves it, so delete that folder to free the space. `doctor` names it as `old engines` while it is there.
- The keep-your-edits advice for an edited or foreign plugin folder used to move it to a `litgravity.saved-<date>` folder beside the plugin. agy loads every folder in its plugins folder, so that copy ran as a second LitGravity with the old skills and hooks. The command now moves it to `~/.local/share/litgravity/saved/<scope>-<date>`, outside every folder agy scans, and `doctor` warns about any `litgravity*` folder left beside the plugin, with the command that moves it out.
- autoresearch draws its convergence figure through your installed `lit-scientific-visualization` copy, then a project Python that can import matplotlib, and otherwise marks the figure step BLOCKED with the install line. autoconference draws `conference_progress.png` with a Python that can already import matplotlib (its `style_presets.py` doubles as the probe) and skips the figure with a ledger note when none can.
- The package drops from 1,547 files to 520. `skills.lock.json` holds stub-sized budgets for the nine ids and lists them in `policy.movedStubs`, the only ids the family floor skips.

## 0.1.8 — 2026-11-11

- lit-adhd now opens with a KPI board instead of the per-session brief: the one thing to do now with the exact text to type (or what to wait for), four counts (done, in progress, waiting on you, left) with an overall bar, a milestone table with ten-cell bars, up to five things done lately, up to seven left in plan order, and up to five reminders shaped `thing → what to do`: a conversation waiting on you, uncommitted changes and unpushed commits per worktree, lanes still working, plans untouched for a week, the handoff's next item. The collector computes all of it and puts it in the JSON as `board` and `boardText`. The board shows no conversation ids, commit hashes, status codes or plan paths. `lit adhd detail` (or `자세히`) adds the old per-session brief under the board; the next-step choice and `go` work as before.

## 0.1.7 — 2026-11-09

- TypeScript language-server install hints pin `typescript@6`. TypeScript 7 ships no `lib/tsserver.js`, which `typescript-language-server` loads.

## 0.1.6 — 2026-11-01

- A film on the stage path can now carry real keyed footage. Put the chroma-keyed frames of a clip (8-bit RGBA PNG, real transparency) under `stage/clips/<dir>/`, declare them in `stage/clips/clips.json`, and the page shows them with `LitStage.clip` from film time: `start = cue - (N-1)/fps` lands a frame on a cue. The scan holds declared clips to their own limits (12 clips, 360 frames each, 1500 in all, 40 MB each, 128 MB in all, long side up to 720 px, up to 30 fps), a frame folder that is not declared is still refused as a flipbook, cover mode takes none, and the flash audit and determinism replay still run on the final pixels.

## 0.1.5 — 2026-10-31

- The plugin now carries the official LitFamily ignition icon (`plugin/assets/logo.svg`, wired as the manifest `logo`), so `agy plugin validate --json --strict` reports zero findings instead of the no-logo note.
- lit-adhd no longer tells this session to `lit continue` or `go` while other lanes work: the next-step chooser counts lanes first, so a held paused frame or a held own run offers no resume and no continue, and the session's own card shows the hold instead of the resume command. Answering a lane that waits on the user is still offered through the hold.
- User-scope installs now leave one owned rule file at `~/.gemini/config/rules/litgravity.md`, because agy reads that folder at every session start and a shared `GEMINI.md` block is refused on symlinked files. The rule stays short: the lit activation word, where plans and handoffs live, and the release freeze. An interactive install asks first and a No stores the rule off; `--yes` adds it, `--no-agent-file` skips one run, and `config agentFile off` removes it at any time. `doctor` reports it as `agent file`, and `uninstall` takes back exactly the file it wrote. `agent-file project --dir <path>` writes the matching project block into a repo's `AGENTS.md`.
- A `ci.yml` workflow runs the repo's gates on push and pull request to `main`: tests, version lockstep, legacy-token scan, plugin validation, fixture pinning, pack dry run, route listing and the no-release-command guard. The runner has no agy, so host-dependent tests skip with a reason and validation reports SKIP.
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
