# Phase 6 + 7 — Root Cause Confirmation and the Test-First Fix

A cause is confirmed only when you can toggle the bug by toggling the cause. Every weaker level of evidence is correlation, and correlation-driven fixes ship bugs.

---

## Phase 6 — Root Cause Confirmation

Call the cause "confirmed" only when all three of these hold:

### 1. The captured runtime value matches the hypothesis exactly

The value is the value the hypothesis predicted, not a value "consistent with" it. If the hypothesis was "baseUrl stays `api.example.com` despite `SERVICE_BASE_URL` pointing at a proxy", the captured value is literally `"https://api.example.com"` in the debugger at the moment of the HTTP call.

### 2. Reproducible

A second run yields the same observation. A flaky repro means you have isolated a symptom that sometimes appears with the cause, rather than the cause. Keep investigating.

### 3. Toggle proof (the one most often skipped)

**Changing the value** (through a debugger assignment, an env override, or a one-line speculative patch) **makes the bug go away, and reverting the change brings it back.**

Without a toggle you have a correlation, which is a strong hypothesis rather than a confirmed cause.

Valid toggle proofs:

| Suspected cause | Toggle |
|---|---|
| An env var overrides the library default, and the override is wrong | Unset the env var -> the bug goes away. Reset it -> the bug returns. |
| An async task is never awaited | Add `await` -> the bug goes away. Remove it -> the bug returns. |
| The SDK uses a hardcoded URL | Patch the SDK to use the env URL -> the bug goes away. Unpatch -> the bug returns. |
| A race on shared state | Add a mutex -> the bug goes away under load. Remove it -> the bug returns under load. |

When you cannot build a toggle proof, the cause is unconfirmed. Run one more round.

### Update the journal

```markdown
## Root cause (confirmed <ISO timestamp>)
- Mechanism: <one paragraph, causal not correlational — the chain from cause to observable symptom>
- Evidence: <file:line of the captured value | path to the saved repro | address + register state>
- Toggle proof: "With <change X>, the repro produces <good>. Reverting <change X>, the repro produces <bad>."
- Fix scope: <files and approximate line count>
```

The "mechanism" field is the acid test. If you cannot write the causal chain from cause to observable symptom as one paragraph, you do not yet understand the bug well enough to fix it.

---

## Phase 7 — Test-First Fix

Red, green, refactor. No shortcuts. Follow `../lit-code/SKILL.md` for test style.

### 1. Red — a failing-first test

Write a test that fails *because of this bug*:

- **The test name reads like a bug report.** `test_refinement_turn_returns_empty_content_when_api_returns_401` is good; `test_bug_fix` is not.
- **The failure message shows what the bug looks like.** Someone reading only the failure output understands what is broken.
- **Minimum infrastructure.** When a unit test against the right seam captures the mechanism, do not spin up the whole server.

Run the test, confirm it fails, and paste the failure output into the journal:

```markdown
### Red phase (<ISO timestamp>)
Test: <path>::<name>
Command: <exact invocation>
Output:
```
<verbatim failure output>
```
Confirms: the bug reproduces at the test-harness level, not only in the manual repro.
```

Run tests through `run_command` with the repo's own runner (from `AGENTS.md` or the package scripts).

### 2. Green — the minimum change

Make the test pass with the smallest change that fully fixes the observed mechanism.

A diff larger than about 30 lines, when you are not refactoring, is a signal: either you are fixing more than the bug, or the root cause was deeper than you confirmed. Return to Phase 6. Signs of over-fixing:

- adding "just in case" null checks or try/except around other code;
- refactoring adjacent functions because "while I am here";
- adding configuration options the bug did not require;
- introducing new abstractions to "make this cleaner".

Resist each one. Fix the bug, note the surrounding issues for follow-up, move on.

### 3. Refactor — only after green

Clean up only what directly relates to the fix. Leave the re-architecture alone. When the code around the fix is rough, note it in the journal as a follow-up for the user. Refactoring during a bugfix is how a one-line fix turns into a hundred-line diff nobody can review.

### 4. Regression — the full suite green

Run the full test suite for the affected package, not only the new test. The existing tests still pass. When one breaks, the "fix" broke something else: return to Phase 6 with the new failure as evidence. Often it means the mechanism you fixed was load-bearing for a path you had not seen, and the broken test points at a better understanding of the system.

### Update the journal

```markdown
### Green phase (<ISO timestamp>)
Fix: <file:line> — <two-line description of the change>
Test: <path>::<name> now passes
Full suite: <N tests, M failures — should be 0>
```

---

## The red-green discipline, in one line

With no red test, you have proof the fix leaves existing tests passing and no proof it addresses the reported bug. A test written *after* the fix may still pass with the fix reverted; then it locks something else. Always verify the test fails without the fix and passes with it, and keep both outputs in the journal.
