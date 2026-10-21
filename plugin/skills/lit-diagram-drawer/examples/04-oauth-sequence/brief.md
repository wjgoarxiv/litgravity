# Diagram brief · Authorization code with PKCE

- Type: sequence
- Audience: engineers and reviewers
- Purpose: The browser returns an authorization code; the backend exchanges it with the identity provider.
- Theme: light
- Canvas: 16:9 slide, editable SVG in HTML
- Required facts:
- Browser participates in the labeled relationships below.
- Application participates in the labeled relationships below.
- Identity provider participates in the labeled relationships below.
- Required relationships:
- Browser → Identity provider (authorize)
- Identity provider → Browser (code + state)
- Browser → Application (callback)
- Application → Identity provider (code + verifier)
- Do not infer omitted systems or timing.
