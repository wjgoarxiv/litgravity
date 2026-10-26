# Journal figures of apparatus and equipment

An apparatus figure in a paper answers one question: what did the experiment use, and how was it connected? A reviewer reads it beside the methods section, often printed in grey, sometimes reduced. Everything here is about surviving that reading.

## Contents
1. Size
2. Type
3. Lines and colour
4. Panels
5. What goes in the art and what goes in the caption
6. Korean labels
7. Export
8. Publisher notes

## 1. Size

Draw at final size; never scale a figure afterwards, because type and lines scale with it.

| Width | mm | Kit |
| --- | --- | --- |
| Single column | 85 (Elsevier 90, ACS 82.5, Nature 89) | `createFigure({ width: "single" })` |
| One and a half | 120–140 | `"onehalf"` |
| Double column | 178 (Elsevier 190, ACS 178, Nature 183) | `"double"` |

Use the target journal's own numbers when the user names it (`createFigure({ width: 183 })`). Height is what the content needs, at most 230 mm; an apparatus figure is usually 60–100 mm tall. Check the current author guidelines when submission accuracy matters; numbers here can go stale.

## 2. Type

- **7 pt** for labels (`JOURNAL.textPt`), **8 pt bold** for panel labels, never under **6 pt** at print size; the QA gate fails anything smaller (`TEXT.MIN_SIZE`).
- One sans family: **Arial** (Helvetica-compatible) for Latin text; it is what most publishers ask for and Chrome embeds it in a PDF as real TrueType text.
- Sentence case, no full stops on labels; units with a space (`5 MPa`, `2 °C`); chemical formulas with true subscripts when the font allows, otherwise plain (`CO2`) consistently.
- No title inside the art: the caption is the title.

## 3. Lines and colour

- Lines 0.5–1 pt (0.18–0.35 mm); nothing under 0.25 pt (`STROKE.MIN`). Stream lines 1 pt, symbol outlines 1–1.4 pt.
- **Colour-vision-safe stream roles** (Okabe–Ito): gas blue `#0072B2`, liquid sky `#56B4E9`, coolant green `#009E73`, heating vermillion `#D55E00`, sample purple `#CC79A7`, vacuum orange `#E69F00` dashed, vent grey dashed, signal grey dashed. `PALETTE.CVD` fails two role colours that become hard to tell apart under normal, deuteranopic, protanopic or tritanopic vision.
- **Colour is never the only carrier.** Vent, vacuum and signal lines also differ by dash; every role used is in the key (`fig.key`), and the caption can name the streams.
- Figures print in grey: check the PNG in greyscale when streams differ only by hue.

## 4. Panels

- Label panels **(a), (b), …** at their top left, bold 8 pt, in reading order left to right, top to bottom (`PANEL.LABELS` checks order, size and position).
- Each panel makes one point: (a) the flow scheme, (b) the cell or column in detail, (c) a photograph or a measured result (that panel belongs to `lit-scientific-visualization`; leave it a box and say so).
- Align panel edges; give the 3D panel enough width for its callouts, or put its callouts on one side.
- A shared key goes once, under the panels.

## 5. What goes in the art and what goes in the caption

| In the art | In the caption |
| --- | --- |
| Equipment names (`Column`, `MS`, `MFC`), short and consistent with the methods | What the apparatus does and the experimental sequence |
| Stream key | Model numbers, suppliers, dimensions not visible in the art |
| Panel labels | The meaning of each panel |
| One number when it is the point (`26 mm ID`) | Operating ranges, uncertainties |

Tags such as `PT-1` belong in a methods-style figure only when the text refers to them; otherwise use names (`Pressure transducer`). Journal canvases label equipment with `name` and fall back to the tag.

## 6. Korean labels

Hangul labels use **Pretendard** for the whole label (`fontFor` switches automatically when a label contains Hangul). Keep units and formulas in Latin (`압력 5 MPa`, `CO2 공급`). Korean labels run wider: allow about 1 em per syllable. The renderer loads Pretendard from this plugin; in the SVG the family name stays `Pretendard` with system fallbacks. For an English paper with Korean annotations remove the Korean before submission.

## 7. Export

- **SVG**: the editable master, vector, millimetre-sized.
- **PDF**: `render.mjs --pdf`; vector, page size equals the figure size (`PDF.SIZE`). Latin text in Arial is embedded as TrueType text. Chrome embeds Pretendard (a CFF variable font) as **Type 3** glyphs; some checkers (for example IEEE PDF eXpress) reject Type 3, so for those journals keep labels in Latin or submit the PNG/TIFF.
- **PNG**: `render.mjs --png --dpi 600` (line art: 600–1200 dpi; 1000+ when the journal asks for line-art TIFF). The file records its resolution in a pHYs chunk; `qa.mjs --png` checks the resolution and that the pixel width matches the drawing width.
- Name files by figure number (`fig2-apparatus.pdf`).

## 8. Publisher notes

Commonly published values, to confirm against the current guide: Elsevier lists Arial, Courier, Times and Symbol, column widths of 90/140/190 mm and 1000 dpi for line-art TIFF; ACS uses 3.25 in and 7 in columns, Helvetica or Arial, and 1200 dpi line art; Nature uses 89/183 mm and Helvetica or Arial at 5–7 pt; RSC uses 8.3/17.1 cm columns. Korean journals (대한화학회, 한국화학공학회): follow the template; Hangul in a sans such as Pretendard or 맑은 고딕. Always confirm the current guide for the target journal.
