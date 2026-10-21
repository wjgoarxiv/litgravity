# Team orchestration: the leader's runbook

Team mode coordinates two or more child agents through a local durable packet. Use it when work needs shared acceptance criteria, coordinated ownership, or evidence that survives a compaction. For an isolated one-shot task a plain `invoke_subagent` call is cheaper. For an unclear objective, get an approved plan (`lit-plan`) before building a team. Run every `node` command below with `run_command` from the project root; `<skill-folder>` is the folder of the lit-team SKILL.md that was read.

## 1. Choose composition and isolation

Compose members by:

- **area**: independent product areas with separate outputs;
- **ownership**: non-overlapping files or modules, one owner each;
- **perspective**: read-only reviews of the same artifact from different risk lenses.

Each member needs a concrete focus, a deliverable, in-scope paths (if it may write), forbidden actions, a verification command, real-surface evidence and a cleanup receipt.

| Situation | Isolation |
| --- | --- |
| read-only analysis | shared checkout |
| disjoint file ownership | shared checkout with explicit `--paths` |
| overlapping implementation | separate worktrees, each authorized by the user |
| release, secrets or remote settings | keep in the leader lane unless explicitly delegated |

The packet records worktree intent and paths. It grants no permission to create, merge, delete or push a worktree or branch, so Git authority is applied separately and requested with `ask_question`.

## 2. Initialize the packet

```text
node "<skill-folder>/scripts/team.mjs" init --name "<team>" [--objective "<text>"] [--worktree] [--base-branch <branch>]
```

The command creates `.litgravity/team/<team-id>/` with `team.json`, `guide.md` and `artifacts/`, and prints the team id (`<slug>-NN`). The id is opaque and reused exactly. `team.json` is written only by the script: every mutation holds an owner lock across the whole read-modify-write, so concurrent commands cannot overwrite one another with stale snapshots, a dead owner is recovered through a fenced takeover after 30 seconds, and live or malformed ownership fails closed.

Add at least two members before any child is bound:

```text
node "<skill-folder>/scripts/team.mjs" add-member --team <id> --id <member> --focus "<bounded focus>" \
     --deliverable "<artifact>" [--lens area|ownership|perspective] [--agent <TypeName>] \
     [--paths "src/a,src/b"] [--branch <branch>] [--cwd <dir>]
```

Member ids match `[A-Za-z0-9][A-Za-z0-9_-]{0,31}`. Focus values are unique after trimming and lower-casing. Owned paths are workspace-relative and cannot overlap between members (`src/a` and `src/a/x` overlap). A write-capable agent (`lit-executor`, or `general-purpose`) declares `--paths`; a read-only agent declares none. The default agent is `lit-executor`, or `quality-reviewer` for the `perspective` lens. An overlap is a planning defect: refine ownership before continuing.

## 3. Start and bind children

Generate the durable brief and the call arguments:

```text
node "<skill-folder>/scripts/team.mjs" prompt --team <id> --id <member> [--return-mode reader|technical|audit]
```

Add current repository facts, the exact scope, protected dirty state and the expected receipt to the `Prompt`. Call `invoke_subagent` with the returned `spawn_args` (`TypeName`, `Role`, `Prompt`; `TypeName` is absent only for the recorded `general-purpose` exception). Then record the id the host returned:

```text
node "<skill-folder>/scripts/team.mjs" bind-agent --team <id> --id <member> --agent-id <child id> [--cwd <absolute-path>]
```

`bind-agent` refuses until the team has two members and marks the member `active`. In worktree mode `--cwd` is the member's real checkout: confirm it exists, is canonical and matches authorized ownership before work begins. When `invoke_subagent` is unavailable or an agent is not installed, no packet command can create a child. Stop at that boundary, or run a user-approved direct-execution fallback in this conversation and say so. Members never become `active` through a fabricated id.

## 4. Communication cadence

The leader owns the objective and the global verdict. agy offers no wait or read-result tool. Members send messages to the parent:

- `WORKING:` before a long phase;
- `BLOCKED:` with one concrete missing fact or capability;
- `DONECLAIM:` with changed files or findings, exact commands, surface evidence, risks and a cleanup receipt.

Change durable status only after observing the matching host state:

```text
node "<skill-folder>/scripts/team.mjs" set-status --team <id> --id <member> --status pending|active [--note "<bounded note>"]
```

`set-status` moves only between `pending` and `active`; a member settles through `report` or `block`. Notes hold no secrets, raw logs, credentials, personal data or prompt-like text copied from untrusted material, and they summarize with safe paths, hashes, counts and verdicts.

While members work, do independent leader work and read each message as it arrives. Follow up for a missing structured deliverable with `send_message`; an acknowledgement alone satisfies no lane. Inspect the durable view whenever ownership or progress changes:

```text
node "<skill-folder>/scripts/team.mjs" status --team <id>
```

The packet and the messages received are two views of the same team, and neither alone proves the work is complete.

## 5. Accepting member work

Read the child's message, then check it yourself.

- Implementation members: inspect the actual diff in the member's owned paths or worktree, confirm nothing changed outside them (`git status --porcelain`, `git diff --stat`), rerun the decisive commands from the right checkout, and probe the assembled product surface.
- Analysis members: verify the cited paths and reproduce the key searches.
- Perspective members: keep each independent verdict. Verdicts stay separate and are never averaged.

Reject a DoneClaim that lacks exact evidence, crosses ownership, modifies unrelated dirty work, leaves resources running, relies on a stale artifact, or implies an unauthorized commit, push or release. Send the narrow failure back to the same member or assign an explicitly bounded repair. Then settle the member:

```text
node "<skill-folder>/scripts/team.mjs" report --team <id> --id <member> --evidence "<path inside the workspace>" [--note "<text>"]
node "<skill-folder>/scripts/team.mjs" block  --team <id> --id <member> --reason "<one concrete reason>"
```

`report` refuses an evidence path that does not exist, leaves the workspace, or is a symlink. Team completion requires every required deliverable plus a leader-verified aggregate. A blocked or inconclusive member stays blocking unless the approved plan removes that dependency.

## 6. Archive and delete

```text
node "<skill-folder>/scripts/team.mjs" archive --team <id> [--note "<receipt note>"]
```

Archive refuses while any member is neither reported nor blocked, writes `archive-receipt.json`, and freezes the packet (later mutations are refused). Ask running children to stop with `send_message`, end processes, release ports, remove temporary directories and handle worktrees only under explicit Git authority, then compare the durable status with live resources.

```text
node "<skill-folder>/scripts/team.mjs" delete --team <id>
```

Delete removes the whole packet folder, receipt included, and only for an archived team. `--force` bypasses the archive check and needs explicit user authority plus a separate decision about the artifacts. Keep the archived packet when continuation or audit value remains.

## 7. Leader receipt

Report the team id, composition, member-to-child bindings, the ownership map, deliverables, verified commands and surface artifacts, blocked or inconclusive lanes, cleanup, retained local state, and the Git or release actions actually performed (normally none). A team counts as deleted, children as stopped and worktrees as removed after those exact surfaces were rechecked.

## 8. Failure modes

| Symptom | Cause | Response |
| --- | --- | --- |
| `focus overlaps member X` | two members on one slice | re-slice the work or drop a member |
| `owned path … overlaps` | two writers can collide | split paths or use authorized worktrees |
| `… can write; give member … explicit --paths` | write-capable agent with no ownership | declare paths, or choose a read-only agent |
| `cannot bind agents until the team has at least 2 distinct members` | under-staffed team | add the second member first |
| `evidence path does not exist` | claim without an artifact | have the member produce the artifact, then report |
| `cannot archive: A, B have not reported or blocked` | outstanding lanes | settle or stop them, then archive |
| `team state lock timed out` | another command holds the packet | wait; a dead owner is taken over after 30 seconds |
| `corrupt team state` or `refused symlinked …` | packet tampered with or replaced | stop, inspect `.litgravity/team/`, repair nothing by hand |
| `unknown agent: …` | a name outside the LitGravity roster | use `lit-executor`, `qa-runner`, `lit-planner`, `lit-verifier`, `quality-reviewer`, `librarian-researcher`, a Korean prose agent, or `general-purpose` |
