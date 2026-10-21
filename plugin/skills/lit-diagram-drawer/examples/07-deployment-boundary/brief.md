# Diagram brief · Public entry to private service

- Type: deployment
- Audience: engineers and reviewers
- Purpose: Traffic terminates at the edge; workloads and data remain inside the private network.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- Public edge participates in the labeled relationships below.
- Web tier participates in the labeled relationships below.
- Service tier participates in the labeled relationships below.
- Private data participates in the labeled relationships below.
- Required relationships:
- Public edge → Web tier (TLS)
- Web tier → Service tier (internal)
- Service tier → Private data (private link)
- Trust boundary internal nodes: Service tier; Private data
- Trust boundary external nodes: Public edge; Web tier
- Do not infer omitted systems or timing.
