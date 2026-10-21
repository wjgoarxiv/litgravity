# Story map

**Catalog ID:** `story-map`

## Purpose and selection

Pick a story map to present one persona's end-to-end narrative together with the way user-visible stories are sliced into releases. The release cut is mandatory, because a figure without it reads as a backlog grid and loses its value as a planning map. Pick Kanban for work state, a user journey for stages and sentiment, and a timeline for dated milestones.

## Content schema

Provide one persona, up to five ordered activities, one or two walking-skeleton user steps under each activity, and up to three release slices. Each story card states a user-visible outcome and belongs to exactly one activity and one slice. Name the single highest-risk story. Place a release cut after the first slice and add a short source/context note.

## Deterministic layout recipe

1. Lay activity headers from left to right in the persona's narrative order, with a consistent 200 px card width, 24 px gutters, and shared baselines. Narrative sequence decides the order.
2. Directly below, align each activity's user steps on one walking-skeleton row. Step cards are 32 px tall, and two step slots are reserved per activity so the row stays level when an activity has a single step.
3. Add release bands underneath and label them in a fixed 96 px left margin. Story cards are 48 px tall and sit in their activity column. A subtle vertical column rule runs through every release row with gaps, so empty space still reads as part of its activity.
4. Draw one horizontal release-cut rule right after the first slice and label it `RELEASE CUT`. This rule is accent target one. Only the highest-risk story card receives the second accent treatment, together with an explicit `RISK` tag.
5. Close with a compact legend and a source/context line. The whole map stays within five activities, three slices, twelve story cards in total, and four cards per slice. Fold the long tail into a named “Later” slice, or split the map by persona when needed.

## Visual encoding

Backbone cards are wider than story cards, and the steps form the thin row between them. Release bands take low-contrast backgrounds or hairlines, and the release cut is a strong rule. Card text, activity-column position, and row label carry the meaning. Spend exactly two accent targets: the release cut and the single highest-risk story card, whose `RISK` tag belongs to the same cue. Stories describe user outcomes. Slice names describe scope (`MVP`, `Next`, `Later`), which stays valid when dates slip.

## Korean text

Write short Korean activity and story phrases from the single persona's perspective, set in Pretendard. Each story outcome is concrete and user-visible. Reuse the same activity vocabulary across the backbone and related documents. When ticket IDs or estimates appear, render them in mono and keep them exactly as given. Outcome-based slice labels such as `첫 출시`, `다음`, `이후` work well; follow [Korean typography](korean-typography.md) for spacing and line breaks.

## Light, dark, and full variants

Column order, story placement, and cut position match across the light, dark, and full variants. Switch semantic tokens for light and dark, and confirm the release rule stays visible. The full variant may add a title, a brief takeaway, and a source note around the same map, with the release cut and card layout unchanged.

## Accessibility

Add a title and description stating the persona, the narrative direction, the slices, and where the release cut falls. Label every activity column and release row. The cut is identifiable by a line and by text, and risk is marked with a tag and a border in addition to color. Keep contrast readable on band fills, and make the row/column relationship apparent without card color.

## Verifier gates

Run `scripts/verify-diagram.mjs` for geometry, overlap, clipping, contrast, skin, visible-text, and a11y. Run `scripts/verify-type.mjs --type=story-map` for activity/slice/card caps, alignment, release-cut presence, and accent budget. Review at PPTX and DOCX target dimensions, because small cards that pass the layout check may still need shorter text.

## Anti-patterns

- A missing release cut, more than three slices, or date-named slices standing in for scope.
- Activities ordered by priority instead of narrative sequence.
- Stories that describe internal refactoring instead of a user outcome.
- Multiple personas, Kanban state columns, or a sentiment curve in one map.
- Cards floating outside an activity column when a slice has gaps.
- More than two accent targets, or a release cut encoded by color alone.

## Related references

[Kanban](type-kanban.md) · [User journey](type-journey.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
