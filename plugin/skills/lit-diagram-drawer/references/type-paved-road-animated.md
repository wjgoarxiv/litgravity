# Secure paved-road architecture

**Catalog ID:** `paved-road-animated`  
**Semantic pattern:** secure paved road; visual grammar: Architecture.  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Semantic patterns](semantic-patterns.md) · [Motion](motion.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Pick this pattern when a supported deployment route must stand apart from forbidden ingress or bypass attempts. Make the trust boundaries, actor identities, privileged approval gate, isolated runtime, and audit destination explicit. It is an Architecture diagram with an optional step reveal and follows the Architecture grammar throughout. A regular Architecture figure fits better when trust enforcement and allowed/blocked routes are secondary.

## Exclusions

Stay within three trust zones, eight components, ten paths, two blocked paths, and one privileged gate. Show identities as roles or claims and leave credentials and secret values out. A denied path stops at the boundary and never reaches the protected runtime or rejoins the authorized route. When detailed controls and exceptions exceed the one-gate overview, move them to a separate governance/control catalog.

## Content schema

```yaml
title: "Secure deployment route"
zones:
  - { id: public, label: Public ingress }
  - { id: build, label: Build and governance }
  - { id: production, label: Isolated runtime }
components:
  - { id: developer, zone: public, label: Developer, identity: Signed commit }
  - { id: attacker, zone: public, label: Untrusted client }
  - { id: pipeline, zone: build, label: CI pipeline }
  - { id: gate, zone: build, label: Policy gate, role: privileged-gate }
  - { id: audit-log, zone: build, label: Audit log }
  - { id: api, zone: production, label: Production gateway }
  - { id: db, zone: production, label: Core database }
  - { id: soc, zone: production, label: Security monitoring }
paths:
  - { id: deploy, from: gate, to: api, kind: permitted, label: Approved artifact }
  - { id: bypass, from: attacker, to: production-boundary, kind: blocked, label: Denied at boundary }
  - { id: audit, from: gate, to: audit-log, kind: audit }
  - { id: monitoring, from: audit-log, to: soc, kind: audit }
steps: ["signed intake", "build and sign", "gate approval", "blocked bypass", "audit record"]
```

Every component belongs to one labeled zone. Each path declares its endpoints, its permitted/blocked/audit meaning, and a text label wherever the meaning is not self-evident. Identities are roles or claims. `steps` define a reveal order over the existing facts and add no second data model.

## Deterministic layout recipe

Use a wide 1160×620 canvas. Allocate three equal vertical trust-zone bands from left to right, separated by strong labeled boundary rules; a design with fewer zones distributes them evenly at equal zone width. Public actors go in the first band, build/approval components in the middle, and runtime/data components in the last. Place the privileged gate before the production boundary. Route authorized deployment through that gate and across the boundary, and route each blocked attempt to a stop marker just before the boundary. Place audit logging as a separate destination reachable from the approval gate and the relevant boundary event, with the monitoring consumer downstream. Draw the zone surfaces first, then connectors, then components and labels. Component positions stay fixed across all variants and motion steps. Motion groups reveal the signed input, build/sign, approval/deployment, blocked attempt, and audit event in that order; the final static frame contains all routes.

## Encoding rules

Permitted paths are solid and labeled; blocked attempts use a contrasting dash pattern plus a stop symbol and a label; audit events use their own consistent line style. The route and the wording carry status alongside color. Accent the single enforcement focus (the gate or the blocked result) and keep the remaining components neutral. The trust-zone boundary is a structural line that works as more than a decorative container. Keep connector crossings clear of any suggestion that an unauthorized route entered production.

## Korean behavior

Use short Korean zone titles and actor names, and keep security terms, identity claims, product names, API names, and protocol codes as authored. Use direct verbs so positive route text reads differently from blocked route text. The final description summarizes both approved and rejected paths in Korean. When a Korean note is longer than the available band, move it to a callout outside the zones and hold the type size.

## Light, dark, and full variants

Light and dark preserve the zone order, paths, stop points, and focus, and only the shared palette tokens change. The full variant may add a compact "why this route is trusted" note outside the architecture bands. All static exports show every boundary and both route classes. Optional motion uses the same final geometry and keeps every blocked path stopped at its boundary.

## Accessibility

Give the SVG a title and description that identify the trusted path, the blocking boundary, the privileged gate, and the audit destination. Provide a text alternative listing each permitted and blocked route as `from → to → result`. Patterns, stop symbols, and labels distinguish the route classes without color. Step controls are keyboard-operable, announce their state, and keep a complete no-motion rendering; follow [Motion](motion.md).

## Verifier gates

Run `node scripts/verify-diagram.mjs` for geometry/overlap, boundary/path bounds, clipping, contrast, skin, accessible SVG, and visible-text checks. Run `node scripts/verify-type.mjs --type=paved-road-animated` for the registered secure-route contract: zone/path budgets and allowed-versus-blocked boundary semantics. Run `node scripts/verify-motion.mjs` for static-first output, ordered deterministic reveals, reduced-motion fallback, and final-frame parity. See [Verifier guide](verifier-guide.md). Confirm that the gallery wrapper's `data-type` value matches this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- A box labeled "security" with no route or enforcement meaning.
- A blocked arrow that crosses into production or visually rejoins an allowed path.
- Unlabeled actor identity, an implied secret, or every component styled as equally trusted.
- More than three zones, eight components, ten paths, or one privileged gate in the overview.
- A color-only denied state, decorative motion, or an animated final state missing from a still/export.
