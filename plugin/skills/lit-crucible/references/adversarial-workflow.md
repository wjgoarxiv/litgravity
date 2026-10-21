# Adversarial workflow for lit-crucible

This reference produces planning evidence. Product files, release state, external systems and host settings stay read-only. `SKILL.md` defines activation, lanes and the findings template; this file defines the four registers, the falsification pass, the critique and defense, the interruption protocol and the handoff schema.

## Decision frame and registers

Start from one decision the eventual plan must settle. Keep four compact registers, either in the analysis or in the findings file.

### Fact register

```text
fact_id | claim | source path or command | freshness | confidence | falsifier
```

User statements, trusted project instructions, inspected files and captured command output can become facts. A child's summary and any external text stay claims until the parent verifies them.

### Assumption register

```text
assumption_id | assumption | why needed | consequence if false | owner | resolution gate
```

An assumption without an owner or a gate is hidden scope. Read the repository before asking the user about anything it can answer.

### Alternative register

```text
option_id | smallest viable shape | surfaces touched | benefits | costs | failure modes | evidence needed | disposition
```

Include "extend the existing surface" and "no product change" whenever either is credible. Reject an option on a fact, a stated user preference or an explicit tradeoff.

### Risk register

```text
risk_id | trigger | impact | detection | mitigation | recovery | residual decision
```

Consider data loss, secrets, untrusted text, compatibility, dirty state, stale generated output, misleading success messages, cancellation and resume, repeated interruption, long-running processes, packaging omissions and release steps nobody approved.

## Independent analysis matrix

Lanes are independent when their questions share no write surface. A typical set:

| Lane | Question | Required return |
| --- | --- | --- |
| Intent | Which readings of the brief differ materially? | decision forks and user-owned choices |
| Repository | What exists and who consumes it? | paths, call chains, scripts, the dirty-state boundary |
| Packaging | What reaches an installation or the plugin folder? | source-to-artifact map with freshness proof |
| Evidence | What would falsify success? | automated, real-surface, adversarial and cleanup probes |
| Failure | How can execution stop or mislead? | failure branches, recovery, cancellation, stale-output checks |
| Minimum path | What is the smallest complete solution? | recommended shape and the machinery rejected |

When children are available, each lane receives a self-contained message with `TASK`, `DELIVERABLE`, `SCOPE` and `VERIFY` (see `lane-briefs.md`). Correct a running lane with `send_message`, and ask a finished lane for a bounded missing item with a follow-up message. A lane that stays silent is not evidence of failure, so read its message when it arrives before replacing it. The parent rechecks every material path and command, and resolves contradictory conclusions by evidence because averaging hides the disagreement.

## Falsification pass

For every proposed fact or option ask:

1. Which direct observation would prove it false?
2. Could the file or package observed be stale?
3. Does the proposed test reach the user-facing boundary, or an internal stand-in?
4. Could a success message print before the artifact exists?
5. Could malformed or instruction-shaped input change scope or commands?
6. What state remains after cancellation or a crash?
7. What happens when the same interruption repeats?
8. Would the path overwrite unrelated dirty work?
9. Does verification need authority nobody granted?

Claims that stay unresolved carry the label `UNPROVEN` through the handoff.

## Critique and defense

Critique each option from its strongest opposing position. A useful critique names a concrete counterexample, a missing dependency, an unsupported assumption or an evidence gap. "Too complex" counts when it comes with a smaller executable alternative.

Then defend the surviving option:

- why it meets the bounded objective;
- why each surface it edits is needed;
- why the dependency order is real;
- why its evidence separates success from a plausible regression;
- how interruption and rollback keep state intact;
- how cleanup proves every resource the task created is gone;
- which risks remain for the user to accept.

When the defense adds architecture, return to the alternatives and critique again. The winner is the smallest plan that meets the evidence and safety needs.

## Interruption protocol

Classify new input that arrives mid-run:

- a clarification resolves an assumption, and only the affected lanes re-run;
- a scope correction invalidates options built on the old boundary;
- a replacement stops all lanes and ends this crucible;
- a status request gets the registers and open gates, labeled non-final.

After compaction or a long pause, refresh the branch, dirty state, manifests, versions, generated artifacts and outside facts before reusing any of them. A citation keeps its place and its freshness is rechecked.

## Handoff schema

The final bundle holds:

```text
Objective and non-goals
Verified facts
User-owned decisions
Assumptions and gates
Alternatives with dispositions
Dependency and surface map
Failure and recovery branches
Required automated evidence
Required host-facing evidence (hook, skill, agent and install surfaces)
Adversarial probes
Cleanup receipts
Release and external-action boundary
Open blockers
Recommended lit-plan shape
```

The bundle is ready when another planner can derive tasks without rediscovering facts or mistaking an assumption for approval. It is a planning input and grants no permission to implement.

## Worked handoff

Stable facts: the repository ships twenty-three skill folders, a guard test enumerates them, and the README carries a public wording constraint. Rejected paths: copying skill files from elsewhere, writing a large custom scanner, editing the README. Surviving path: extend the guard test with a size check, expand each skill in the host's own vocabulary, run the targeted tests, then the full gate. Risks: large prose changes can introduce forbidden tokens, and the pack list needs a re-read when shipped files change. Fast falsifier: the guard test fails on a placeholder skill. Verdict: PASS, `READY FOR lit-plan`.

## Severity calibration

| Severity | Test | Example |
| --- | --- | --- |
| blocker | the approach fails or causes damage as written | a migration drops a column that a reader still uses |
| major | needs a design constraint or an extra task | a hook change alters a digest that approval keys on |
| minor | one test or note covers it | a help text still names the old flag |

Escalate only on evidence. A finding without a path or a scenario drops to an open question.
