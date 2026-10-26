# Clean-room build

The build separates two roles. The spec writer reads the sources and writes `SPEC.md`. The
implementer reads `SPEC.md` and the target, and builds. The spec is the only artifact that crosses.

## Why the split matters

A writer who has just read a source reproduces its phrasing, examples and order without noticing. A
writer who never saw it cannot. The split keeps expression out of the target and forces the spec to
be complete: anything left out cannot reach the implementer by memory.

Be honest about its limits. The model that implements may have met the source during training, and
a skill-shaped source often states its mechanism in one obvious way. The result is described as
*independently re-expressed*, with an exposure note in the report.

## Roles in a run

| Role | Who | Sees | Writes |
| --- | --- | --- | --- |
| Spec writer | the root session that ran capture and gap | sources, ledger, target | `SPEC.md`, the ledger |
| Planner | `lit-plan` | `SPEC.md`, the target | the plan file |
| Implementer | a child via `invoke_subagent` | the brief (spec + target root), the target | target files |
| Executor | `start-work` | the plan, the ledger of rows | row evidence |
| Gatekeeper | `hijack.mjs check` | everything | pass or fail |

On agy 1.4.4 a child agent inherits the parent's plugins, so the implementer can use the helper and
read the skill. When `invoke_subagent` is unavailable, implement from `SPEC.md` only in the same
context and say so in the report.

## Step 1: plan with lit-plan

Give `lit-plan` the `SPEC.md` as the brief. Each plan row is `- [ ] N. <title>` at column zero and
cites the SPEC section it implements (`M1`, `M4`), the target files and the test it adds. The build
gate requires at least one such row and a citation of every taken mechanism. Plan rows refer to the
spec and the target, never to `sources/` or a source URL. Record the plan path in
`ledger.build.plan`.

## Step 2: execute with start-work

Run the plan through `start-work`. Its per-row gates (RED, GREEN, surface, cleanup) apply unchanged.
A small port (one or two SPEC sections in one or two files) may keep a short plan in the run folder
in the same row grammar; say so in the report.

## Step 3: the implementer brief

`hijack.mjs brief <run>` prints a self-contained packet:

```text
TASK: Implement the specification below in the target at <root>. ...
DELIVERABLE: the change each SPEC section asks for ...
SCOPE: write only inside the target. Do not open any .litgravity/hijack/ folder ...
VERIFY: run the checks each section names ...

--- SPEC ---
<the spec text>
```

Hand it to a child agent with `invoke_subagent` using a write-capable role. The child sees the spec
and the target, never the run folder, the sources or their URLs.

## Step 4: record the build

List every changed file in `ledger.build.changed` (relative to the target root). When a source is
`ideas-credit`, add it to the target's provenance record or an `ATTRIBUTION.md` beside the ported
skill, and set `ledger.attribution.path`.

## Build gate

`hijack.mjs check --phase build` requires:

- A plan with at least one column-zero task row
- A citation of every taken mechanism in the plan
- No source path or URL in the plan
- Every changed file exists
- No 12-word run from any capture in any changed file (except the attribution notice)
