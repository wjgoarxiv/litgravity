# Entity–Relationship Model

**Catalog ID:** er

## Purpose and selection

Pick ER for conceptual or logical data models whose message lives in entities, their attributes, and the cardinality of each relationship. Edges join entity boxes and show multiplicity at both ends. When the reader needs real SQL types, indexes, constraints, delete actions, or column-to-column foreign keys, switch to the database schema type.

## Content schema

Give every entity a stable ID, a visible name, and a short field list. Flag the key field, and flag foreign-key references where they help. Give every relationship a source entity, a target entity, a cardinality for each end, and optionally a verb phrase. Keep the view to a domain slice a reader can absorb; a drawing with dozens of entities splits by bounded context, and every relationship stays visible in one slice or another.

## Deterministic layout recipe

Work on a 1000px canvas with 32px margins. Seat the central aggregate or focal entity near the horizontal center. Fill the nearest surrounding columns with its directly related entities, and order peers by domain or name so placement is stable. Each entity box carries a header band over a field list sized to its content, so box heights vary naturally. Paint relationship lines first and entity surfaces after them. Route edges as orthogonal paths with rounded elbows, and use straight horizontal or vertical runs for aligned entities. Set each cardinality just outside the entity boundary, and set each label near the line midpoint on an opaque background.

If relationships outgrow the space, group entities into clusters with a legend, or split the domain. Add arrowheads only when direction carries domain meaning. Cardinality is mandatory with or without an arrow.

## Encoding rules

The entity name leads and fields follow. Text markers PK and FK identify keys, with color as a supplement at most. Pick one cardinality notation and apply it at both ends of every edge. A single central entity may take accent emphasis. Relationship names are optional and work best as brief verbs such as “places” or “belongs to”.

## Korean behavior

Write domain names and relationship verbs in Korean when the team models in Korean. Put exact database or API identifiers in parentheses or a technical sublabel. Set entity names and Korean descriptions in Pretendard, and field IDs and key markers in mono. Leave cardinality symbols untranslated and add a Korean accessible explanation when the audience needs one. Wrap Korean field text at safe word boundaries.

## Light, dark, and full variants

Light offers a quiet field, crisp entity dividers, and one focal entity. Dark carries separate tokens for text, fields, and connectors, each checked for contrast. Full adds a short model scope and a note on any omitted subdomain, with no decorative cards behind entities. Entity placement and relationship semantics match across all variants.

## Accessibility

Supply a text or table alternative that lists entities, their fields, and both cardinalities of each relationship. Add an accessible description of the model boundary and the focal entity. State key status in text so that color and position are supplementary cues. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs to check edge overlaps, clipping, contrast, labels, and accessibility. Run scripts/verify-type.mjs --type=er to check entity and relationship reference integrity plus the presence and consistency of cardinality. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Drawing every foreign key as an edge on a very large model.
- Mixing physical SQL details into a conceptual domain model.
- Switching cardinality notation between related edges.
- Padding entity boxes to equalize their heights.
- Leaving an endpoint cardinality implied by line shape.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
