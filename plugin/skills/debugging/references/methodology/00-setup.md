# Phase 0 + 1 — Environment Assessment and Journal Setup

Before you touch anything, you need a map of what is running and a ledger of what you will change. Skip either and the debug session turns into a "why is my repo dirty a week later" session.

---

## Phase 0 — Environment Assessment

Map the ground truth before you attach. Attaching the wrong way costs the first hour.

### 1. Identify the runtime

Read the actual manifest file instead of guessing from extensions:

- Python -> `pyproject.toml`, `requirements*.txt`, `setup.py`, `uv.lock`, `.python-version`
- Node -> `package.json` (read `scripts`, `engines`, and whether `type: module` is set)
- Rust -> `Cargo.toml`, `rust-toolchain*`
- Go -> `go.mod`, `go.sum`
- Native or mixed -> `Makefile`, `CMakeLists.txt`, and the binary itself (`file <path>`)

Run these reads and `file` checks through `run_command`, or with `read_file` for the manifests you can name.

### 2. Load the matching runtime reference

The moment you know the runtime, read `references/runtimes/<runtime>.md`. The commands in this phase, and in every phase after, are runtime-specific. The shape of the answers stays the same; the commands differ.

### 3. Gather observable environment state

The shape of the answers you need (the exact commands live in the runtime reference):

| Question | Why it matters |
|---|---|
| Which binary, interpreter or runtime actually launches the process? | It decides how debugger flags plumb through. Wrappers (`tsx`, `poetry run`, `cargo run`, `bun`, supervisor scripts) change how flags propagate. |
| Is a debug-relevant port already in use, or is another instance of the service running? | Attach to it on purpose, or stop it on purpose. Competing silently corrupts the session. |
| Are symbols, source maps or debug info present and correct? | They decide whether breakpoints land on the right lines. Compiled-but-not-debug builds, stripped binaries and incomplete source maps all misplace breakpoints without warning. |
| Does the code path need env vars, config files or auth tokens to reach the bug? | A missing env var often produces an early-return path that imitates the bug. |
| Is there an existing failing test or a known repro? | Amplify an existing repro before you invent one. |
| Will a watcher (file watcher, hot reloader, supervisor) restart the process mid-session? | A restart drops inspector connections and invalidates breakpoints. Turn watchers off before attaching. |

### 4. Gate check

If any answer is "I am not sure", you are not ready for Phase 1. Investigate until certain. Guessing here cascades into false-positive hypotheses in Phase 2.

---

## Phase 1 — Journal Setup

Open one journal file at the project root: `.debug-journal.md`. It is the single record of every artifact this skill creates, and the contract that says you can undo all of it.

### Keep it out of git

```bash
grep -qx '.debug-journal.md' .git/info/exclude || echo '.debug-journal.md' >> .git/info/exclude
```

`.git/info/exclude` is per-clone and never committed, which is what you want for a local-session artifact.

### Journal template

```markdown
# Debug Journal — <short bug name>
Started: <ISO timestamp>
Goal: <one-sentence user request>

## Environment snapshot (Phase 0)
- Runtime: <language + version + launcher>
- Entry: <command that starts the process>
- Ports / sockets: <app=..., debugger=..., etc>
- Git HEAD: <sha>, working tree clean? <yes/no>
- References read: <the files from references/ you loaded — this proves the gate>

## Hypotheses
1. [STATUS] <hypothesis> — distinguishing evidence: <what confirms or refutes> — if true, the fix is: <two words>
2. ...

## Failed hypothesis round counter
- Round 1: <result>
- Round 2: <result>
<!-- At 2 consecutive inconclusive rounds, run the orthogonal reframing review in 04-oracle-triple.md. -->

## Artifacts to revert
<!-- Every temp edit, terminal session, fixture, env override, saved debugger session goes here
     BEFORE it is created. The rule is journal-then-modify. -->
- [ ] `src/foo.py` — added a breakpoint on 2 lines. Revert: `git checkout src/foo.py`
- [ ] terminal session `debug-server`. Stop: end the long-running run_command and confirm the port is free.
- [ ] `/tmp/debug-payload.json`. Remove: `rm /tmp/debug-payload.json`
- [ ] env var in the current shell: `FOO_BASE_URL=...`. Unset when done.
- [ ] Ghidra scratch project `~/ghidra-projects/scratch`. Remove if not promoting.

## Findings
<!-- Append observed values here with a timestamp. Verbatim only, no paraphrasing. -->

## Orthogonal reframing review (if invoked)
<!-- One subsection per reframing round, with the synthesized falsification queries and the new hypothesis set. -->

## Final fix
<!-- File paths + test path. Filled during Phase 7. -->
```

### The journal-then-modify rule

Before any change to the repo, the shell, or system state, append to "Artifacts to revert" first. This single discipline keeps debug sessions from becoming git-cleanup sessions.

Catch yourself about to run a command that creates a file, opens a port, or edits source: stop, journal the intended artifact with its revert command, then run the command.

### Why one journal, rather than scattered TODO comments

- One `git checkout`, one `rm`, one "stop the background run" list makes the Phase 9 walk simple.
- It survives interruptions. Pulled away mid-session, the next agent (or you, later) can continue or revert without guessing.
- It prevents the most common failure: leaving `console.log`, `print()` or `dbg!` scattered across the tree.

### Writing artifacts under agy

- Long-running processes you start (a dev server under a debugger, a proxy) are launched with `run_command` and `WaitMsBeforeAsync` so the call returns. Journal the command and how you will stop it, read its output with `command_status`, and end it before cleanup.
- A refused `run_command` in a headless `agy -p` run ends the run. When Phase 0 needs a command the host denies, record `BLOCKED:` with the missing permission and the reads you did complete, rather than retrying the same denied command.
