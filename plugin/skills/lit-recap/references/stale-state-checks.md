# lit-recap: stale-state checks

State on disk drifts. A goal record says `pass` after its evidence was cleaned up, a plan is fully checked while the goal still has open criteria, a handoff says "tree clean" two commits ago. The recap's job is to notice these before the user acts on them. Run each check below that applies, write each finding into the report, and leave every file as it is: correcting the record is the job of `litgoal`, `start-work` or `lit-handoff`.

## How a finding enters the report

| Severity | Where it goes | Effect on the verdict |
| --- | --- | --- |
| contradiction | the risk line and the first 블로커 entry | FAIL |
| claimed without evidence | the item moves from ✅ to 🔄 with "주장됨, 증거 없음" | FAIL when the claim is a `pass` criterion or a `done` goal |
| stale note | the item keeps its section with a "(오래됨: …)" suffix | none |
| unknown | the item carries `미검증` | none |

One sentence per finding, naming both sides: "goal `csv-export` is `done`, while `plans/csv-export.md` has rows 6 and 7 open".

## The checks

### C1. Pass without evidence

For every criterion at `pass`, every path in `evidence` must exist. A `ledger:<id>#<line>` reference must point at a real line of an existing ledger file. A missing path demotes the item to "claimed, evidence missing". An existing `-green.log` or `gates.log` whose last lines show a failure is a contradiction.

### C2. Attempt mismatch

A criterion with `attempt` 2 or more needs artifacts carrying `-a<attempt>`. Evidence from an earlier attempt alone means the current attempt is unproven.

### C3. Goal against plan

- Goal `done` and the matching plan has unchecked rows: contradiction.
- Plan fully checked and the goal has `open` or `fail` criteria: contradiction.
- Goal `active` with every criterion `pass` and no verdict: "ready for `litgoal check`", which is a next step.

Match goal and plan through the slug, or through a plan path named in the goal record or in a ledger line.

### C4. Handoff against git

- The handoff names a `Last commit` that `git log --oneline -n 50` lacks: stale (the branch moved or was rewritten).
- The handoff says the tree is clean and `git status --short` shows changes: stale; the changes go under "since the last handoff".
- The handoff names a branch other than the current one: stale, and the report names both branches.
- The handoff's `Written` stamp is older than the newest commit: list the newer commits as "since the last handoff".

### C5. Handoff against goals and plans

Each Next Step in the handoff that names a plan row or criterion is compared with the current row or criterion status. A step the record shows as done is reported as "already done since the handoff"; a step pointing at a missing file is stale.

### C6. Ledger against record

- A ledger `evidence` line says a criterion passed and the record still shows it `open`: the record lags; report it and point at `litgoal`.
- A release note (`BLOCKED at row N:`, `PAUSED at row N:`, `CANCELLED:`) is newer than every `evidence` and `decision` line: the work is paused or blocked; report the note.
- A `decision` line changed a criterion's text and the record shows the old text: contradiction.

### C7. Dirty tree ownership

Files in `git status --short` that no goal, plan or ledger `tool` line of this work mentions belong to someone else. List them as "unrelated changes present" so nobody commits or reverts them by accident.

### C8. Live work

- A process, port or server named in a ledger note as started and never stopped: check with `ps -p <pid>` when a pid was recorded. Alive means "still running"; gone without a cleanup receipt means "cleanup unverified".
- A child agent that was briefed and never reported: "assigned, no report".
- A long command this conversation started: read `command_status`; a timeout is unfinished work.

### C9. Age

- A handoff older than three days no longer gets the SessionStart pointer; report its age so the user knows a new conversation saw nothing.
- A goal whose `updated` is more than seven days old while its status is `active`: "dormant since <date>".

These thresholds are reporting aids. Age alone changes no verdict.

### C10. Release boundary

When a ledger note, handoff or conversation mentions a commit, tag, push, publish or version bump, confirm it with git (`git log`, `git tag --points-at HEAD`, `git status --branch` for ahead/behind). A claimed publish that git and the conversation cannot confirm is `미검증`. Registry checks need the network; leave them to the release route.

## When two sources disagree and no check above fits

State both readings in one line, name the more current source, and mark the item `미검증`. The user decides; the recap reports.
