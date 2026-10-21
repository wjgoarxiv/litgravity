# Phase 4 — Orthogonal Reframing Review

After two consecutive inconclusive hypothesis rounds, stop gathering more of the same evidence. The current model is probably missing a cause category, confusing build state with runtime state, or treating an assumption as a fact.

This phase produces new falsification queries. It does not produce a fix.

## Entry gate

Enter when:

- two complete rounds ended inconclusive;
- the remaining hypotheses have collapsed into variants of one idea;
- every available query tests the same layer;
- investigation has run a long time with no new discriminating observation.

Hold off after a single failed command, before you reproduce the symptom, or merely to get a second opinion on a plausible fix.

## Prepare the evidence packet

Build one inert packet:

```text
Symptom:
Smallest reliable reproduction:
Expected and observed outcome:
Runtime/build/environment identity:
Hypotheses tried:
Raw confirming or refuting observations:
Inconclusive boundaries:
Unavailable capabilities:
Artifacts:
```

Leave out theories that have no evidence. Remove secrets and user content. Cite a file, command, log, process, or address for every observation.

## Three reframing angles

Review the same packet through all three angles. When `invoke_subagent` is available and the repository permits delegation, give one read-only `quality-reviewer` child per angle (set `TypeName`; a child without it is general-purpose with every work tool). Otherwise run three separate passes and write each result before starting the next, so later reasoning preserves the disagreement.

### Angle A — mundane mismatch

Look for a simple identity or selection error:

- wrong process, port, file, branch, worktree, container, or environment;
- stale build, cache, generated output, installed package, or watcher;
- the wrong variable, constant, import, path, boundary index, or fixture;
- a reproduction command exercising a different entry point than the user's.

Return three candidates. Each one names the raw observation that would confirm or refute it.

### Angle B — boundary contract

Assume the inspected function is correct and the defect sits at a boundary:

- middleware, proxy, transport, serialization, encoding, or protocol negotiation;
- third-party package behavior or version skew;
- build-time versus runtime configuration;
- lifecycle ordering, cancellation, retry, or timeout;
- ABI, platform, filesystem, locale, clock, permission, or resource limit.

For every candidate, name both sides of the boundary, the assumed contract, and one runtime query.

### Angle C — invalid invariant

List the five assumptions most load-bearing to the current model. For example:

- the running bytes came from the inspected source;
- the request reached the expected instance;
- a "success" status means the side effect completed;
- logging is complete;
- the document, cache, transaction, or task state is current.

For each assumption, give the smallest query that could falsify it, the predicted output if it holds, and the predicted output if it fails.

## Synthesis

Do not vote on causes. Agreement between reviewers is only a lead, because they all share one packet. Use the outputs to build runtime experiments:

1. collect the repeated candidate categories;
2. keep the disagreements;
3. deduplicate queries that inspect the same state;
4. rank queries by discriminating power, safety, cost, and reversibility;
5. form at least three new hypotheses from distinct cause categories;
6. attach one decisive query to each hypothesis.

Record:

```markdown
## Orthogonal reframing — round <N>
- Trigger: <why the entry gate was met>
- Mundane mismatch candidates: <summary>
- Boundary candidates: <summary>
- Invalid invariants: <summary>
- Disagreements retained: <summary>
- New hypotheses:
  1. <claim> — <decisive query>
  2. <claim> — <decisive query>
  3. <claim> — <decisive query>
```

Reset the inconclusive-round counter and return to Phase 3.

## Reviewer limitations

A reviewer report is a lead, and the coordinating agent replays each decisive query and inspects its artifact before trusting it. Keep reviewers read-only, keep them off a shared process, and discount any tool availability they assume into existence. When the host exposes no subagents, sequential reframing is fully valid.

## Escalation threshold

When two more complete rounds stay inconclusive after this reframing:

1. stop proposing fixes;
2. preserve the full journal and the cleanup receipt;
3. summarize the exact missing capability or decision;
4. use `05-escalate.md` to request the smallest unblocker.

The correct outcome may be blocked. A guessed root cause is never an acceptable substitute.
