# Diagram brief · A staged rollout with stop points

- Type: timeline
- Audience: engineers and reviewers
- Purpose: The release advances through canary, regional rollout, and broad availability only when health checks pass.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- Package participates in the labeled relationships below.
- Canary participates in the labeled relationships below.
- Regional participates in the labeled relationships below.
- Broad participates in the labeled relationships below.
- Required relationships:
- Package → Canary (build)
- Canary → Regional (healthy)
- Regional → Broad (healthy)
- Do not infer omitted systems or timing.
