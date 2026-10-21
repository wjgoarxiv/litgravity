# Diagram brief · Retention pipeline with a deletion receipt

- Type: data-flow
- Audience: engineers and reviewers
- Purpose: A request is verified, applied to the object store and index, then recorded for audit.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- Request API participates in the labeled relationships below.
- Policy check participates in the labeled relationships below.
- Object store participates in the labeled relationships below.
- Search index participates in the labeled relationships below.
- Audit receipt participates in the labeled relationships below.
- Required relationships:
- Request API → Policy check (identity)
- Policy check → Object store (delete)
- Policy check → Search index (remove key)
- Object store → Audit receipt (receipt)
- Do not infer omitted systems or timing.
