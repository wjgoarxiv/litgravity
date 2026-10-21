# UML class diagram

**Catalog ID:** `uml-class`

## Purpose and selection

Pick this diagram for static object structure when operations, inheritance, composition, or typed class relationships matter. Pick an ER diagram for entities, attributes, and cardinality, and Sequence, State, Swimlane, or Architecture for the matching UML behavior, state, activity, or deployment views. This guide covers class-diagram grammar only.

## Content schema

Prepare up to seven classes, each with a name, an optional `interface` stereotype or abstract marker, selected attributes, and meaningful operations. Each member carries visibility, name, and type/signature. Prepare up to eight relationships drawn from the defined vocabulary: inheritance, realization, composition, aggregation, association, or dependency. Association endpoints state multiplicity. Choose one focal class and list all six relationship kinds in a compact legend so the notation is unambiguous.

## Deterministic layout recipe

1. Group classes by package or domain role, then seat the focal/base type centrally with subclasses or implementers nearby. Straight links or a single orthogonal elbow per relationship work best. When routes cross repeatedly, split by package.
2. Draw each class as one content-sized box with up to three compartments: centered name, attributes, operations. Empty compartments are omitted, and box heights follow their content. Each member stays on one line, and anything beyond five members in a compartment becomes an explicit ellipsis or moves to a separate detail view.
3. Draw connectors before boxes with orthogonal routes and rounded elbows. Use fan-out attach points spaced far enough apart to distinguish parallel relationships. Labels sit on opaque paper masks with clear space around the line.
4. Place multiplicities close to the association endpoints on both sides. The composition or aggregation diamond sits at the owner end. Define every marker in the SVG and include all six notations in the legend, unused ones included.
5. Hold to seven classes, eight relationships, five members per compartment, and two accent elements. Four or five classes is the normal target, and dense packages are split so the text keeps its size.

## Visual encoding

Use a stable, explicit line and endpoint vocabulary: inheritance is a solid line with a hollow triangle; realization is a dashed line with a hollow triangle; composition has a filled ownership diamond; aggregation has a hollow ownership diamond; association uses an open arrowhead and multiplicities; dependency is a dashed open arrow. Keep composition and aggregation as distinct notations. The accent marks the focal class and, as one grouped cue, its inbound inheritance/realization edges. Visibility symbols and signatures stay in mono.

## Korean text

Set class names and short stereotypes in Pretendard, and typed attributes, method signatures, visibility signs, and multiplicities in mono. Source-language identifiers that are code symbols stay verbatim, with a concise Korean caption to explain them when needed. Keep each method signature on one line. Follow [Korean typography](korean-typography.md) for Hangul line height and mixed names.

## Light, dark, and full variants

Class positions, compartments, relationship types, and multiplicities match across the three skins. Hollow marker interiors take the paper token and outlines take semantic line tokens. The full editorial form may add package framing and a short explanation of the focal class, listing only the declared classes and members. Check every marker against the background after export.

## Accessibility

Supply a title and description naming the domain, the focal class, and the most important relationships. Line style and arrowhead shape repeat what the legend text says, so line color is a supplement. Keep multiplicities and members readable, and make sure an SVG reader can reach class names and relation labels in a sensible order.

## Verifier gates

Run `scripts/verify-diagram.mjs` for clipping, overlap, connector geometry, contrast, skin, visible-text, and a11y. Run `scripts/verify-type.mjs --type=uml-class` for class/member caps, marker vocabulary, relationship direction, multiplicities, and connector joins. Inspect dense elbow crossings and all six legend keys at presentation size.

## Anti-patterns

- Every getter, setter, or implementation detail listed in place of the members that explain the model.
- Class boxes used when the story is entity fields and cardinalities.
- Composition and aggregation used as synonyms, or association without endpoint multiplicities.
- Diagonal connectors, omitted legend markers, or unlabeled stereotype symbols.
- Equal-height boxes with large empty compartments.
- Accent on several unrelated classes or relationship kinds.

## Related references

[ER diagram](type-er.md) · [Sequence](type-sequence.md) · [State machine](type-state.md) · [Architecture](type-architecture.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
