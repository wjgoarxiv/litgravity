# Worked reviews

Two complete examples show the artifacts a review leaves and how the verdict words follow from the lane results. Names and numbers are invented.

## Example 1: plan review that returns ITERATE

Request: `lit review` right after `lit-plan` wrote `plans/csv-export.md`.

**Mode pick.** Rule 2 resolves one plan. Rule 3 finds 0 of 6 rows ticked, rule 4 finds no `task-*` files and a clean `git status --short`, so rule 5 applies. First report line: `Mode: plan review (auto: plans/csv-export.md has 0 of 6 rows ticked, no task evidence, no product diff)`. Ledger: `{"kind":"decision","text":"review-work mode=plan source=auto reason=0/6 ticked, no diff outside plans/","path":"plans/csv-export.md"}`.

**Identity.** `context.txt` records the plan's size and mtime, the intent (the user's request plus `.litgravity/interview/csv-export-spec.md`), the base commit, and the release boundary (none granted).

**Structure check.** `PLAN_STRUCTURE_PASS plans/csv-export.md rows=6 final=4 status="approved"`.

**Dimension table.**

| Dimension | Result | Evidence |
| --- | --- | --- |
| Scope | PASS | one objective in the TL;DR; Scope Out names the PDF export |
| Achievability | PASS | rows 1 to 5 plus the CLI probe establish the export |
| Decision completeness | FAIL | Decisions never settle the column order; row 3 says "as appropriate" |
| Row atomicity | PASS | each row has one output and one check |
| Acceptance and evidence | FAIL | row 4 Acceptance reads "export works" |
| Guardrails | PASS | Must NOT have names version bumps, commits and the JSON export |
| QA scenarios | PASS | row 5 names `node bin/tool.mjs export --csv`, literal inputs, expected exit 0 and header line |
| Order, failure, cleanup | PASS | DAG is valid; row 5 deletes its temp folder with a receipt |

**Row map.** Rows 1, 2, 5 and 6 are STARTABLE. Row 3 is not (the column order is undecided). Row 4 is not (its acceptance cannot fail).

**Verdict.**

```text
Mode: plan review (auto: 0 of 6 rows ticked, no task evidence, no product diff)
Verdict: ITERATE (2 findings)

MAJOR plans/csv-export.md Decisions - column order is open; row 3 says "as appropriate". Record the order (id, date, amount) with the reason that two scripts read by position.
MAJOR plans/csv-export.md row 4 - Acceptance "export works" restates the title; use `node --test test/export.test.mjs` passes and prints the new case `keeps column order`.

Smallest repairs: one Decisions line, one Acceptance edit. Structure and the other decisions stay as written.
```

The reply ends with the next step in one line: revise the plan with `lit plan`, or say go-ahead and the reviewer edits only those two places and logs them under `## Amendments`.

## Example 2: work review that returns REVIEW FAILED

Request: `lit review work` after `start-work` ticked its last row.

**Mode and identity.** Forced mode, `source=forced`. `context.txt` holds the diff range `main...HEAD`, head and base hashes, the plan as intent, the goal record criteria `c1` to `c3`, the dirty paths that existed before the work (`notes.txt`, untouched) and the release boundary.

**Packet.** `files.txt` lists 7 files, `diff.patch` is 412 lines, `commits.txt` has 3 commits. The run command is `npm test` from the manifest.

**Lanes.** Five briefs start in one turn with `invoke_subagent`: `lit-verifier` for goal, `qa-runner` for qa and context, `quality-reviewer` for quality and security (with the security brief). The parent keeps reading the diff while the lanes work, and each lane message is saved the moment it arrives as `lane-N-<name>.md`.

| Lane | Verdict | Key result |
| --- | --- | --- |
| goal | PASS | G1 to G4 ACHIEVED; no extra hunks; the file set equals the plan's Files lines |
| qa | FAIL | P0 scenario 7 fails: `tool export ../out.csv` writes outside the export root |
| quality | PASS | one MINOR: a helper name is misleading |
| security | PASS | trust boundaries listed; the traversal is reported by lane 2 with the same anchor |
| context | PASS | an earlier commit introduced the root check that this change bypasses; noted for the report |

**Assemble.** The traversal appears in two lanes; the parent keeps the most specific anchor (`lib/export.mjs:88`) and raises the severity to BLOCKER. Since security passed while lane 2 found an exploitable path, the parent rereads the security lane's trace, finds it never tried a relative target, and downgrades that lane to BLOCKED with the limitation "no relative-path probe". The aggregate is `REVIEW FAILED` because one lane FAILs.

**review.json check.** `node "<skill-folder>/scripts/check-lanes.mjs" .litgravity/evidence/csv-export/review/review.json` prints `REVIEW FAILED lanes=5 findings=2`.

**Reply.**

```text
Mode: work review (forced)
Verdict: REVIEW FAILED (goal PASS, qa FAIL, quality PASS, security BLOCKED, context PASS)

BLOCKER lib/export.mjs:88 - a relative target such as `../out.csv` is joined without normalization and the file lands outside the export root.
MINOR   lib/export.mjs:12 - `fmt` returns a string and reads like a formatter object.

Required action: fix the BLOCKER, then rerun lanes 2 and 4. The earlier root check from commit 3f9a1c2 shows the intended behavior.
```

Cleanup receipt: the qa lane's temp folder and tmux session are removed (`ls` and `tmux ls` confirm). Release-neutral receipt: no commit, push, tag, version bump or publish happened.

## What the two examples share

- The mode line comes first and names its reason.
- Every finding has a `path:line` or a plan section, a trigger, expected against actual, and the smallest repair.
- A PASS comes with evidence, and a lane that cannot show its probes is BLOCKED.
- The reviewer edits nothing under the product tree and leaves the choice of fixes to the user.
