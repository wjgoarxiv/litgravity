# Phase 9 + 10 — Cleanup and Final Verification

After the session, the working tree differs from before it only by the real fix and its test. Anything else is a process failure.

---

## Phase 9 — Cleanup and Revert

### The walk

Open the journal's "Artifacts to revert" list. Walk it top to bottom. Check a box only after its revert command succeeds with no error.

### Standard revert operations

Most sessions create some mix of these artifacts. The commands below are the defaults; your journal holds the exact commands for this session. Run them through `run_command`.

```bash
# --- Temporary source edits (instrumentation statements, debug prints) ---
git checkout <file>                              # reverts only that file
git diff <file>                                  # verify clean

# --- Long-running debug sessions started with run_command / tmux ---
# End the long-running run_command you journaled, then confirm its port is free.
tmux kill-session -t <session-name>              # if you used tmux
tmux ls                                          # confirm gone

# --- Temp fixtures / scratch scripts ---
rm -f /tmp/debug-*.*
ls /tmp/debug-*.* 2>/dev/null                    # confirm gone (ls returns non-zero when no match)

# --- Background processes (debugger-attached runtimes) ---
pkill -f 'node --inspect' || true
pkill -f 'python -m pdb' || true
pkill -f 'debugpy' || true
pkill -f 'dlv' || true
pkill -f 'gdb' || true
pkill -f 'lldb' || true

# --- Debug-relevant ports confirmed free ---
lsof -iTCP:9229 -sTCP:LISTEN -nP 2>/dev/null     # Node inspector default
lsof -iTCP:5678 -sTCP:LISTEN -nP 2>/dev/null     # debugpy default
lsof -iTCP:2345 -sTCP:LISTEN -nP 2>/dev/null     # dlv default
lsof -iTCP:9999 -sTCP:LISTEN -nP 2>/dev/null     # pwndbg/gdb-server default

# --- Env var overrides in the current shell ---
unset DEBUG_OVERRIDE_FOO
unset PYTHONBREAKPOINT
unset RUST_LOG
unset DEBUG

# --- Ghidra scratch projects (only if created for this session) ---
# rm -rf ~/ghidra-projects/debug-scratch

# --- Core dumps from debugging (if any) ---
rm -f ./core ./core.* ~/core.*

# --- Playwright trace files ---
rm -rf playwright-report/ test-results/
```

### The verify command

This is the single most important check in the whole skill:

```bash
git status
git diff --stat
```

The diff contains exactly three things:

1. the real fix;
2. the new failing-first test;
3. nothing else.

### Detector checklist — scan the diff for these

When `git status` shows an untracked debug file, or `git diff` shows one of the patterns below, the cleanup is unfinished. Clear it.

| Pattern | Usually means |
|---|---|
| `debugger;` | A Node debug statement left behind |
| `breakpoint()` | A Python debug statement left behind |
| `dbg!(...)` | A Rust debug macro left behind |
| `fmt.Println("DEBUG: ...")` | A Go ad-hoc print |
| `console.log("[DEBUG]` | A Node ad-hoc log |
| `print(f"DEBUG: ` | A Python ad-hoc print |
| `// TODO DEBUG`, `// HACK`, `// XXX` | A stale debug marker |
| `// DEBUG-<slug>` | A session-specific marker from this skill's edits |
| Commented-out blocks near the fix | Dead code from trial fixes |
| Reordered imports or formatting in unrelated files | Drift from the editor's autoformat during the session |

### Remove the journal

Once the git check is clean:

```bash
rm .debug-journal.md
sed -i.bak '/^\.debug-journal\.md$/d' .git/info/exclude && rm -f .git/info/exclude.bak
```

The journal is session scratch; it stays out of the commit and the git exclude list.

---

## Phase 10 — Final Verification

The last gate before you report done. All four gates hold, and all four carry **evidence in the final message** to the user. A gate passed without evidence counts as failed.

### The four gates

1. **Red-to-green toggle confirmed** — the failing test output from before the fix and the passing output after. Both visible in the reply or the journal.
2. **Full suite green** — the suite's final pass line (for example `42 passed in 3.14s`), not only the new test.
3. **Manual QA reproduced the fix** — the command or scenario that originally failed and its now-correct output, verbatim.
4. **Working tree clean of debug artifacts** — `git diff --stat` showing only the fix and the test, plus `git status` clear of untracked debug files.

A gate missing its evidence means the work is unfinished: return to the matching phase.

### Final message template

Keep it short and evidence-dense. The user should skim it in 30 seconds.

```markdown
Fixed.

**Root cause**: <one sentence — the mechanism, not the symptom>
**Fix**: `<file:line>` — <two words>
**Test**: `<test file>::<test name>` — red without the fix, green with it
**QA**: <one line: what you ran and what you saw>

Diff:
```
<git diff --stat output — small>
```

**Next steps I did not take** (awaiting your decision):
- <follow-up 1, if any — from the QA silent-failure scan or a refactor noted in Phase 7>
- <follow-up 2 — or "none" if nothing else surfaced>
```

### Worked example

```markdown
Fixed.

**Root cause**: the agent's `model.baseUrl` was hardcoded to `api.example.com`, so the `SERVICE_BASE_URL` env var was ignored. The proxy key was rejected by the real API with 401, and the client packaged the error into the message's `errorMessage` field instead of throwing, so the route's try/catch never fired and the caller received HTTP 200 with empty content.

**Fix**: `core/bridge/modelResolver.ts:117` — override baseUrl
**Test**: `__tests__/core/modelResolver.test.ts::resolves_env_override` — red without the fix, green with it
**QA**: `curl -X POST /api/refinement/chat` with the proxy env set; observed non-zero usage and non-empty content

Diff:
```
 core/bridge/modelResolver.ts            | 3 +++
 __tests__/core/modelResolver.test.ts    | 42 ++++++++++++++++++++++
 2 files changed, 45 insertions(+)
```

**Next steps I did not take** (awaiting your decision):
- the bridge swallows API errors into `errorMessage`; a throw-on-error wrapper at the orchestrator layer would surface these upstream
- the same silent-failure pattern lives in the planning route — likely the same fix applies
```
