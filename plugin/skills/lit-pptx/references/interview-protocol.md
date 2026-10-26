# Interview Protocol — PPTX Deep Interview

## Dimensions (PPTX-Specific)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Topic & Purpose | 0.30 | Is the presentation topic unambiguous? Can you state the key message? |
| Audience & Context | 0.25 | Who is the audience? What do they know? What decision should they make? |
| Structure & Scope | 0.25 | How many slides? What sections? Which layouts? Cover/TOC/Summary split? |
| Data & Evidence | 0.20 | What data/tables/charts/images needed? Are sources available? |

## Ambiguity Formula
```
ambiguity = 1 - (topic × 0.30 + audience × 0.25 + structure × 0.25 + data × 0.20)
```
- `ambiguity ≤ 0.20` → ready to proceed
- `ambiguity > 0.20` → continue interviewing

## State Persistence
State is stored in `.pptx-pipeline/interview-state.json` in the user's working directory:
```json
{
  "active": true,
  "rounds": [],
  "current_ambiguity": 1.0,
  "threshold": 0.20,
  "challenge_modes_used": [],
  "started_at": "ISO timestamp"
}
```

## Interview Flow

### Round 1: Initial Assessment
1. Spawn Analyst agent to extract requirements from user's request
2. Score all 4 dimensions
3. If ambiguity ≤ 0.20, skip to spec crystallization
4. If ambiguity > 0.20, present score and ask first question

### Rounds 2+: Socratic Questions
One question per round, targeting the **weakest dimension**.

**Question styles by dimension:**
| Dimension | Question Style | Example |
|-----------|---------------|---------|
| Topic & Purpose | "What exactly should this communicate?" | "When you say 'project status', what specific milestone or deliverable is this about?" |
| Audience & Context | "Who needs this and why?" | "Is this for a board meeting where executives need a decision, or an engineering review where details matter?" |
| Structure & Scope | "How should this be organized?" | "Should this follow the standard cover→TOC→content→summary structure, or do you need a different flow?" |
| Data & Evidence | "What numbers tell the story?" | "Do you have the actual KPI data, or should the deck include placeholder metrics?" |

### Challenge Agents (Round Thresholds)

**Round 3+: Contrarian Mode**
> "What if the audience already knows this? Would the deck still be valuable?"

**Round 5+: Simplifier Mode**
> "Can this be communicated in half the slides? Which slides are padding?"

**Round 7+: Redesigner Mode**
> "What if this were a 1-page executive summary instead? Would it lose anything critical?"

Each challenge mode is used ONCE, then returns to normal Socratic questioning.

## Soft Limits
- **Round 5**: Soft warning — "We're at 5 rounds. Continue or proceed with current clarity?"
- **Round 10**: Hard cap — "Maximum interview rounds reached. Proceeding with current clarity."
- **Any round**: User can say "enough", "let's go", "build it" to exit early

## Output Spec
When ambiguity ≤ 0.20 (or early exit / hard cap), write `.pptx-pipeline/spec-{slug}.md`:
```markdown
# PPTX Deck Spec: {title}

## Metadata
- Interview rounds: {n}
- Final ambiguity: {score}%
- Generated: {timestamp}

## Deck Configuration
- Direction: {tonality} with alternatives {two tonalities}, from the direction card (`direction-step.md`); a legacy or learned template only when the user names it
- Font: {Pretendard | 에이투지체 | Brand Sans | learned}
- Slide count: {n}
- Language: {match the user; e.g. Korean with English technical terms}

## Slide-by-Slide Plan
### Slide 1: Cover
- Title: ...
- Date: ...
- Metadata (department/author): ...

### Slide 2: TOC
- Items: [...]

### Slide 3-N: Content slides
- Title: ...
- Layout: content | main
- Key points: [...]

### Slide N+1: Summary
- Group 1: ...
- Group 2: ...

### Slide N+2: Closing

## Data Requirements
- Tables: [what data, how many rows/columns]
- Images: [what images, where to get them]
- Charts: [what charts, data source]

## Style Decisions
- Bullet hierarchy: [standard | data-heavy | executive]
- Table style: [compact | matrix | kpi]
```
