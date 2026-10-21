# Journal style spec

The five publisher profiles live in `templates/registry.yaml`, one block each: `docx` (page, fonts,
section order), `latex` (class and packages for the PDF path), `design` (the contract the converter
and the audit enforce) and `lint` (citation style and heading case). `--publisher <name>` selects a
profile. The profiles are style-equivalent summaries of public author guides, not byte copies of any
publisher's file; the target journal's current guide decides when it differs.

## Page and type

| Profile | Body face and size | Line spacing | Margins | Alignment | First-line indent |
|---|---|---|---|---|---|
| `elsevier` | Times New Roman 12 pt | 1.5 | 2.5 cm all sides | justified | 0.5 cm |
| `acs` | Arial 10 pt | 1.15 | 2.54 cm all sides | left | none |
| `ieee` | Times New Roman 10 pt | 1.0 | 1.9 cm all sides | justified | none |
| `nature` | Arial 11 pt | 1.5 | 2.0 cm all sides | left, 4 pt after paragraphs | none |
| `korean-generic` | Pretendard 11 pt | 1.6 | 3.0 cm top and bottom, 2.5 cm sides | left, 4 pt after paragraphs | none |

Every profile sets A4 portrait in one column. The IEEE two-column layout belongs to the LaTeX/PDF
path (`templates/latex/ieee/`). The two-column look in Word comes from the Journal tonality, which is
a design direction and keeps `--publisher` out of the build.

## Headings, captions and citations

| Profile | h1 / h2 / h3 size | Numbering | Heading case | Citation style | Table caption | Figure caption |
|---|---|---|---|---|---|---|
| `elsevier` | 14 / 12 / 12 pt | 1. / 1.1. / 1.1.1. | title case; h3 sentence case | numeric `[n]` | above, 9 pt | below, `Figure n.`, 9 pt |
| `acs` | 13 / 11 / 10 pt | 1. / 1.1. / 1.1.1. | title case; h3 sentence case | numeric superscript | above, 9 pt | below, `Figure n.`, 9 pt |
| `ieee` | 11 / 10 / 10 pt | I. / 1.1. / 1.1.1. | title case; h3 sentence case | numeric `[n]` | above, 9 pt | below, `Figure n.`, 9 pt |
| `nature` | 13 / 12 / 11 pt | none | sentence case | numeric superscript | above, 10 pt | below, `Figure n \|`, 10 pt |
| `korean-generic` | 13 / 12 / 11 pt | none | sentence case | numeric `[n]` | above, 10 pt | below, `Figure n.`, 10 pt |

The converter applies the numbering. The heading case is checked by the lint rule
`rule-11-heading-case` and left in the author's hands: the converter leaves headings as written.
Hangul headings pass the case check.

## Title block and section order

| Profile | Title / authors / affiliations | Author separator | Keywords label | Section order the lint expects |
|---|---|---|---|---|
| `elsevier` | 18 / 12 / 10 pt italic, centred | `, ` | Keywords | Introduction, Materials and Methods, Results, Discussion, Conclusions, Acknowledgements, References |
| `acs` | 16 / 10 / 9 pt, centred | `; ` | Keywords | Introduction, Experimental, Results and Discussion, Conclusions, Acknowledgements, References |
| `ieee` | 16 / 10 / 9 pt, centred | `, ` | Index Terms | Introduction, Related Work, Methods, Experiments, Results, Discussion, Conclusion, References |
| `nature` | 18 / 11 / 10 pt, centred | `, ` | Keywords | Introduction, Results, Discussion, Methods, References |
| `korean-generic` | 18 / 11 / 10 pt, centred | `, ` | 주요어 (abstract label 초록) | 서론, 이론, 방법, 결과, 고찰, 결론, 감사의 글, 참고문헌 |

All profiles print affiliation numbers as superscripts after the author name and mark the
corresponding author with `*`. The order check allows skipped sections and flags a heading that
arrives out of sequence; Materials and Methods counts as Methods and Conclusion as Conclusions.

## Common to every profile

- Hangul is set in Pretendard through an explicit `eastAsia` font pairing (the fallbacks are Noto Sans
  CJK KR, AppleGothic, Malgun Gothic). A Hangul run without the pairing raises
  `rule-30-cjk-font-fallback`.
- Tables are booktabs: rules of 1.5 pt above and below and 0.75 pt under the header in the profile,
  no vertical rules, a bold header, captions above. Figures carry alt text and keep with their caption.
- The footer holds a centred page number, absent on page 1. The `running_head_*` keys of the profile
  feed the LaTeX path; the Word output carries the page number and, when the source has a `notice`,
  the notice tag in the header.
- Quotes and apostrophes are curly, numeric ranges take an en dash, a non-breaking space sits before
  a unit, and an ellipsis is one character.
- Banned in the styles: Calibri, Cambria, Aptos (the Korean profile adds Batang, Gulim, MS Mincho);
  the styles Table Grid, Intense Quote, List Paragraph, Subtle Emphasis; red and yellow colours; the
  decorations WordArt, shadow, glow, reflection. `rule-32-banned-font` reports a banned font that
  remains in `styles.xml`.
- The audit compares the top margin with the profile (`rule-34-default-margin`, tolerance about 1 mm).

## Choosing between a profile and a tonality

| The document is | Use |
|---|---|
| a manuscript for a journal that matches one of the five | `--publisher <name>` and the matching `submission_checklist_<name>.md` |
| a Korean thesis chapter or an institute paper outside a journal | `--publisher korean-generic`, or the Journal tonality for a two-column reading copy |
| an essay, white paper or newsletter read as a document | the Journal tonality |
| any business document | Report, Brief, Manual, Proposal or Memo |

The commands that apply a profile, and the lint that checks it:

```sh
SKILL_ROOT="<directory of this SKILL.md>"
python3 "$SKILL_ROOT/scripts/convert_md_to_docx.py" paper.md paper.docx --publisher elsevier
python3 "$SKILL_ROOT/scripts/slop_lint.py" paper.md --publisher elsevier --report lint.md
python3 "$SKILL_ROOT/scripts/qa_docx.py" paper.docx --source paper.md --publisher elsevier --kind manuscript
```

The matching frontmatter is in `references/frontmatter_schema.md`, and the lint rules in
`references/slop_rules.md`. A new profile starts as a copy of one block in the registry; running
`scripts/generate_docx_templates.py` rebuilds `templates/docx/<name>.docx` from it.
