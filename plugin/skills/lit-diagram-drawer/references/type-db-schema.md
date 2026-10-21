# Database Schema

**Catalog ID:** db-schema

## Purpose and selection

Pick a database-schema diagram for physical tables, columns, SQL types, constraints, indexes, and foreign keys anchored to particular columns. It supports reviewing a migration or explaining deletion and nullability behavior. ER fits discussion of conceptual entities and relationship cardinalities, where real columns and types are secondary.

## Content schema

Supply 2–5 tables. Each has a schema-qualified name, an ordered column list, the exact SQL type of each column, and optional constraint flags such as primary key, foreign key, unique, and not-null. Display at most 8 columns per table, adding an explicit "N more" row when a table is shortened. Declare foreign-key source and target column IDs together with the referential action. Optionally list indexes, limited to those relevant to the story. Keep names distinct and copy the actual database spelling.

## Deterministic layout recipe

The canvas is 1000px wide with a 24px table gutter and a fixed table width derived from the longest displayed identifier, capped at 260px. Order tables by schema and then table name, and place related tables in nearby columns. Each header is 40px and each column row is 24px; these fixed row centers are the connector anchors. Paint schema boundaries first, then FK routes, then table surfaces, rows, constraints, and labels.

Foreign-key lines run from the center of the actual source column row to the center of the referenced row. Use rounded orthogonal routes with an 8px bend and reserve 12px separation among multiple edges. Edges that share a column-row anchor fan out their starting points symmetrically within that row. Each edge carries a short referential-action label on an opaque background mask. When routes would cross table text, grow the canvas or split the schema.

## Encoding rules

Typography and constraint labels distinguish column roles, with color left out of that job. SQL types use a mono role aligned to the right. Show PK, FK, UQ, and NN tags only where they help the review. Accent at most one consequential delete action and its affected table header, when the schema contains such a rule. Indexes sit in a separate final compartment, limited to those relevant to the claim.

## Korean behavior

Physical table, column, constraint, and SQL type names stay exactly as written in the database. Korean notes carry business meaning, and database-specific abbreviations get one explanation. Pretendard sets explanatory labels and mono sets SQL. Grow the table width, or wrap only descriptive text, to fit Hangul in narrow type and name columns. FK labels use the literal SQL action spelling.

## Light, dark, and full variants

Light uses clear row separators and a subtle alternating row tint. Dark rebuilds table, row, and connector contrast with dark-surface tokens around the same schema. Full adds a title, migration context, and a brief impact note outside the tables, and every column and relationship in it is already in the schema.

## Accessibility

Include a textual schema summary and a table representation with column names, types, and constraints. The SVG description identifies the tables and important FK actions. Express PK/FK meaning as text, with hue as a supplement. Keep row labels and action labels readable at export scale. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for table clipping, route collisions, contrast, accessibility, and visible text. Run scripts/verify-type.mjs --type=db-schema for row-anchor alignment, FK resolution, constraint labels, and table/column budgets. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Every column of a large production database.
- Connectors between table boxes in place of the specific foreign-key rows.
- Missing SQL types or referential actions that are the subject of the review.
- Conceptual entity names mixed with physical table names.
- Every table colored, or every index listed.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
