# Data Platform Security Matrix

**Catalog ID:** dp-security-matrix

## Purpose and selection

Pick a permissions matrix to audit which roles can perform which actions on data-platform components. Rows are resources and columns are roles or groups. DP integration fits when the question is which systems connect and by what protocol. A process or sequence type fits an explanation of how access is granted.

## Content schema

Declare 2–6 ordered roles and 2–14 ordered components. Each role has a visible name and an optional group identifier, and each component has a name and an optional short hint. Supply a complete permission for every role/resource pair; an omitted cell means the declared "no access" state only when that is factually correct. Use a closed permission class: full/admin, read-write, read, or none. Display text can be "SELECT", "Login", or a domain term, and its class stays explicit. Mark zero or one focal cell and optionally add a short explanation line.

## Deterministic layout recipe

The resource-name column comes first, followed by the role columns. Reserve 208px for resources, 148px for each role column, 16px column gaps, 12px left padding, and 48px right padding. The role header is 52px high. Resource rows start at y=140 with a 40px row pitch and 36px cell height. Width follows the role count and height follows the resource count, with the legend placed below the final row. Values are centered in cells and component names are left aligned.

Every cell shares the same border and text alignment. Permission classes differ through a restrained fill plus explicit displayed permission words, and the matrix has no arrows. Once six roles or fourteen resources are exceeded, split the matrix by role family or platform domain.

## Encoding rules

Cell text is the policy, and tone only reinforces it. Apply the same class-to-style mapping in every row and every theme. Accent a single critical rule instead of a whole row or column. Show a legend only for permission classes present. Unknown or unreviewed access is a distinct state from "none"; missing evidence never becomes an implied denial.

## Korean behavior

Use Korean role names and resource hints where the organization uses them. Group IDs, database permissions, and exact role names remain technical identifiers. Pretendard sets Korean headers, and mono covers literal group or permission codes only. Keep all cells tall enough for Hangul, and when labels need two lines, increase the shared row height so every cell keeps its text size.

## Light, dark, and full variants

Light uses neutral cells and one accent focal cell. Dark uses a dark surface with distinct permission-class tones, visible cell boundaries, and readable text; check every class for contrast against fresh dark fills. Full adds a title, the scope, and a concise legend, and lists only permissions that exist. Matrix dimensions and all values stay fixed between variants.

## Accessibility

Expose the matrix as a semantic table or provide an equivalent table next to the SVG. Give column and row headers proper associations. Permission meaning appears as text, with color as a supplement. The description names the focal access rule and states how "no access" is represented. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for contrast, text clipping, accessibility, and theme checks. Run scripts/verify-type.mjs --type=dp-security-matrix for complete cell coverage, closed permission classes, matrix bounds, and focal-cell limits. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Connectors drawn between cells.
- An omitted or unknown permission treated as "no access".
- Whole rows or columns highlighted when one intersection is the claim.
- Unrestricted free-form categories that make styles incomparable.
- An organization-wide role list crammed into unreadable columns.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
