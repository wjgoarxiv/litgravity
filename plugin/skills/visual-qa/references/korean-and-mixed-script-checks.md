# Korean and mixed-script checks

Korean text widens, wraps and falls back differently from Latin text. These checks apply whenever the product is localized to Korean, accepts Korean input, or mixes Hangul with Latin letters, digits and symbols. Run them in addition to the standard sweep.

## What to prepare

- A string set per surface: a short label, a typical sentence, a long sentence of about 60 syllables with no spaces inside the longest word, a mixed line (`LitGravity 설정 v1.2 (베타)`), a line with digits and units (`3,200원 · 12개`), a combining-mark sample, and one emoji sequence.
- The font stack in the manifest's `capture_environment.font_set`. A capture without it cannot be compared later.
- The expansion test: take the English or short Korean string and lengthen it by 30 %. Layouts that only fit the shortest label are defects waiting for the next translation.

## Wrapping and line breaking

| Check | Pass condition | Failure signal |
|---|---|---|
| Word-level breaks | Lines break at spaces; a Hangul word stays whole (`word-break: keep-all` or an equivalent) | A word splits mid-syllable group in body text |
| Long unbroken tokens | URLs, file paths and identifiers wrap with `overflow-wrap` or scroll inside their own box | A token pushes the container wider than the viewport |
| Headings | Two-line headings balance without a single orphan syllable | One syllable alone on the last line |
| Punctuation | Opening quotes and brackets stay with the following text; closing ones stay with the preceding text | A line starts with `)`, `,` or `.` |
| Numbers and units | `3,200원` stays on one line | The number and its unit separate across lines |

## Width and cell accounting

- Hangul syllables are wide: two terminal cells each and about one em on screen. Latin letters are one cell and about half an em. A fixed-width column sized in characters holds half as many Hangul syllables.
- For terminal UIs, `tui-check` counts display cells. Run it at the narrowest supported width with a Korean-heavy capture and read `wideCharColumns`, `overflowLines` and `borderMisaligned`.
- Bordered boxes, tables and progress bars are the usual casualties: a border built from a character count drifts right by one cell per Hangul syllable.
- Truncation must cut at a syllable boundary and add the ellipsis within the budget. Cutting inside a combining sequence leaves a stray mark.

## Fonts and fallbacks

- The Korean face loads and renders every syllable used. A tofu box, a thin system fallback among bold headings, or a sudden weight shift mid-line shows a fallback.
- Weight pairs: the heading weight exists in the Korean face. Faux bold on Hangul looks smeared in a capture.
- Latin and Hangul share a baseline and a similar x-height within one line. A visible step between them points to mismatched faces or missing `font-family` order.
- Line height for Hangul body text sits at 1.5 or higher; tight Latin leading collides with Hangul ascenders and descenders.

## Input and IME

- Composition: the pre-edit string (the underlined syllable under construction) shows in the field and the candidate window does not cover the input. Capture the pre-edit state and the committed state separately.
- Keyboard handling during composition: Enter commits the syllable; the form submits only on a second Enter. A search box that fires per jamo reports a defect.
- Maxlength and counters count characters the way a user does (one syllable is one character, a combining sequence is one character).
- Pasting Korean text bypasses composition, so a pasted string never stands in for typed input.

## Locale details

- Dates, times and currency follow the Korean formats the product promises (`2026년 10월 20일`, `₩3,200` or `3,200원`), consistently across surfaces.
- Honorific and plain-speech levels stay consistent within one flow; a mix is a copy defect worth one line.
- Sorting uses Korean collation; a list sorted by code point scatters 가나다 order.

## Findings

Write them like any other: `FAIL profile-390.png: nickname 한글이름입니다 wraps mid-word at 390 px (word-break: break-all)`. Attach the font set from `driver.txt`. When the Korean face did not load because the environment lacks it, report the capture as void for this check (`font fallback substituted glyphs, font set unrecorded`) and recapture with the face installed.
