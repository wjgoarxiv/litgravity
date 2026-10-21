# Beeswarm

**Catalog ID:** beeswarm

## Purpose and selection

Pick a beeswarm when every observation should stay visible and the shape or tail of the distribution matters more than one summary number. Each dot is a single item on one shared value axis, and the perpendicular spread exists only to pack marks apart. A histogram suits a broad distribution, a scatter plot suits two variables, and a ridgeline suits comparing several groups. A handful of values reads better as a table, and a crowd above roughly 300 items should be binned. Route analysis of measured scientific data to the dedicated scientific-visualization skill.

## Content schema

Supply a stable item ID, one finite numeric value, a unit, and a declared linear domain. Include 20–300 items. Mark at most one focal observation and name no more than six points in total. State the domain, the sample count, and the omitted count if any, and say outright that the swarm offset carries no value. Dot size, color, and vertical ordering stay free of a second variable.

## Deterministic layout recipe

Set the viewBox to 1000 × 500, with plot x=80..960 and the horizontal value axis at y=420. Place 4–6 ticks at equal value intervals, bind each printed label to its numeric tick, and draw vertical guides only. Every dot shares one fixed radius. Map each value to x with the same linear formula, sort by value and then by stable ID, and give each item the first free vertical slot, alternating above and below a centerline; slot pitch is at least two radii plus a gap. The packing repeats exactly and every x-position stays exact.

Check collisions once packing is done. When the band grows too tall, split the data, switch to a histogram, or trim the item set with an explicit omission note, and keep every item at its true place on the value axis. Place any outlier label outside the cloud with a leader and a stable item binding. Store positions directly on each mark. After verification, leave dots, bound labels, ticks, and their parent groups free of SVG transforms and CSS positioning.

## Encoding rules

Horizontal position is the only quantitative encoding, and vertical position serves packing alone. Every dot has the same size and a shared non-focal fill. Use at most one accent dot, with a label that names the observation. Keep a data-to-mark binding for each circle and a data-to-text binding for every visible label and tick. Count omitted observations in a note.

## Korean behavior

Write the title, axis explanation, and summary in Korean, and keep IDs and exact service names as given. Pretendard sets prose and a mono face sets IDs and ticks. Apply Korean locale formatting to visible values and keep unrounded machine values in the data bindings. State the axis unit once and keep each tick concise. The legend says explicitly that the swarm thickness is not a scale.

## Light, dark, and full variants

Light uses one consistent ink fill for ordinary points, a clear stroke, and neutral gridlines. Dark uses a separately tested neutral point ramp and visible axis marks. Full may add the sample summary and a short note outside the plot. The point set, domain, radius, and packing algorithm are identical in all variants.

## Accessibility

Describe the distribution, sample count, axis bounds, and the non-quantitative nature of the vertical spread in a concise description. Supply a downloadable or adjacent table when item-level access is required. Give every mark a cue beyond color. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for clipping, contrast, accessibility, and visible text. Run scripts/verify-type.mjs --type=beeswarm for one-value binding, shared scale, constant radius/fill, collision-free packing, point limits, label bindings, and tick fidelity. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Nudging a dot along the value axis to relieve crowding, or shifting a verified mark with CSS.
- Overprinted dots that encode density as darkness.
- A perpendicular dodge sorted by a second quantity.
- Observations dropped or averaged without disclosure.
- Size or opacity that implies another variable.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
