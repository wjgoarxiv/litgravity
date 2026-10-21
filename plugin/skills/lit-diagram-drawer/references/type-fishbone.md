# Fishbone Root-Cause Diagram

**Catalog ID:** fishbone

## Purpose and selection

A fishbone organizes the candidate causes investigated for one observed effect. In a postmortem it shows how evidence was grouped and where a confirmed cause sits. Choose a timeline or sequence diagram when events unfolded in order, and a causal graph when causes form a directed chain or interact across branches.

## Content schema

Name one observable effect, worded as a symptom or a measurement and kept free of remedies. Supply 3–5 investigation categories with 1–3 specific sub-causes each. Mark at most one confirmed root cause and separate it visibly from the candidates still open. Category names come from the real investigation and replace any blank “6M” checklist. When evidence status shapes interpretation, add it in a short note.

## Deterministic layout recipe

Use a 1480 × 600 viewBox that starts at x=−40, with the spine centered at y=320 and the effect box starting at x=1200. For bone k from 1 through 5, attach it to the spine at x=1200−160−160k. Alternate bones above and below the spine. A bone's category endpoint sits 96px to the left and 168px above or below its attachment. These 60-degree diagonals define the grammar and are the single exception to orthogonal routing. The category label goes at the far endpoint. Two sub-cause ticks sit at one-third and two-thirds of each bone, a single item sits at the midpoint, every tick is 32px long, and one concise label sits beyond its open end. The default five-bone frame already reaches its left bound. A sixth bone needs the effect position and the viewBox widened by at least 160px, or the analysis split in two.

Draw in this order: spine, category bones, ticks, labels, effect box. Keep geometry consistent per category and category order stable. Spend the two-item accent budget on the confirmed cause branch and the effect, and leave candidate branches neutral. Keep the outer category tags and the effect box inside the declared viewBox.

## Encoding rules

The spine points at the observed effect. Large bones stand for cause categories, and short ticks stand for sub-causes. Candidate and confirmed findings differ in their text. Accent belongs to one confirmed branch and the effect. Category lines share one neutral treatment instead of a color each.

## Korean behavior

Write the observed effect and the category and sub-cause labels in Korean when that suits the audience. Keep metric names and units exact, for example p95/p99, latency, or error rate. Set cause text in Pretendard and measurements in mono. Give diagonal labels room to stay horizontal, and keep Korean text unrotated along a bone. Keep evidence status concise and free of internal ticket syntax.

## Light, dark, and full variants

Light pairs a clear neutral spine with quiet candidate bones, and the confirmed branch takes the single accent. Dark moves the spine and labels to an accessible light-on-dark ramp. Full may add a compact summary of confirmed versus open causes below the same drawing, worded so that every open hypothesis reads as open.

## Accessibility

Open the description with the effect, then list categories and sub-causes in a logical reading order. Say which cause is confirmed, in words, since accent alone leaves that distinction to color. Offer the cause list as adjacent text or a table. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for bounds, overlaps, text fit, contrast, and accessibility. Run scripts/verify-type.mjs --type=fishbone for bone and sub-cause counts, branch geometry, the confirmed-cause budget, and effect-box bounds. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Drawing a timeline as a fishbone.
- Wording the effect as a remedy.
- Adding empty generic cause categories to fill a template.
- Giving several causes confirmed status with the same focal treatment.
- Adding a sixth diagonal branch that clips the effect box at the canvas edge.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Annotation primitives](primitive-annotation.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
