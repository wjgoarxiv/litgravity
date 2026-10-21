# Plan review checklist

Read this before issuing a plan verdict. A plan review reads `plans/<slug>.md` the way an executor would and asks one question: where does the executor have to guess? A plan is a draft until execution starts. It carries no runtime evidence, the five work lanes stay out of scope, and no lane reports PASS for a probe that never ran.

## Admission

Confirm that the review can start before judging content.

1. The plan file exists, is the version the user means (record its size and mtime in `context.txt`), and stays unchanged by another conversation during the review. A changed hash mid-review restarts it.
2. The intent is known: the user's request, a spec at `.litgravity/interview/<slug>-spec.md`, or crucible findings at `.litgravity/evidence/<slug>/crucible.md`. A plan cannot be judged against an intent nobody can state.
3. The repository facts are readable: `AGENTS.md`, the manifest scripts, the test layout and the CI configuration.

When any of the three is missing, the verdict is `NEEDS-CONTEXT` with the smallest question that unblocks it.

## Shape check (the structure machines read)

`start-work`, the Stop hook and the resume logic read the plan by shape, so shape defects are real defects.

| Check | Expected | Defect when |
| --- | --- | --- |
| Status header | `Status: approved`, `awaiting approval` or `assumptions unconfirmed` | missing, unknown, or `approved` with no recorded user okay |
| Sections in order | TL;DR, Scope (Must have, Must NOT have), Bootstrap, Verification strategy, Execution strategy, Todos, Final verification wave, Commit strategy, Success criteria, DoneClaim | a section is absent or out of order |
| Task rows | `- [ ] N. <imperative title>` at column zero, numbers consecutive from 1 | indented rows, `1)` numbering, duplicate or skipped numbers |
| Row labels | What to do, Files, References, Tests, Acceptance, QA scenario, Depends on, Commit under each row | a label is missing, or Files names a directory instead of files |
| Final verifier rows | `- [ ] F1.` to `- [ ] F4.` after the last implementation row | absent, out of order or indented |
| Placeholders | none | a `fill:` marker remains |
| Verification strategy | exact gate commands with working directory, one real-surface probe, the Goal block | only "run the tests", or no real-surface line |
| Ticked rows | `- [x] N.` exist only for work that happened | rows ticked in a fresh draft |

`node "<skill-folder>/../lit-plan/scripts/check-plan.mjs" --check plans/<slug>.md` automates the structural half (exit 0 and `PLAN_STRUCTURE_PASS`). It judges shape only, so the eight dimensions below still apply to a plan that passes it. A `Status` other than `approved` is a finding only when the plan is about to run; for a plan still under discussion it is the expected state. Fenced examples and nested bullets are plain text, and a checkbox inside a fenced block is example text.

## The eight dimensions

Score each dimension PASS or FAIL with one line of evidence. Match pressure to risk: a reversible one-file change gets a light pass, and schema changes, security-sensitive work, irreversible state, migrations and release work get the full matrix. Padding a small plan with ceremony is a finding too.

### 1. Scope

- One bounded objective in the TL;DR, and a plan that finishes without absorbing a later phase.
- Scope Out lists the tempting adjacent work.
- Read-only and edit boundaries are explicit, and the paths the plan may touch are enumerated across the rows.

### 2. Achievability

- Completing every row and the Verification section establishes the stated objective. Discovery or qualification work stops short of claiming a production outcome.
- Material unknowns (an API's real behavior, a tool's availability, a data shape) are resolved in Context or gated by a first row whose acceptance resolves them.
- Host fit: the commands exist, the permissions are available, and a network call or credential is named as an approval point. For a plan that runs `agy -p`, the model-call budget is stated.

### 3. Decision completeness

- Every fork (library choice, file placement, flag name, migration order, backward compatibility) has a Decisions entry with a reason.
- Residue words are gone: "TBD", "maybe", "as appropriate", "or alternatively", "if needed", "etc.".
- New dependencies, public contract changes and migrations appear in Decisions and again in Must have or Must NOT have.
- A decision that belongs to the user is marked as an assumption to confirm, or the verdict is `NEEDS-CONTEXT`.

### 4. Row atomicity

- One row carries one action, one named output and one binary acceptance check.
- A row finishes as a reviewable unit and the repository is green after it.
- A row splits when its Files line spans unrelated modules, when it hides design work ("design and implement"), or when its acceptance is two checks joined by "and".
- Test-first order is possible: the Tests line names a test that fails before the change and the assertion it adds.
- Documentation and prose rows name a machine-read value (a parsed field, a scanned token, a validator) when a guard is wanted, or say honestly that review is the only gate.

### 5. Acceptance and evidence

- Each acceptance line is an observation, such as "`node --test test/x.test.mjs` passes and the new case `empty input` failed before the change". A restatement of the title ("feature works") is a defect.
- Every Must have maps to at least one row's acceptance. Unmapped Must haves are gaps.
- Evidence artifacts are named: logs under `.litgravity/evidence/<slug>/`, screenshots, transcripts.
- Negative controls exist where a wrong implementation could still pass (a mutation probe, a malformed input).
- Commands replay from the repository root, with the working directory stated when it differs.

### 6. Guardrails

- Must NOT have names the forbidden changes: dependency additions, public API changes, unrelated refactors, edits to protected files, local state committed.
- Commit, push, tag, version bump, publish and registry actions sit behind explicit approval, and the plan says who approves.
- Destructive probes run against scratch copies, with a before and after hash or status check that proves the live tree stayed intact.
- Untrusted text the work will read (issues, fetched pages, fixtures) is declared data in Must NOT have.

### 7. QA scenarios

For every scenario and the Verification probe, answer three questions. A NO needs one minimal repair.

1. Does it name a real tool that exists here (`curl`, `node`, `agy -p`, a browser driver, a test runner)?
2. Does it give executable steps with literal inputs (the URL, the payload, the keystrokes, the file names)?
3. Does it state a binary expected result (a status line, an exit code, a string in the output, a file field)?

"Run the endpoint", "open the page" and "check it works" fail all three. A scenario whose observable could pass on a broken implementation fails the third question.

### 8. Order, failure and cleanup

- `Depends on` lines form a DAG, and the numeric order is a valid execution order or a parallel set with disjoint Files.
- Failure branches exist for gates that can plausibly fail: what the executor does after a red baseline, a refused approval, a flaky test.
- Each scenario that starts a process, port, tmux session, browser, worktree, tarball or temp folder has a teardown step with a receipt.
- Irreversible rows (migration, deletion, external write) carry a rollback or a stop-and-ask point.

## Probing the plan's claims against the repository

Spot-check that files named in Files lines exist or carry a `(new)` mark, that the test commands exist in the manifest, that the skills, agents and routes the plan names exist, and that line numbers it cites still match. A plan built on a command that is missing from the repository has no way to execute.

## Proportionality

An over-built plan shows more checklist rows than decisions, evidence matrices that no decision uses, and full gate reruns after every row of trivial work. An under-built plan shows a migration with no rollback, a security change with no negative test, or a release row with no approval line. Both are findings.

## Row-by-row map

Produce this table in `plan-review.md`:

| Row | Title | Startable | Missing trigger or precondition | Smallest repair |
| --- | --- | --- | --- | --- |
| 1 | … | yes | | |
| 2 | … | no | Files names `lib/x.mjs`, which does not exist and has no `(new)` mark | mark it `(new)` or fix the path |

A row is STARTABLE when an executor can begin from its named inputs with no unresolved decision.

## Verdict templates

`PASS`:

```text
Verdict: PASS. Eight of eight dimensions hold. Every row is startable. Remaining uncertainty is gated by row 3's acceptance. The plan is unchanged.
```

`ITERATE`:

```text
Verdict: ITERATE (2 findings).
MAJOR plans/x.md row 4 - Acceptance "feature works" restates the title; use `curl -i localhost:8080/health` returns 200 with body `ok`.
MAJOR plans/x.md Verification - gates listed, no real-surface probe; add one that exercises the CLI.
Smallest repairs: edit row 4 Acceptance, add one Verification line. Valid structure and decisions stay as written.
```

`NEEDS-CONTEXT`:

```text
Verdict: NEEDS-CONTEXT. Decision 2 (keep the old config key or migrate it) changes rows 3 to 5 and the rollback plan. Question: should existing users keep the old key for one release?
```

## After the verdict

- `PASS` hands over to `start-work`, and the reviewer leaves the launch to the user.
- `ITERATE` repairs run in `lit-plan` (revise the file) or, with the user's go-ahead, as minimal edits recorded under `## Amendments`. Re-review afterwards with the earlier findings as the checklist.
- `NEEDS-CONTEXT` waits for the user.
- Record the verdict as a `decision` ledger line with the plan path and save `plan-review.md` under `.litgravity/evidence/<slug>/review/`.
