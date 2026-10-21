---
name: handoff
description: "Creates or updates a resolved HANDOFF.md continuation document that captures progress, findings, and remaining work so a fresh agent can continue without context loss.\nTRIGGER when: the current agent cannot complete a task and needs to pass it to a new agent, context window is nearly full, user explicitly requests a handoff, or the skill is invoked as bare `handoff`.\nDO NOT TRIGGER when: the task is normal ongoing work with no agent transition needed."
---

# Handoff

## Overview

Produce or update a single continuation document that lets a fresh agent resume work without rereading the prior session. The handoff is not a status report. It is a reboot packet.

**Core principle:** A fresh agent reading only this document (plus the codebase) can continue the task effectively.

## When to Use

- The current agent cannot finish the task (context limit, session timeout, user handoff request).
- The user explicitly asks for a handoff, context summary, or session transfer.
- The bare skill invocation `handoff` appears with no additional user text. Treat that as an explicit request to create or update a handoff.
- A multi-session task has reached a natural break point where continuation by a new agent is likely or planned.

## When NOT to Use

- Work is ongoing with no transition needed.
- The user asks for a summary, changelog, or documentation that is not meant for a fresh agent.
- The task is trivially complete and no continuation context is useful.
- The user wants a commit message, PR description, or release notes (those have their own formats).

## Contract

This skill operates under the following rules. Every invocation must satisfy all points.

### 1. Trigger Conditions

See `## When to Use` above.

### 2. Non-Trigger Conditions

See `## When NOT to Use` above.

### 3. Destination Resolution

Before writing, resolve a single handoff destination for the active project or workspace.

| Workspace state | Resolved handoff path | Required behavior |
|-----------------|----------------------|-------------------|
| Git repository, no existing root `HANDOFF.md`, and no explicit user request for root output | `.handoff/HANDOFF.md` | Create or update the local handoff under `.handoff/`. |
| Git repository with an existing root `HANDOFF.md` | root `HANDOFF.md` | Read, classify, and update the root file for backward compatibility unless the user requests migration. |
| Git repository with an explicit user request for root `HANDOFF.md` | root `HANDOFF.md` | Allow root output, but warn that handoffs may contain local/session detail and should stay ignored or otherwise kept out of public commits when appropriate. |
| Non-git workspace | root `HANDOFF.md` | Create or update the handoff at the workspace root. |

The resolved handoff path is the only generated output target. Vague wording such as "save it somewhere I can find it later" is not a destination override.

**Never write generated handoff output into:**
- The skill directory itself or its subdirectories
- A `system-prompt-extraction/` folder (this is a known anti-pattern from an earlier version)
- Any path outside the active project or workspace root
- Arbitrary package, docs, examples, template, or scratch subdirectories that are not the resolved handoff path

### 4. Primary Audience

The only intended reader is the next fresh agent who picks up the task. Optimize for that reader:

- Prioritize current state and next steps over history. Current State appears early in the document so the next agent knows where things stand before reading details.
- Include only context the fresh agent needs to act.
- Omit session narrative, general observations, and anything the fresh agent could discover by reading the codebase.

### 5. Evidence Rule

Every factual claim about progress, state, or results must be backed by evidence when available:

- **File paths** for changed or relevant files.
- **Commands** that reproduce a result or verify state.
- **Commit hashes** for changes pushed.
- **Error output** for failures encountered.

When evidence is unavailable or unverified, label it explicitly:

- `[UNVERIFIED]` for claims not yet confirmed.
- `[UNKNOWN]` for facts that could not be determined.

Never fabricate or guess missing context. A labeled gap is always better than a fabricated assertion.

### 6. Existing Resolved Handoff Handling

When the resolved handoff file already exists, apply this three-step decision procedure. In git repositories with an existing root `HANDOFF.md`, that root file is the resolved handoff file for compatibility unless the user requests migration.

**Step 1: Classify the existing file.** Read it and determine which case applies:

| Signal | Classification | Action |
|--------|---------------|--------|
| Different task, different workstream, or task fully completed | **Obsolete** | Replace fully. Discard entire file. |
| Same task, same workstream, still in progress | **Active continuation** | Proceed to Step 2. |
| Same task but state has diverged significantly from reality | **Stale continuation** | Proceed to Step 2 (treat as selective salvage). |

**Step 2: Evaluate each section for carry-forward.** For each section in the existing file, apply this test:

*Would the next agent be materially worse off if this section were missing?*

Materially worse off means the section contains one of:
- An unresolved blocker or risk that is still open (not resolved in the current session).
- A key decision with rationale that the next agent might reverse without understanding why it was made.
- A failed approach or dead end the next agent would otherwise retry.
- An environment or setup detail not discoverable from the codebase alone.

If the section meets none of these criteria, discard it. Do not preserve it "just in case."

**Step 3: Compose the new document.** Write a fresh document from the template. For any section that passed the Step 2 test, carry its content forward into the corresponding new section. Do not create a "Legacy" or "Previous" section to dump old content. Integrate carried-forward facts into the appropriate template sections. Prefix each carried-forward item with `[PRIOR]` so the next agent can distinguish inherited context from facts established in the current session. Example: `[PRIOR] CI pipeline requires Node 18; newer versions break a native dependency.`

**Rules that always apply:**
- **Never append the new document after the old one.** This produces a confusing hybrid that forces the next agent to guess which parts are current.
- **Never carry forward a section verbatim without re-evaluating it.** Even if a section seems relevant, verify its facts are still accurate before including it.
- **When in doubt, replace fully.** A clean, smaller document is always better than a bloated one padded with uncertain legacy context.

## Output Location

| Asset Type | Location | Notes |
|------------|----------|-------|
| **Template** (reference structure) | `${SKILL_ROOT}/templates/HANDOFF.md` | Read-only scaffold the agent uses as a guide |
| **Generated output** (actual handoff) | Resolved handoff path from Destination Resolution | The document the agent writes for the next agent |

The template is an asset shipped with the skill. The generated output is the handoff document the agent produces at runtime. They are separate things. Never write generated output into the template path.

## Required Sections

Every generated handoff file at the resolved destination must include these sections, in this order:

1. **Task** - What was the agent trying to accomplish. One or two sentences.
2. **Current State** - Where things stand right now. What is done, what is in progress, what is blocked. Lead with this.
3. **What Was Done** - Changes made, with file paths and commit hashes where available. Not a narrative. A list.
4. **Key Decisions** - Architectural or design choices made, and why. Only include decisions the next agent might question or reverse.
5. **Open Issues** - Unresolved problems, known bugs, things that still need investigation. Use `[UNKNOWN]` or `[UNVERIFIED]` tags where evidence is missing.
6. **Next Steps** - Ordered list of concrete actions the next agent should take. Be specific: file names, command lines, test names.
7. **Context for Continuation** - Anything else the next agent needs but cannot easily discover from the codebase. Keep this tight.

If a section would be empty, include it with a one-line note like "None at this time" rather than omitting it. The next agent needs to know the section was considered.

Supplementary sections beyond these seven (e.g., Verification Commands, Key Files, Evidence & References) are allowed when they help the next agent act. They must earn their place: omit them if they contain no information the next agent could not discover from the codebase.

## Process

1. **Assess need.** Confirm a handoff is warranted (see trigger conditions). If not, stop.
2. **Gather evidence.** Read recent files, git log, error output, and any existing planning documents. Do not guess.
3. **Resolve the destination and check for an existing handoff.** Apply Destination Resolution first. If the resolved handoff file exists, follow the three-step procedure in Contract point 6: classify the file, evaluate each section for carry-forward, then compose fresh from the template.
4. **Draft the document.** Follow the required sections above. Current State appears early so the next agent sees the status first. Mark unknowns as `[UNKNOWN]` or `[UNVERIFIED]`. Do not fabricate.
5. **Write to the resolved handoff path.** Not the skill directory. Not `system-prompt-extraction/`. Not an arbitrary path outside the destination policy.
6. **Verify resumability.** Read back the written file. Apply the Resumability Criteria audit: confirm all six questions (where am I, what was done, what failed, what remains, how do I verify, what don't I know) have concrete answers. Confirm every factual claim is either evidenced or tagged `[UNKNOWN]`/`[UNVERIFIED]`. If any question is unanswered, revise before finalizing.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Writing a narrative timeline ("First I did X, then I tried Y...") | Use structured sections. The next agent needs state, not story. |
| Writing to the skill directory or `system-prompt-extraction/` | Resolve the destination from Destination Resolution, then write only to that handoff path. |
| Appending to an existing handoff without classifying it | Follow the three-step procedure in Contract point 6: classify, evaluate per-section, compose fresh. |
| Creating a "Legacy" or "Previous" section to dump old content | Integrate carried-forward facts into the appropriate template sections. No dumping grounds. |
| Carrying forward a section verbatim without verifying accuracy | Re-check each fact before including it. Stale facts are worse than missing facts. |
| Omitting evidence ("tests pass" without the command or output) | Include the command and a summary of the result. |
| Fabricating or guessing missing information | Tag as `[UNKNOWN]` or `[UNVERIFIED]`. Gaps are fine. Lies are not. |
| Including information the next agent can discover from the codebase | Omit it. The handoff is for continuation context, not a codebase tour. |
| Leaving out the Next Steps section | This is the most important section for the next agent. Always include it. |
| Mixing template structure with generated content | Template is read-only reference. Generated output goes to the resolved handoff path. |

## Resumability Criteria

A handoff document is **resumable** if a fresh agent reading only the resolved handoff file (plus the codebase) can answer all six of these questions without guessing:

| # | Question | Where in the document | Pass condition |
|---|----------|-----------------------|----------------|
| 1 | **Where am I?** What was the last completed action? | Current State | States the last completed action explicitly. Not "we worked on X" but "file Y was edited, line Z changed, commit abc1234." |
| 2 | **What was done?** What changes exist in the codebase? | What Was Done | Lists every changed file with evidence (path, commit hash, or command output). No vague "refactored the module" without specifics. |
| 3 | **What failed or blocked?** What dead ends and blockers exist? | Open Issues + Dead Ends | Every blocker names the specific error, file, or test. Every dead end names the approach tried and why it failed. Tagged `[UNKNOWN]` if evidence is missing. |
| 4 | **What remains?** What must happen next? | Next Steps | First step is independently actionable (a specific command or file edit). Steps are ordered, not a wishlist. |
| 5 | **How do I verify?** Can I confirm current state before proceeding? | Verification Commands (supplementary) | At least one command the fresh agent can run to confirm the handoff accurately describes the codebase state. |
| 6 | **What don't I know?** Where are the gaps? | Throughout | Every information gap is tagged `[UNKNOWN]` or `[UNVERIFIED]`. No fabricated details filling gaps. |

**Anti-fabrication rule:** If the agent cannot determine a fact (e.g., whether a test passes, what a file contains, whether a change was committed), it must tag the gap explicitly. A handoff with five labeled unknowns is resumable. A handoff with one fabricated assertion is not.

**Verification procedure:** After writing the handoff, the authoring agent must perform this audit:

1. Read the document back.
2. For each of the six questions above, confirm the document provides a concrete answer (not a guess).
3. If any question cannot be answered from the document alone, revise that section.
4. Confirm every factual claim is either evidenced or tagged `[UNKNOWN]`/`[UNVERIFIED]`.

A handoff that passes this audit is resumable. One that does not is a status report, and the next agent will waste time re-discovering context.

## Integration

### With planning-with-files

If `task_plan.md`, `findings.md`, or `progress.md` exist in the project, reference their locations in the handoff. The next agent should know these files exist and can read them for deeper context.

### With verification-before-completion

Before declaring the handoff complete, verify: read the file back, confirm all required sections are present, and check that every claim is evidenced or tagged.

### With session recovery

When an agent starts a new session and finds root `HANDOFF.md` or `.handoff/HANDOFF.md`, it should read the applicable handoff first before examining the rest of the codebase. The handoff is the entry point for continuation.
