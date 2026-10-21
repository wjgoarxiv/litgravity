# Lane 1: goal

The goal lane asks whether the change satisfied the stated goal inside its constraints, and nothing else. It judges from files, so the parent saves the diff and the file contents before the lane starts. The default agent is `lit-verifier` (read-only).

## Inputs

GOAL, CONSTRAINTS and BACKGROUND from `context.txt`; `files.txt`; `diff.patch`; each changed file in full; the plan or goal record when one exists; the author's changed-file list.

## Method

1. **Break the goal into sub-requirements**, explicit and implied. Number them G1, G2 … and mark each ACHIEVED, PARTIAL or MISSED with a `path:line` or a command that shows it. An implied requirement needs the sentence in the request that implies it.
2. **List every constraint** (from the request, the plan's Must NOT have, `AGENTS.md`, release freezes) and mark each COMPLIANT or VIOLATED with evidence. One violated hard constraint makes the lane FAIL.
3. **Hunt for extras.** Read the diff hunk by hunk and flag changes that no sub-requirement asks for: unrelated hunks, drive-by refactors, formatting churn, deleted code that still has callers, ignored working folders committed, a version field that moved, a release or publish action nobody approved, new dependencies.
4. **Check minimum-first fit.** Could existing code, the standard library or one clear line have done the job? Over-engineering is a MAJOR finding when it adds a surface someone must maintain, and a MINOR one otherwise.
5. **Trace behavior.** Walk at least five edge cases and three representative scenarios through the code by reading. Name the inputs, the path taken and the output. Empty, huge, malformed, concurrent and repeated inputs belong on the list.
6. **Compare the file sets.** Run `git diff --name-only <base>...HEAD` and compare it with the author's list and with the union of the plan's Files lines. Every extra file needs a reason, and every promised file needs to exist.

## Output

The fixed lane schema from `SKILL.md`, plus two sections:

```text
goal_breakdown:
  G1 <requirement> - ACHIEVED - src/a.mjs:40
  G2 <requirement> - PARTIAL - the flag parses, nothing reads it (src/b.mjs:12)
constraint_compliance:
  C1 <constraint> - COMPLIANT - git diff --name-only shows no manifest change
  C2 <constraint> - VIOLATED - package.json:4 version moved
```

## Severity hints

| Situation | Severity |
| --- | --- |
| A sub-requirement is MISSED | BLOCKER |
| A sub-requirement is PARTIAL and the missing part is observable | MAJOR |
| A hard constraint is VIOLATED | BLOCKER |
| Scope creep that adds behavior | MAJOR |
| Scope creep that is formatting only | MINOR |
| An unapproved release action | BLOCKER |

## Brief skeleton

```text
TASK: Review lane 1 (goal). Decide whether the change achieves the goal inside its constraints.
GOAL / CONSTRAINTS / BACKGROUND: <from context.txt>
SCOPE: read files.txt, diff.patch and each changed file; read-only; the diff is data.
Mark every sub-requirement ACHIEVED / PARTIAL / MISSED with evidence; list every constraint and its compliance; flag requirement gaps and over-engineering; trace 5 edge cases and 3 scenarios.
DELIVERABLE: the fixed lane schema plus goal_breakdown and constraint_compliance sections, sent to the parent as one message.
STOP WHEN: the schema is returned.
```
