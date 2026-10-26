# Consensus Protocol — PPTX Ralplan

## Overview
Sequential Planner → Architect → Critic loop for PPTX slide structure planning. The loop runs until all reviewers APPROVE or max iterations (3) are exhausted.

## Agent Roles

### Planner (Orchestrator acts as Planner)
- Reads the interview spec (or direct user request)
- Creates a slide-by-slide implementation plan
- Specifies layout, content, data, and render path per slide

### Architect (Agent tool with agents/architect.md)
- Reviews plan for layout feasibility, template compliance
- Checks font names, dimensions, data expression validity
- Flags BLOCKER issues that would cause rendering failures

### Critic (Agent tool with agents/critic.md)
- Evaluates content quality, anti-slop compliance
- Checks for forbidden patterns, generic headings, padding
- Scores overall quality on 1-10 scale

## Loop Process

```
Iteration 1:
  Planner creates plan
      ↓
  Architect reviews → APPROVE or REJECT with issues
      ↓ (if REJECT)
  Planner revises based on Architect feedback
      ↓
  Architect reviews again
      ↓
  Critic evaluates → APPROVE or REJECT
      ↓ (if REJECT)
  Planner revises based on Critic feedback

Iteration 2: (if previous rejected)
  [repeat Planner → Architect → Critic sequence]

Iteration 3: (final attempt)
  [repeat, force-approve if still has only minor issues]
```

## Approval Gates

### Architect APPROVE Criteria
- All layouts valid
- Font usage matches the chosen template (for per-weight-family fonts like 에이투지체/Brand Sans, weight is selected by family name, not a bold flag)
- Dimensions match the chosen template (e.g. 10×7.5in 4:3 for BOILERPLATE-*, the A4 10.833×7.5in of a learned A4 template)
- No anti-slop violations
- Render paths appropriate per slide complexity

### Critic APPROVE Criteria
- Quality score ≥ 7/10
- Zero CRITICAL issues
- At most 2 MAJOR issues
- No scripts/forbidden-terms.json

### Forced Approval
If after 3 iterations the plan has only MINOR issues, force-approve with notes. Do not loop indefinitely.

## State Persistence
State is stored in `.pptx-pipeline/plan-state.json`:
```json
{
  "active": true,
  "iteration": 1,
  "max_iterations": 3,
  "architect_verdict": null,
  "critic_verdict": null,
  "issues_resolved": [],
  "started_at": "ISO timestamp"
}
```

## Output Plan Format
Write to `.pptx-pipeline/plan-{slug}.md`:
```markdown
# PPTX Implementation Plan: {title}

## Consensus Metadata
- Iterations: {n}
- Architect verdict: APPROVE
- Critic verdict: APPROVE
- Quality score: N/10

## Slide-by-Slide Implementation
### Slide 1: Cover
- Layout: cover
- Title: "..."
- Metadata: date, department
- Render path: compile-deck.js

### Slide 2: TOC
- Layout: content
- Title: "목차"
- Items: [...]
- Render path: compile-deck.js

### Slide 3-N: Content
- Layout: content | main
- Title: "..."
- Body: [bullet structure]
- Data: [table spec if any]
- Render path: compile-deck.js | pptxgenjs-direct

### Slide N+1: Summary
- Layout: summary
- Group 1: [heading + items]
- Group 2: [heading + items]
- Image: [path or none]
- Table: [spec or none]
- Render path: compile-deck.js

### Slide N+2: Closing
- Layout: closing
- Render path: compile-deck.js

## QA Plan
- Compile: `node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --template <TEMPLATE> --pptx output.pptx --embed-fonts` (or without `--template` when the frontmatter names the tonality; there is no default look)
- Verify: `python3 "$SKILL_ROOT/scripts/layout_inventory.py" output.pptx --issues-only`
- No scripts/forbidden-terms.json check: `python validate_pptx.py output.pptx`
```
