# Nested containment

**Catalog ID:** `nested`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Pick Nested when the meaning comes from one boundary sitting inside another: scope inheritance, trust zones, blast radius, workspace ownership, or a document/configuration cascade. The outside ring is the broadest scope, and each ring inward narrows it. Choose it only when every level has exactly one child scope. Branching parent/child structures go to Tree or Org chart, and broad infrastructure zones that do not nest go to Architecture.

## Exclusions

Concentric rings fit containment alone, so steps, quantities, cross-links, peer groups, and several children of one parent belong to other grammars. Every ring should hold facts about its own scope. When a boundary has a side branch, split the diagram or switch to a grammar that supports branching.

## Content schema

```yaml
title: "Which policy applies here?"
levels:                         # outermost to innermost; 2–6, preferably 3–5
  - { id: org, label: Organization, detail: "Baseline controls" }
  - { id: team, label: Team, detail: "Team overrides" }
  - { id: repo, label: Repository, detail: "Local configuration" }
  - { id: task, label: Task, detail: "Current request" }
focal_id: task                  # optional; at most one
annotations: []                 # optional; at most two short callouts
```

Every level needs a stable ID and a concise name. `detail` is optional and must fit inside its level at full text size. A level may hold a single short example or file marker, and any second hierarchy belongs in a separate diagram.

## Deterministic layout recipe

Use a 1000×600 SVG viewBox. Place the outer boundary at `(40, 56)` with width `920` and height `488`. For `n` levels, inset each level by 32px horizontally and 28px vertically: level `i` has `x=40+32i`, `y=56+28i`, `w=920−64i`, `h=488−56i`. Draw from outer to inner so later rings sit above earlier strokes. Put each label in a small paper-backed tab on the top-left border, aligned to a common x inset, and center one short detail line inside the remaining clear region. Keep text and any icon clear of the next ring. At 6 levels, omit inner detail to avoid overlap. Place up to two annotations outside the rings and connect each with a thin leader that touches no other boundary.

## Encoding rules

Containment is carried by position and enclosure only. Use a consistent gap between rings, a quiet neutral stroke ramp from outer to inner, and at most one accent boundary for the selected focal scope. Keep ring width, area, and opacity uniform so they imply no size or importance. Use a simple folded-corner/file mark only when the enclosed item really is a document or configuration. The output stays static.

## Korean behavior

Korean and English share the same ring geometry. Prefer short Korean scope nouns, and keep product names, paths, and identifiers unbroken. Center text in the available interior and apply the Korean reference's line height. When a Korean label needs a second line, wrap at a word boundary and keep the label tab on one line; shorten or omit secondary detail before reducing type size.

## Light, dark, and full variants

Light and dark variants share coordinates, labels, and hierarchy, and switch only the shared surface, ink, rule, and accent tokens. The accent stays on the same level in both. The full variant may place the ring diagram, unchanged, in the editorial frame with one title, a short reading note, and at most two callouts. The frame adds no extra rings.

## Accessibility

Give the SVG a concise title and a description naming the containment order from broadest to narrowest. Provide a text outline in DOM order matching the outer-to-inner order. Each boundary stays distinguishable without color through labels, enclosure, and stroke contrast. Decorative icons are hidden from assistive technology. Keep labels in reading order, and show visible focus only if an interactive host adds controls, since the diagram itself has none.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for geometry, label bounds, off-canvas content, contrast, skin consistency, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=nested` to validate the catalog marker. No specialized numeric contract is registered, so review containment order, level budget, bounds, and label tabs here. See [Verifier guide](verifier-guide.md). Confirm that the gallery wrapper's `data-type` value matches this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- More than six rings, or inconsistent gaps that make the nesting look accidental.
- Branches or cross-links drawn by squeezing sibling scopes into one ring.
- A title or detail crossing a boundary or sitting over the next label tab.
- Accent on multiple levels, which erases the hierarchy of attention.
- Fill gradients, shadows, or oversized nested cards that compete with the boundaries.
