# Markdown quality checklist

Run this pass on Markdown that came out of a DOCX or PDF conversion, before editing it or converting it
back. A PDF reaches Markdown through `scripts/convert_pdf.py <input.pdf> <output.md>`, which drops the
top and bottom 5 percent of each page, joins hard-wrapped lines and removes bare page numbers.
`scripts/clean_markdown.py <input.md> <output.md>` then does the mechanical part of items 1 to 3 and 6
below; the rest is a read of the file.

| # | Area | Check | Fix |
|---|---|---|---|
| 1 | Headings | One `#` title or section run at the top, then `##`, `###` with no skipped level (`heading.order` fails an h1 to h3 jump); a blank line before and after each heading; no empty heading | demote or add the missing level; `clean_markdown.py` adds the blank lines |
| 1 | Headings | A bold line such as `**Abstract**` that the source styled as a heading | promote it to `##` |
| 2 | Tables | Pipe tables with a header row and a separator row; a blank line before and after | `clean_markdown.py` adds the blank lines |
| 2 | Tables | Merged cells flattened by the conversion | rewrite as repeated cells or split into two tables |
| 2 | Tables | A caption line `표 1. 제목` or `Table 1. Title` directly above, a `주:` or `자료:` (`Note:`, `Source:`) line below | add them; the converter styles both |
| 3 | Lists | Consistent indentation, no mixed tabs and spaces; one bullet per line | unwrap hard-wrapped bullets |
| 4 | Images | Paths relative to the Markdown file, alt text present; a caption written as the alt text (`그림 1. 제목`) | add the alt text; strip `{width=...}` attributes (`clean_markdown.py` does) |
| 4 | Images | A single-file handoff is needed | `scripts/embed_images.py in.md out.md [--root media_dir]` inlines local images as data URIs and grows the file |
| 5 | Links | Reference-style links resolve; footnote markers have definitions at the file end | add the missing target or definition |
| 6 | Text hygiene | No run of three blank lines, no trailing spaces, UTF-8 throughout | `clean_markdown.py` |
| 6 | Text hygiene | Math kept as `$...$` and `$$...$$`; straight quotes left for the converter to curl | restore dropped delimiters |
| 7 | Placeholders | No `[제품명]`, `XXX`, `TBD`, `TODO`, `○○`, `{{...}}` left in the text | fill with a real value or an example value labelled (예시) |
| 8 | Dates and numbers | Korean text carries `2026. 7. 3.` or `2026년 7월 3일`, with no `2026-07-03` | rewrite; the gate check `date.iso` fails ISO dates in Korean documents |
| 9 | Frontmatter | The YAML block opens on line 1 and parses (see `references/frontmatter_schema.md`) | quote values that hold a colon |
| 10 | Sanity | Headings, tables and figures match the source file in number and order; spot-check two tables and every equation | restore the missing section from the source |

## After the pass

1. Convert the cleaned file once with the intended route (`--tonality <Name>` or `--publisher <name>`).
2. Run `qa_docx.py <out.docx> --source <file.md>` and read `content.missing_headings`,
   `content.placeholders` and `content.frontmatter_leak` in its JSON; each of them names a Markdown
   fault from the table above.
3. Open the rendered pages that `visual_audit.py` writes before calling the file clean.

## Common conversion faults

| Symptom in the Markdown | Cause | Remedy |
|---|---|---|
| Every line of a paragraph is its own line | hard wraps from a PDF | rerun `convert_pdf.py` or join the lines by hand |
| A running header repeated every page | a header outside the 5 percent band | delete the repeats |
| Hyphen at a line end inside a word | PDF hyphenation | `convert_pdf.py` joins `for-` plus `mation`; check proper nouns |
| A table turned into aligned text | no ruling in the PDF | rebuild it as a pipe table from the source figures |
| Heading text in bold body paragraphs | the source used direct formatting | promote to real headings (item 1) |
