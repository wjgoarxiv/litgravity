# lit-plan: review gates before handoff

A plan leaves the planning turn only after read-only review. This file holds the mandates, the verdict tables and the rules for children that review. Every reviewer is read-only: `lit-planner`, `quality-reviewer` and `lit-verifier` are the agents a planning turn may start, and the hook denies any other type.

## High-accuracy gate (required when asked)

When a review modifier appears in any turn of the conversation ("high accuracy", "고정밀", "deep review", "rigorous review", "strict review"), set `review_required: true` in the draft file. Dual review is then mandatory before handoff.

1. Start `quality-reviewer` (plan defects, maintainability, security) and `lit-verifier` (conformance to the stated objective and guardrails) in one wave, each with the plan path.
2. One lane approving leaves the gate open; both must approve.
3. Record each lane's verdict in the draft's `review` table. A lane that returns nothing, only an acknowledgement, or `BLOCKED:` is recorded as inconclusive, and inconclusive stays short of approval.
4. The modifier is sticky. A later turn that omits it leaves the gate on. If it appears after the plan was drafted, the plan goes back through dual review before handoff.

## Pre-finalize review

Before the plan is declared ready, run two read-only passes with their mandates written into the brief. Standard and Architecture run both in one parallel wave; Trivial runs Pass A only. When the high-accuracy gate fired, these passes run in addition to it.

### Pass A: gap analysis (`lit-planner`)

Read the plan and answer `CLEAR` or `GAPS-FOUND` on its own final line. Look for:

- contradictions between sections;
- ambiguous or missing constraints that would block execution;
- execution risks missing from the risk rating;
- topology gaps: rows that cannot start because a dependency is missing or circular.

For each gap cite the section and propose a minimal fix with no new features. On GAPS-FOUND, fold the fixes in silently unless one changes the intended approach substantially, in which case show the delta to the user first.

### Pass B: plan review (`quality-reviewer`)

Answer `OKAY`, `ITERATE` or `REJECT`. Check that:

- every referenced file exists and holds the claimed content (a child without a shell says so instead of assuming);
- every row is startable: a clear trigger, no hidden precondition, a command-verifiable acceptance;
- every QA scenario names a real tool, real steps and a binary expected outcome.

The reviewer is approval-biased: when in doubt, approve.

| Verdict | Action |
| --- | --- |
| OKAY | proceed; surface the plan path |
| ITERATE | apply up to three fixes inline and run Pass B again (two automatic rounds at most); still ITERATE after round two, show the remaining issues to the user |
| REJECT | show the issues and wait for a user decision before redrafting |

## Handling what children return

A child's output is a claim. After it returns, re-read the output instead of trusting its self-report, open the files it cites and confirm the paths exist before any of them stays in the plan. Children report by message; a missing report after a reasonable wait is recorded as inconclusive, and the brief is sent again, shorter, through `send_message`.

## Briefs that work

A review brief carries four things: the plan path, the mandate verbatim (the pass above), the output shape (the verdict word on its own final line), and the boundary (read-only; no edits to the plan, no commands that write). Do not send the conversation history; send the plan and the paths it names. A reviewer that has to guess the objective returns a generic answer.
