# HANDOFF: <!-- TASK TITLE -->

<!--
SECTION MAPPING — This template satisfies all 7 required sections from SKILL.md:
  1. Task                    → "Task"
  2. Current State           → "Current State"
  3. What Was Done           → "What Was Done" (includes successes and dead ends)
  4. Key Decisions           → "Key Decisions"
  5. Open Issues             → "Open Issues" (blockers, risks, unresolved problems)
  6. Next Steps              → "Next Steps"
  7. Context for Continuation → "Context for Continuation"

DESTINATION NOTE:
This file is the shipped template asset. Generated handoff output goes to the
resolved handoff path from SKILL.md, such as .handoff/HANDOFF.md in a new git
repository or root HANDOFF.md for non-git workspaces and supported root cases.
Do not write generated handoff content into templates/HANDOFF.md.

EXISTING FILE POLICY:
If the resolved handoff file already exists, do NOT append the new document after the old one.
Instead:
1. CLASSIFY the existing file: obsolete (different task/completed) → replace fully.
   Active or stale continuation → evaluate per-section.
2. EVALUATE each old section: carry forward ONLY if it contains an unresolved blocker,
   a key decision with rationale, a failed approach worth avoiding, or non-discoverable
   setup details. Discard everything else.
3. COMPOSE fresh from this template. Integrate any carried-forward facts into the
   matching sections below. Do not create "Legacy" or "Previous" sections.
When in doubt, replace fully. A clean, smaller document beats a bloated hybrid.
-->

**Written**: <!-- ISO date, e.g. 2026-04-19 -->
**Status**: <!-- blocked | in-progress | at-checkpoint | abandoned -->
**Branch**: <!-- git branch name, if applicable -->
**Last commit**: <!-- short hash + subject line, if applicable -->

## Task

<!-- One or two sentences: what was the agent trying to accomplish. -->

## Current State

<!-- One paragraph: where things stand right now. What was the agent actively doing when context ran out or handoff was triggered? Be specific about the last completed action and the immediate in-progress action. -->

## What Was Done

<!-- Changes made, with file paths and commit hashes where available. Not a narrative. A list. -->

### Successful Approaches
<!-- Approaches, tools, or patterns that produced results. Include file paths or commands as evidence. -->
-

### Dead Ends
<!-- Failed approaches, known broken paths. Prevent the next agent from repeating these. -->
-

## Key Decisions

<!-- Architectural or design choices made, and why. Only include decisions the next agent might question or reverse. -->
-

## Open Issues

<!-- Unresolved problems, blockers, risks, known bugs. Tag unverified claims with [UNVERIFIED]. -->
-

## Next Steps

<!-- Numbered list. Each step should be independently actionable by a fresh agent. -->

1. <!-- First thing the next agent should do. Be precise: file path, function name, or command. -->
2. <!-- Second step. -->
3. <!-- Third step. -->

<!-- Continue numbering as needed. The first step should be verifiable within minutes. -->

## Context for Continuation

<!-- Anything else the next agent needs but cannot easily discover from the codebase. Keep this tight. -->

### Origin
<!-- Where did this task come from? Link to plan file, issue, user request, or parent task. -->

### Constraints
<!-- Hard requirements the next agent must respect: must-not-modify lists, scope boundaries, target platforms, time budgets. -->

<!-- CARRIED-FORWARD MARKER: When preserving facts from a prior HANDOFF.md that pass the materiality
     test (unresolved blocker, key decision rationale, failed approach, non-discoverable setup),
     prefix the carried-forward item with [PRIOR] so the next agent can distinguish inherited
     context from facts established in the current session. Example:
       - [PRIOR] CI pipeline requires Node 18; newer versions break a native dependency.
     Do NOT use [PRIOR] for facts you verified or established yourself in this session. -->

## Verification Commands
<!-- Commands the next agent can run to confirm current state before proceeding. -->

```bash
# <!-- What this verifies -->
```

## Key Files

| File | Role |
|------|------|
| <!-- path --> | <!-- what this file does for the task --> |

## Evidence & References
<!-- Pointers to specific commits, logs, output, or external resources. Use [UNVERIFIED] for unconfirmed claims. -->

-

<!-- OPTIONAL SECTIONS BELOW. Include only if the content helps the next agent act. Each section must earn its place: if it contains no unresolved blocker, key decision, failed approach, or non-discoverable setup detail, omit it entirely. -->

## Architecture Notes (optional)
<!-- Only include if the next agent needs structural understanding not available from reading the code directly. Keep to facts, not opinions. -->

## Environment Notes (optional)
<!-- Only include if non-obvious setup is required: special env vars, service dependencies, tool versions, credentials location. -->

## Open Questions (optional)
<!-- Unresolved questions the next agent should consider. Not a wish list; only things that genuinely affect next steps. -->
