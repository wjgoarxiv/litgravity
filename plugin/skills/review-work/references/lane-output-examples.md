# Lane output examples

Sample lane messages in the fixed schema. Use them to calibrate how much evidence a verdict needs and how a BLOCKED lane reads. Names and numbers are invented.

## A PASS lane (quality)

```text
verdict: PASS
confidence: MEDIUM
summary: The change follows the module's existing error style, adds a test per new branch and leaves the public exports alone. One naming nit remains.
findings:
  - [MINOR] naming - lib/export.mjs:12 - `fmt` returns a string and reads like a formatter object - rename to `formatRow`
blocking_issues: none
```

Why it passes: every claim points at a line the lane read, the one finding is MINOR, and the summary says what the lane checked. A PASS with an empty summary or no anchors goes back for evidence.

## A FAIL lane (qa)

```text
verdict: FAIL
confidence: HIGH
summary: P0 scenario 7 (relative target) writes outside the export root. Eleven other scenarios pass.
findings:
  - [BLOCKER] behavior - lib/export.mjs:88 - expected exit 2 for `export ../out.csv`, actual exit 0 and a file one folder above the root (lane-2-qa/07-relative.txt) - normalize the target and refuse paths outside the root
  - [MAJOR] coverage - test/export.test.mjs - no case feeds a relative target - add one asserting exit 2 and no file written
blocking_issues: the two findings above
scenarios: total 24, P0 pass 9 fail 1, P1 pass 10 fail 0, P2 pass 4 fail 0
cleanup: killed 4412 (kill -0 fails); removed /tmp/lit-qa-export (test ! -e); no ports used
```

Why it fails: a P0 scenario failed with a transcript behind it. The lane also reports the missing test as MAJOR, which keeps the retest honest.

## A BLOCKED lane (security)

```text
verdict: BLOCKED
confidence: LOW
summary: Input validation, path handling and trust boundaries were traced. The dependency review could not run.
findings: none
limitations:
  - dependency audit needs a network call and the call was refused; the lockfile diff shows two new packages (`left-pad-lite@1.0.2`, `tiny-glob@0.2.9`) that no one has reviewed
blocking_issues: none, pending the dependency review
```

Why it is BLOCKED and not PASS: a category the change touches (new dependencies) went unexamined. The smallest next probe is named, so the parent can ask for approval and rerun only this lane.

## A context lane with precedent

```text
verdict: PASS
confidence: MEDIUM
summary: History explains the root check the change builds on; callers and docs match the new behavior.
precedent:
  - 3f9a1c2 "refuse targets outside the export root" introduced the guard this change extends
missed_callers: none (rg found two importers, both updated)
docs_drift: none
findings: none
```

## Aggregation walkthrough

| Lane | Verdict | Notes |
| --- | --- | --- |
| goal | PASS | file set equals the plan's Files lines |
| qa | FAIL | the BLOCKER above |
| quality | PASS | one MINOR |
| security | BLOCKED | dependency review missing |
| context | PASS | precedent found |

Rule 1 applies first: any FAIL gives `REVIEW FAILED`. The BLOCKED security lane stays in the report as a limitation to clear on the re-review, since a fix to the qa finding will rerun lanes 2 and 4 anyway.

## Writing findings that survive a re-read

- Name the trigger in the finding itself ("`export ../out.csv`"), so the author can reproduce it without opening the lane file.
- State expected against actual in one sentence each.
- End with the smallest fix direction, never a redesign.
- Keep the evidence path in the finding (`lane-2-qa/07-relative.txt`), so the report links to proof.
- Anchor to a `path:line` the lane read in this review. A line number from memory goes stale.
