# Process

**Catalog ID:** `process`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Semantic patterns](semantic-patterns.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Choose Process when the order of steps, the actor who owns each step, and the data or tool handed along all carry meaning. The figure is a responsibility-aware workflow: readers see who performs every step, where a handoff crosses from one lane to another, and which artifact goes in or comes out. Pick Swimlane for a simpler cross-functional flow that needs no payload or tool detail. Pick Sequence when timed messages between system actors are the story.

## Exclusions

This matrix serves owned steps only. Leave aside unowned serial steps, arbitrary many-to-many dependencies, and static ownership censuses. The ceiling is six lanes and twelve steps. A grid cell without activity stays empty, and every connector corresponds to a task the input declares.

## Content schema

```yaml
lanes: [{ key: API, name: [API team] }, { key: OPS, name: [Operations] }]
steps: [{ number: "1", label: Intake }, { number: "2", label: Validate, focal: true }]
nodes:
  - { lane: API, step: 0, title: Receive request, sub: "Request → case", tool: "Portal", chips: { in: null, out: FL } }
  - { lane: OPS, step: 1, title: Verify access, sub: "Case → approved", tool: "Policy check", chips: { in: FL, out: DB }, focal: true }
arrows:
  - { from: { lane: API, step: 0 }, to: { lane: OPS, step: 1 }, style: focal-in }
```

The schema holds 1–6 named lanes, 1–12 ordered steps, explicit occupied cells, and declared arrows. Give lanes short uppercase keys and labels. Each node gets a one-line title, plus an optional short transformation, tool, and input/output artifact codes. Omit the input on first steps and the output on last steps. Declare one focal step and one focal node; the handoff tied to them is the only accent route. Arrow styles are `normal`, `trigger`, `focal-in`, and `focal-out`.

## Deterministic layout recipe

Set `label_col_w=140`, `step_slot_w=112`, `right_pad=28`, `header_h=36`, and `lane_h=80`. Canvas width is `140 + 112×step_count + 28`. Canvas height is `36 + 80×lane_count + legend_height`, where the legend takes 100px when a concern-color row exists and 80px otherwise. Lane `k` starts at `36+80k`; the center of step `j` sits at `140+8+112j+50`. Center each 100×64 node in its step slot with an 8px vertical lane inset. Empty cells render nothing. Route a cross-lane arrow with a single right-angle bend: leave the source's right edge, run through the corridor ahead of the destination, then enter at the destination's top or bottom. Adjacent steps in one lane may connect with a horizontal line. Paint all arrows first and all nodes afterward. When routes cross, reorder the steps or split the diagram; extra bends stay out.

## Encoding rules

Topology picks the line style. Triggers are dashed, ordinary transfers are muted solid, and only arrows entering or leaving the single focal node take the accent. Node color may flag a concern (security, quality, publication, backup); it is optional, capped at three non-focal elements, and leaves arrow color untouched. Add artifact chips for known payload types and leave unknown payloads absent. Tool and sub-label ink stays muted even on colored nodes. The legend lists the styles that appear in the figure.

## Korean behavior

Lane keys, units, file formats, and tool names remain in Latin characters. Korean lane names may wrap onto two balanced lines. Step labels stay short, and node titles fit one line, or use two lines with the chips dropped. A unit stays attached to its value, and a path or API token stays whole at punctuation. Apply the shared Korean line-height, and widen the canvas or abbreviate before shrinking type.

## Light, dark, and full variants

Light and dark share the same input, viewBox formulas, connector routes, and semantic colors; only token values change, with custom hues lightened enough to keep contrast on the dark surface. The full variant seats the same grid inside an editorial frame and may add a small summary strip. Lanes, process steps, and arrow semantics stay exactly as in the base grid.

## Accessibility

Give the SVG a title and a concise description covering the actors, the step direction, the focal handoff, and any trigger. Supply an ordered text alternative by step, then by lane. Mark triggers with a dash pattern as well as wording, and mark payload types with a text code so color is never the only signal. Keep every connector behind the nodes, and hold node labels above the minimum readable size.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for geometry and overlap, connector bounds, clipped labels, contrast, skin parity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=process` to validate the catalog marker. Review lane and step limits, occupied-cell uniqueness, focal declarations, endpoints, and arrow topology against this guide. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID, since a missing or mismatched marker fails the type check.

## Anti-patterns

- Placeholder boxes in empty lane/step cells, or lanes without labels.
- Diagonal connectors, multiple bends, left-side entry, or crossings hidden under nodes.
- A second focal step or node, colored arrows, or custom colors on focal elements.
- Payload chips on nodes with a wrapped title or an unknown payload.
- Twelve-plus steps, seven-plus lanes, or long prose inside nodes.
