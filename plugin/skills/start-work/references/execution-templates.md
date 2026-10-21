# Execution templates

Open this when starting a run, resuming one, writing a claim for the verifier, amending a plan or closing out. The rules live in `SKILL.md`; these are the shapes that keep receipts comparable between conversations. Every ledger example matches what the hooks and the resume logic read.

## pin.txt

Written once at admission to `.litgravity/evidence/<slug>/pin.txt`:

```text
plan: plans/<slug>.md
plan_revision: <git hash-object plans/<slug>.md, or size and mtime>
status_header: approved
branch: <git branch --show-current>
head: <git rev-parse --short HEAD>
dirty_paths_to_leave_alone:
  - <path from git status --short, or "none">
approvals_granted: <none | commit for rows 3-5 (user, date)>
approvals_withheld: commit, push, publish, version bump
first_row: <N. title>
conversation: <conversation id from the activation note>
```

## Row packet

Written to `.litgravity/evidence/<slug>/task-N-packet.md` before the row starts:

```text
TASK: <row number and title, quoted from the plan>
SCOPE: <the Files line, plus the explicit non-goals from Must NOT have>
PIN: <the behavior that must stay unchanged: a characterization test or command>
RED: <the failing proof: test name and the assertion it adds>
GREEN: <the minimal change and the targeted command>
SURFACE: <the QA scenario: tool, steps with literal inputs, binary expected result, artifact path>
ADVERSARIAL: <classes whose trigger holds, with how each is probed>
CLEANUP: <resources the row will create and the receipt that proves removal>
TIER: LIGHT | HEAVY, with the fact that decided it
```

## Resume checklist

Run in order before touching a file after a compaction, a restart or a handoff.

1. `read_file` the plan, then `node "<skill-folder>/scripts/next-row.mjs" plans/<slug>.md` for counts and the next row.
2. Read the ledger tail and the last `evidence` lines; list `.litgravity/evidence/<slug>/`.
3. `git status --short` and `git log --oneline -5`, compared with `pin.txt`.
4. For every ticked row: its `evidence` line exists and its files exist. A row that fails this gets reopened.
5. Look for a trailing `BLOCKED`, `PAUSED` or `CANCELLED` ledger note and read what it waits for.
6. Rerun the narrow gate for the next row's area to see whether earlier green results still hold.
7. Continue at the first open row whose dependencies are ticked.

## Ledger lines

```json
{"ts":"2026-10-20T03:00:00Z","kind":"decision","text":"row 3 tier=HEAVY: touches auth/session handling","path":"plans/<slug>.md"}
{"ts":"2026-10-20T03:20:00Z","kind":"evidence","text":"row 3 ticked: red/green/accept/doneclaim/cleanup","path":".litgravity/evidence/<slug>/task-3-green.log"}
{"ts":"2026-10-20T03:21:00Z","kind":"note","text":"cleanup: killed 12345; removed /tmp/lit.aB12cD; port 8080 free","path":".litgravity/evidence/<slug>/task-3-accept.log"}
{"ts":"2026-10-20T03:40:00Z","kind":"note","text":"BLOCKED at row 4: needs approval to install pytest","path":"plans/<slug>.md"}
```

`node "<skill-folder>/scripts/ledger-append.mjs" --conversation <id> --kind note --text "…" --path plans/<slug>.md` writes the same line with safe quoting.

## DoneClaim for the verifier

Saved as `task-N-doneclaim.json`. Keep it small and make every line checkable.

```json
{
  "DoneClaim": {
    "task": "3. Refuse targets outside the install root",
    "tier": "HEAVY",
    "changed_files": ["lib/install.mjs", "test/install.test.mjs"],
    "tests": ["node --test test/install.test.mjs -> 14 pass, 0 fail (task-3-green.log)"],
    "red": "task-3-red.log: AssertionError at install.test.mjs:88 'expected exit 2, got 0'",
    "manual_qa": [".litgravity/evidence/<slug>/task-3-accept.log"],
    "adversarial": {
      "malformed_input": "probed: symlink and ../ targets (task-3-accept.log#4)",
      "stale_state": "probed: rerun over a half-installed tree",
      "dirty_worktree": "n/a: row touches only new files",
      "misleading_success": "probed: exit code and file listing checked, not the summary line"
    },
    "cleanup": ["removed /tmp/lit.k3Jd9; no process left"],
    "risks": ["none"]
  }
}
```

The verifier answers in `task-N-verify.md`:

```text
verdict: confirmed | false-positive | needs-fix | needs-human-review
confidence: HIGH | MEDIUM | LOW
evidence: <paths read and what they showed>
repro: <exact command or steps, when a probe should be repeated>
probes_requested: <commands the parent or qa-runner should run, or none>
```

## Amendment entry

Appended under `## Amendments` at the end of the plan after the user approves:

```markdown
## Amendments
- 2026-10-20 row 4 - Files line gains `lib/paths.mjs`; the helper had to move out of `install.mjs`. Approved by the user in this conversation. Ledger decision logged.
- 2026-10-20 row 6 (added) - Document the new refusal in the README. Depends on 4. Added after row 5 because the behavior was missing from the plan.
- 2026-10-20 row 7 - dropped by amendment: superseded by row 4. Row stays in the plan, ticked.
```

## Final receipt (final-receipt.md)

```text
plan: plans/<slug>.md  (PLAN_COMPLETE_PASS)
rows: N of N ticked; F1-F4 ticked
changed files by surface: source ... / tests ... / docs ... / manifests ...
measured results: <number> by <command and counting rule>
verification: <command> -> <status and decisive line>   (one line per gate)
surface probe: <what the user-facing path showed>
adversarial classes: <class>: <outcome>   (n/a classes carry a reason)
review gate: review-work work mode -> REVIEW PASSED (goal/qa/quality/security/context PASS); report path
hypothesis audit: <three or more hypotheses, each ruled out or confirmed, with the check>
cleanup: <processes, ports, worktrees, temp paths; how absence was verified>
release-neutral receipt: no commit, push, tag, version bump or publish happened (or the approved ones, listed)
remaining risks: <each tied to a missing command or unverified environment, or "none observed">
```

## Pause note examples

```text
PAUSED at row 5: the next command installs a dependency; waiting for the user's approval of the network call
BLOCKED at row 2: baseline suite is red before any change (14 failures, see baseline.log); user decision needed
CANCELLED: the user stopped the run after row 3; rows 1-3 ticked, row 4 open, worktree removed
```
