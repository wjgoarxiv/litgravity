---
name: litgoal
description: "Set, check or close a durable goal in .litgravity/goals with criteria, status and evidence. Use when work must outlive this conversation."
---

# litgoal

litgoal SETS the goal and KEEPS the finish line; `lit-loop` and `start-work` RUN toward it. The goal record is the one file that tells any later conversation what was promised, what is proven and what is stuck, and this skill owns its schema and every operation on it. It mirrors the objective to the host's goal tool when one is offered, and it closes a goal only with a verdict backed by evidence on disk.

Binding and judging live here. Implementation, test runs and evidence capture live in the running route. If you catch yourself writing production code under this skill, the goal is already set: hand the work to `lit-loop`.

## When this applies

- A user asks to set, track, check, list, steer or close a goal: `lit goal …`, `/litgravity:litgoal`, "make this a goal", "is X actually done?".
- Another LitGravity route (`lit-loop`, `litwork`, `start-work`, or `lit-plan` through its Goal block) needs a record created or updated; those routes follow the rules here.
- A conversation resumes and has to learn what is still open, or the work must outlive this conversation, a compaction or a handoff to another agent.
- Someone asks for a verdict on an objective and the answer has to come from evidence.

Skip the record for a bounded task that finishes inside one conversation: `lit-loop`'s scope gate decides that, and a short checklist is enough.

## Inputs and state

- `.litgravity/goals/<slug>.json`: one file per goal. Whole-file writes only, by the parent conversation; children never edit it.
- `.litgravity/evidence/<slug>/`: artifacts the evidence links point at.
- `.litgravity/ledger/<conversation-id>.jsonl`: append `{"ts","kind","text","path"}` lines; `kind` is `note`, `evidence` or `decision`.
- Conversation id and ledger path: given in the activation note. If you no longer hold the id, it is the file stem of the newest `.litgravity/ledger/*.jsonl`.
- The brief: the user's words, a spec in `.litgravity/interview/<slug>-spec.md`, or the Goal block of an approved `plans/<slug>.md`.
- Supporting files, read with `read_file` from this skill's folder:
  - `templates/goal.json`: the record skeleton.
  - `scripts/check-goal.mjs`: validates a record and tests its evidence on disk (`node "<skill-folder>/scripts/check-goal.mjs" .litgravity/goals/<slug>.json [--json]`; it writes nothing).
  - `references/host-goal-binding.md`: the binding table for the host's goal tool, with the degraded path.
  - `references/close-gate.md`: the final quality gate for a `met` verdict and the shape of the closing reply.

### Schema

```json
{
  "slug": "csv-export-flag",
  "objective": "Users can export the report table as CSV from the CLI",
  "non_goals": ["no change to the JSON export"],
  "criteria": [
    {
      "id": "c1",
      "text": "`report export --csv out.csv` exits 0 and line 1 of out.csv equals the table header",
      "status": "pass",
      "attempt": 1,
      "model": "happy",
      "channel": "shell",
      "evidence": [
        ".litgravity/evidence/csv-export-flag/c1-green.log",
        ".litgravity/evidence/csv-export-flag/c1-surface.log"
      ]
    },
    {
      "id": "c2",
      "text": "CSV writer unit tests cover quoting of commas and newlines",
      "status": "open",
      "attempt": 1,
      "model": "edge",
      "channel": "shell",
      "evidence": []
    }
  ],
  "status": "active",
  "conversation_id": "<conversation id from the activation note>",
  "host_goal": { "state": "created", "synced": "2026-10-20T09:14:00Z" },
  "steering": [],
  "blockers": [],
  "verdict": null,
  "updated": "2026-10-20T09:14:00Z"
}
```

Field rules:

- `slug`: lowercase kebab-case, at most 40 characters, equal to the file name stem.
- `objective`: one outcome-shaped sentence, true for a user when the work is done, free of implementation detail.
- `non_goals`: exclusions the user stated or agreed to.
- `criteria[].id`: `c1`, `c2`, … assigned once and stable forever. A new criterion takes the next free number; a removed one leaves a gap.
- `criteria[].text`: checkable by a command or an observation on a real surface; it carries the scenario, the surface and the single binary observable that decides pass or fail.
- `criteria[].status`: `open`, `pass`, `fail` or `blocked`.
- `criteria[].attempt`: starts at 1. A criterion that returns from `fail` or `blocked` to `open` bumps it, and new artifacts take an `-a<attempt>` suffix from attempt 2 on (`c1-a2-green.log`). Earlier artifacts stay for audit; only evidence of the current attempt satisfies a close.
- `criteria[].model`: `happy`, `edge`, `regression` or `adversarial`.
- `criteria[].channel`: the real-surface channel: `shell`, `http`, `terminal`, `browser`, `agy` or `other`.
- `criteria[].evidence`: repo-relative paths (usually under `.litgravity/evidence/<slug>/`) or ledger references written as `ledger:<conversation-id>#<line>`. The file name carries the kind: `-red`, `-green`, `-surface`, `-cleanup`.
- `status`: `active`, `review_blocked` (an open blocker whose source is `review`), `needs_user_decision`, `blocked`, `done` or `dropped`.
- `conversation_id`: the conversation that owns the Stop hold (see below).
- `host_goal.state`: `created`, `adopted`, `conflict`, `unavailable` or `closed`; `synced` is the last time the host goal was touched.
- `steering[]`: `{kind, directive, evidence, rationale, at}` entries.
- `blockers[]`: `{id, source, detail, resolved}`; source is `qa`, `review` or `user`.
- `verdict`: `null` while open; on close `{"result": "met" | "not met", "failing_criterion": "c2" | null, "reason": "...", "at": "<UTC ISO-8601>"}`.
- `updated`: UTC ISO-8601, refreshed on every write.

Older records without the optional fields stay valid; read the missing ones as `attempt: 1`, empty arrays and `host_goal.state: "unavailable"`.

## Procedure

### set (create)

1. **Restate the objective as ONE crisp goal.** Write what is TRUE for the user when this is done, not the steps to get there. Strip process narration and name the deliverable. If the request bundles several outcomes, bind the one the user asks for now. If two readings would produce different criteria, ask one sharp question with `ask_question` (or write `BLOCKED: <question>` when nobody can answer) before binding, because a vague objective binds a vague loop.
2. **Derive the slug.** If `.litgravity/goals/<slug>.json` exists, switch to **update** and tell the user. Search `.litgravity/goals/` for the objective text first, since two slugs for one objective split the evidence.
3. **Name the criteria.** Pick the smallest set that, all passing, makes the objective unarguably met: usually two to six, covering the happy path, the riskiest edge, an adjacent regression and, for security, migration, concurrency or external integrations, an adversarial case. Each criterion carries three concrete parts:
   - **Scenario**: the literal command, page action or payload with concrete inputs (`curl -i …`, a request body, a CLI invocation), never "run it" or "check it works".
   - **Real surface**: the actual surface a user touches (the live endpoint, the rendered page, the CLI stdout, the database row, the agy conversation).
   - **Evidence**: the single binary observable that decides PASS or FAIL on that surface (the status line plus body, the exact stdout line, a screenshot of the rendered state).

   A criterion whose only evidence is a green unit suite is incomplete; tests are the floor and the real-surface artifact is what closes it. Replace vague words ("fast", "clean", "robust") with a measurable check, and do not invent criteria for impossible inputs.
4. **Pick the channel and the adversarial classes** per criterion: malformed input, prompt injection, cancel and resume, stale state, dirty worktree, hung or long commands, flaky tests, misleading success output, repeated interruptions. Record a one-line reason in the ledger for each class that does not apply.
5. **Write the file** with `write_file`: every criterion `open`, goal `active`, `conversation_id` set, `verdict: null`.
6. **Validate**: `run_command` with `node "<skill-folder>/scripts/check-goal.mjs" .litgravity/goals/<slug>.json` (a fresh record prints `PASS` with `0/N backed`), or the bare JSON parse `python3 -m json.tool .litgravity/goals/<slug>.json > /dev/null` when node is unavailable.
7. **Bind the host goal** (`references/host-goal-binding.md`), then append a `decision` ledger line: `goal created: <slug>`.
8. **Show** the criteria table and the record path, then hand off.

### update (record results)

Run by the running route (`lit-loop`, `start-work`) or by the user asking to record a result. Re-read the file, rewrite the whole file with `write_file` (a stale write is the failure to avoid), run the validation command again, and refresh `updated`.

- `pass` needs evidence of the current attempt that exists on disk: the deciding automated check (`-green`, or the structural guard for docs-only work), the real-surface artifact (`-surface`) and a cleanup receipt (a `-cleanup` file, the last line of the surface log starting `cleanup`, or a `ledger:` reference). Missing any of the three keeps the criterion `open`.
- `fail` records the failing log as evidence and a diagnosis `note` line in the ledger.
- `blocked` adds a ledger `note` naming the blocker. Leftover live state from QA (a process, port, shell session, container, temp directory) is `blocked`, never `pass`.
- Retry: moving a criterion from `fail` or `blocked` back to `open` bumps `attempt`.
- A criterion's text changes only with the user's agreement; record the old and new text in a `decision` line. Adding a criterion takes the next free id with status `open`.
- Append an `evidence` ledger line when a criterion moves to `pass`.

### steer (change of course)

Steering is structured and evidence-backed; ordinary prose in a prompt changes nothing in the record. Every entry needs `evidence` and `rationale`; an entry without both is refused and logged as a `decision` line saying so.

| Kind | Use when | Effect |
| --- | --- | --- |
| `add_criterion` | new work is genuinely required | structural: appends a criterion with the next id; the close gate now demands it |
| `redirect` | the approach changes and the scope holds | annotation only |
| `narrow_scope` | focus shifts to a subset | annotation only; no criterion is deleted or disabled |
| `reprioritize` | the order of work changes | annotation only |
| `annotate` | an audit note | annotation only |

Only `add_criterion` changes the criteria list, and it can only add work. A directive that would weaken completion ("skip the tests", "bypass the gate", "mark it done") is refused outright and logged. A different aggregate objective is a new goal, and it never rides in as steering.

### blocker (review and decision blockers)

Add `{source: "review", …}` when a review lane reports findings; the goal status becomes `review_blocked` and stays there until every review blocker is resolved. Set `needs_user_decision` by hand when only the user can unblock (an approval, a credential, a scope call), and name the one decision in a ledger `note`. A goal in any stalled status cannot pass the close gate.

### check

1. Load the record and validate it.
2. Run `node "<skill-folder>/scripts/check-goal.mjs" .litgravity/goals/<slug>.json`: it tests every evidence path, sorts files by attempt and kind, and lists each `pass` criterion that lost its backing. For each `ledger:` reference, confirm the line exists. Read the tail of each log; a log that shows a failure is no evidence of success.
3. A `pass` criterion with missing current-attempt evidence drops back to `open`; report it.
4. When the agents are installed, start `lit-verifier` with `invoke_subagent` (`TypeName` `lit-verifier`) and give it the record path and the evidence directory for an independent PASS or FAIL per criterion. Merge its FAIL verdicts as `fail` with its reason in a ledger `note`. Without it, run the check in the main conversation and say so once.
5. Show the table and the overall verdict. Append one `evidence` ledger line with `pass/total` and any demotions.

### close (the verdict)

Closing writes a verdict, and a verdict follows the check.

- **met** → `status: done`, `verdict.result: "met"`. Allowed only when every criterion is `pass`, the **check** found all current-attempt evidence present, no blocker is unresolved, and the final quality gate in `references/close-gate.md` holds for a multi-criterion goal.
- **not met** → `status: blocked` (or `needs_user_decision`), `verdict.result: "not met"`, `failing_criterion` set to the first criterion that is not `pass`, and `reason` naming why in one line. Keep the open criteria listed.
- **dropped** → only on the user's explicit word; record their reason as a `decision` line and set `status: dropped`.

After the file is written, close the host goal as the binding table says, and append a `decision` ledger line with the verdict.

### show and list

- `show <slug>`: print the criteria table below with the verdict line.
- `list`: one line per file in `.litgravity/goals/` with slug, status, `pass/total` and `updated`, newest first.

| id | criterion | status | evidence |
| --- | --- | --- | --- |
| c1 | `report export --csv` writes header line | pass | `c1-surface.log` |
| c2 | CSV writer quoting tests | open | — |

Shorten evidence to the file name in the table; the full paths live in the record.

### Hand off to the running route

Once the record is written and shown, say plainly that the goal is captured and that `lit-loop` (or `start-work` for an approved plan) runs it: the objective, the criteria with scenario, surface and evidence, and the record path. Then stop. The running route owns RED, GREEN, SURFACE, CLEAN and RECORD per criterion, and calls back here for the results.

What the running route follows:

- Cap a goal at five work cycles and at three identical failures on one criterion. Past either cap, set `blocked` with the diagnosis and report; looping further wastes the user's quota.
- The acquire rule: no active goal → set; the same objective active → continue it; a different objective active → stop, record a `blocker`, and show the conflict.
- Evidence is observable from the real surface (shell transcript, status plus body, browser action log with a screenshot, parsed config dump, database diff). `--dry-run`, "should respond" and "looks correct" never count.

### Recover (resume)

1. Read the handoff under `.litgravity/handoff/` and the ledger tail when they exist.
2. `list`, then `show <slug>`; run **check** so stale passes are demoted.
3. Reproduce the latest blocker or verify the latest pass before continuing, then continue from the first `open`, `fail` or `blocked` criterion.
4. A corrupt record: capture the parse error, keep the broken file as `<slug>.json.bad`, and rebuild from the ledger and the evidence directory with a `decision` line. A second record for the same objective, created because the old one is inconvenient, splits the history.

### The Stop-hook hold

The Stop hook reads goal records while the active route is a work route (`lit-loop`, `start-work` or `litgoal`). A record belongs to the stopping conversation when the hooks saw that conversation write or read it, or when its `conversation_id` names the conversation.

- Hold while `status` is `active`, at least one criterion is `open` or `fail`, and the record sets no `hold: false`. The reason names the record path, `pass/total` and the first open criterion with its id and text. A `blocked` criterion never holds: record the obstacle and the next Stop passes.
- Hold at most once per turn, and at most 3 times in a row without progress (progress is a changed `updated` or a changed pass count); after the third the turn ends and the ledger says so. Only a normal end of turn is held. `LITGRAVITY_GOAL_HOLD=0` is the environment kill switch.
- Release when the record is `done`, `dropped`, `blocked` or `needs_user_decision`, when no record matches the conversation, when the route is not a work route, or when the ledger's last note starts with `BLOCKED at row N:`, `PAUSED at row N:` or `CANCELLED:`.
- The hold counter lives in hook state outside the workspace; the record never carries it.

When a hold arrives, treat the named criterion as the next piece of work, or close the record honestly (`blocked` with the obstacle) so the next Stop passes.

## agy tools

- `read_file` (older builds: `view_file`) and `rg` through `run_command` to load records and find evidence.
- `write_file` (older builds: `write_to_file`) for whole-record writes; the goal directory is workspace state.
- `run_command` for JSON validation and `test -e` checks, both offline. Headless runs auto-deny `run_command` unless agy runs in a permissive mode: then write the record by hand, say validation could not run, and keep the `BLOCKED` note short.
- A host goal tool, when offered, is used as the binding reference describes; otherwise the record stands alone.
- `invoke_subagent` with `lit-verifier` (and `quality-reviewer` for the gate) when the agents are installed.
- `ask_question` to confirm a criterion text change, a `dropped` close, a host-goal replacement or an ambiguous objective; where nobody can answer, write the question into the reply and stop with BLOCKED.

## Evidence

- The record is evidence of intent; the files it links are evidence of results.
- Every operation leaves a ledger line: `decision` for create, text change, steering refusal, host-goal conflict and close; `evidence` for a criterion moving to `pass` and for each **check**; `note` for blocks, demotions and cleanup facts.
- After **check**, one `evidence` line carries `pass/total` and any demotions.
- A close leaves the verdict in the record and the same line in the ledger.

## Stop and report

- set / update: reply with the criteria table, the host binding state and the record path.
- check: first line `PASS` (all criteria pass with evidence present), `FAIL` (a criterion failed or lost its evidence) or `BLOCKED: <reason>`; then the table; then the one action that would move the goal forward.
- close: the verdict (`met`, or `not met` with the failing criterion) and the reason in one line.
- Stop the moment the goal is bound and confirmed: the objective is one line, every criterion names its scenario, surface and observable, and the file validated. Safety boundaries (a destructive command, secret exposure, a production write, an unapproved publish) and missing external access become a blocker and a report.

Keep the reply short; the record holds the detail, and the evidence files hold the proof.

## Criteria patterns by task shape

A criterion is only as good as the observable that decides it. These shapes recur; adapt the wording, keep the structure of scenario, surface and one binary observable.

| Task shape | Criterion that works | Channel |
| --- | --- | --- |
| new CLI flag | "`tool export --csv out.csv` exits 0 and line 1 of `out.csv` equals the table header" | `shell` |
| HTTP endpoint | "`curl -i -X POST /v1/items` with an empty body returns `400` and a JSON error naming the missing field" | `http` |
| bug fix | "the saved reproduction `repro.sh` exited 1 before the fix and exits 0 after, and the new regression test fails on the old code" | `shell` |
| refactor | "the characterization suite recorded before the change passes unchanged, and the public exports listed in `api.txt` still match" | `shell` |
| interface change | "`/settings` rendered at 390 px and 1280 px shows the new toggle with no horizontal scroll (two screenshots)" | `browser` |
| installer or packaging | "`npx tool install --dry-run` writes nothing, and the install into a temporary HOME leaves only the listed files" | `shell` |
| hook or policy | "the hook fed `fixtures/injected-prompt.json` answers `{}` and leaves the ledger without a route line" | `shell` |
| document or deck | "the rendered PDF has 12 pages, no overflow warning, and the check script prints PASS" | `other` |
| research question | "the synthesis cites at least three primary sources, each URL opened, and states what is disputed" | `other` |

Two criteria that fail together belong in one criterion; one criterion that needs two different surfaces belongs in two. If a criterion cannot name its observable in one sentence, the objective is still too vague, and that is a reason to ask, not to guess.

## Worked example

The user types `lit goal ship the csv export`. The route is `litgoal`; the activation note supplies the conversation id `c0ffee`.

1. Objective: "Users can export the report table as CSV from the CLI". Slug `csv-export-flag`. No record exists, so this is **set**.
2. Criteria: `c1` happy path (the command above), `c2` edge (commas and newlines quoted), `c3` regression (the JSON export output is byte-identical to the stored fixture). The task touches no security surface, so no adversarial criterion; the ledger gets `decision: adversarial classes skipped: no untrusted input beyond table cells, covered by c2`.
3. `write_file` creates `.litgravity/goals/csv-export-flag.json` with every criterion `open`; `check-goal.mjs` prints `PASS csv-export-flag 0/3 backed, canClose=false`.
4. The host goal is bound or skipped as the binding table says, the reply shows the three-row table and the path, and the turn ends with "captured; `lit loop` runs it".
5. Later `lit-loop` finishes `c1`: `c1-red.log`, `c1-green.log`, `c1-surface.log` (last line `cleanup: removed out.csv`). It re-reads the record, sets `c1` to `pass`, lists the three paths and appends an `evidence` line.
6. **check** after `c2` finishes finds `c2-surface.log` missing, demotes `c2` to `open`, and the ledger says why. The Stop hook then names `c2` as the next piece of work.
7. When all three are backed, the final gate runs, `status` becomes `done`, `verdict.result` is `met`, and the reply is `PASS`, the path and the line "CSV export verified on the real CLI".

## Pitfalls

- Marking `pass` from a summary ("tests were green") with an empty evidence array, or with only a unit-test log.
- Renumbering ids after a removal, which breaks ledger and evidence references.
- Hand-editing a fragment of JSON and leaving a trailing comma; rewrite the whole file and validate.
- Absolute paths in evidence; keep them repo-relative so the record survives a move.
- Closing as `met` while a linked log shows a failure; read the tail of each log during **check**.
- Two goals for the same objective under different slugs; search first.
- Replacing a different active host goal without the user's word.
- Letting `host_goal.state` outrank the criteria.
- Writing the record from a child agent or from a stale read.
- Starting to implement under this skill; the running route does that.
