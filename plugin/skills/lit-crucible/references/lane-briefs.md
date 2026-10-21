# Lane briefs for lit-crucible

Each lane is a read-only child started with `invoke_subagent`. The brief carries only the restated brief and the lane's own question list. Another lane's output never enters it, so the lanes stay free to disagree.

## Brief skeleton

```text
TASK: <lane name> lane for the brief below. Find how this brief can fail inside your lane.
BRIEF: <five-line restatement: outcome, surfaces, scope, non-goals, done check>
QUESTIONS: <the lane's numbered questions from below>
SCOPE: read-only. Named paths: <paths>. Edit nothing, install nothing, write no state, run no release command.
DELIVERABLE: one message to the parent with a table: finding | severity guess | evidence (file:line, command name, or a scenario with inputs) | confidence | open uncertainty.
VERIFY: for every claim, name the file or command that shows it. A claim without one is labeled an assumption.
If answering needs a mutation, report the need and stop.
```

Use `TypeName` `lit-planner` for codebase lanes and `librarian-researcher` for lanes that need outside facts. Send the brief as the `Prompt`; the `Role` line names the lane.

## Lane question lists

### Correctness

1. Which inputs sit at the edges: empty, huge, malformed, wrongly encoded, time-zone dependent, reordered?
2. What happens on partial failure, a retry, a duplicate call or a restart in the middle?
3. Which invariant does the current code rely on that the change could break?
4. Which existing test would catch a regression here, and which behavior has no test at all?

### Security and data

1. Which trust boundaries does the change cross, and who controls the data on each side?
2. Where could untrusted text (issue bodies, logs, fetched pages, file names) reach a command, a prompt or a path?
3. Which secrets, tokens or personal fields could land in a log, an artifact or a commit?
4. Does any permission widen, and does any deletion path lose data without a copy?

### Compatibility

1. Which public contracts, file formats, config keys or command names does the change touch?
2. What do older clients, older installs and older saved state do after the change, in both upgrade and downgrade?
3. Which dependency versions, runtime versions or operating systems does the change assume?
4. Which packaged files, manifests or version fields must move together?

### Operations and real surface

1. How does a user actually reach this behavior, and what is the first screen, command or call they see?
2. How does it fail in the environments users run: limited shells, no network, read-only folders, headless runs?
3. Which success message could print before the artifact exists?
4. What does rollout and rollback look like, and what stale generated output could survive both?

### Scope and assumptions

1. Which work is implied by the brief and unstated in it?
2. Which assumption, if wrong, invalidates the approach? Who owns it?
3. What are the competing designs, including "extend the existing surface" and "no product change"?
4. Which adjacent work is tempting, and does the brief permit it?

### Domain lane (add when the brief calls for it)

Examples: data migration (ordering, reversibility, dual-write windows), billing (rounding, idempotence, refunds), concurrency (locks, races, ordering), installer (write boundary, ownership, foreign folders), release preparation (version lockstep, pack contents, tag authority), agy plugin work (hook JSON shape, the 24,000-byte skill body limit, tool-name differences between builds, empty PreToolUse answers read as denials).

## Reading the replies

- A reply is a claim set. Verify each material path and command yourself before it enters the findings table.
- A reply that says "tests should pass" or "no package impact" without naming tests or a pack list produced no evidence; record it as an assumption.
- Two lanes that contradict each other are the useful result. Resolve by local evidence or carry the fork into the plan as a decision.
- A lane that never answers is replaced once, inline, and noted. agy has no wait tool, so keep working while lanes run, and ask a straggler to wrap up with `send_message`.

## Running without children

When no agent can be started, run the lanes one after another in this conversation. Write each lane's findings to the findings file before opening the next lane, and answer each lane from the brief and the repository facts only, leaving earlier lane findings aside until the cross-check step. Say once that the lanes ran inline.
