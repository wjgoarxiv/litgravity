# PowerPoint and Word delivery

Design on the final page ratio, keep labels live, and leave room for the document's own title and surrounding text.

## Canvas and safe margins

| Destination | Canvas ratio | Diagram inset |
|---|---:|---:|
| PowerPoint widescreen | 16:9, 1280 × 720 | 5% on each edge |
| PowerPoint standard | 4:3, 960 × 720 | 5% on each edge |
| Word inline | 16:10, 960 × 600 | 40px |
| Word landscape/wide | 16:9, 1200 × 675 | 4% on each edge |

Titles and key labels stay inside the inset, away from the crop edge. Dense content becomes a second detail diagram, and type size stays where it is.

## Light and dark use

- Light is the default for Word, print and shared slide decks.
- Dark fits a presentation that uses a dark canvas throughout. The slide background behind the diagram is dark as well, so no light rectangle looks pasted on.
- Full-editorial suits a figure that needs its own title and key. A caption that Word or PowerPoint already provides is left to the document.
- Check the real projection or page size. A laptop preview cannot stand in for the final slide scale.

## PNG

Raster delivery uses a 3× PNG. A 1280 × 720 source canvas then yields 3840 × 2160. Use 1× or 2× when file size or the destination demands it. Check the background and the transparent edges before placing the image.

## Office-safe SVG

SVG gives crisp vector scaling. Office-safe mode applies the conservative rules in `references/export.md` and embeds the bundled font where possible. It strips unsupported filters, external references, CSS variables in presentation attributes and remote resources. Colors stay explicit hex values with opacity attributes.

The skill produces Office-safe SVG and high-resolution PNG files and builds no PPTX or DOCX container. For an Office check, place the export in the intended document and inspect it in the available Office renderer at final size. A valid SVG file leaves Office rendering unproven. When an Office installation fails to render the embedded font or the SVG, report that limit and supply the 3× PNG.

## Word figures

- A short figure title and description sit in the nearby document text.
- A caption field outside the image handles numbering and cross-references.
- Alt text matches the SVG title and description.
- Check the image at 100% and at page width. When PDF is part of delivery, confirm that caption, labels and margins survive the PDF export.

## Placement note

The SVG and PNG exports hold the diagram alone, with no editor controls and no decorative web-page header. Place the result as a picture, and keep the source HTML or SVG beside the document for later edits.
