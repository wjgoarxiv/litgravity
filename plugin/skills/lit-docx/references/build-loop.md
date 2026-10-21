# The build loop and the other workflows in detail

`SKILL.md` carries the spine. This file holds the runtime facts, the data-file grammar, the gate groups, the look step and the workflows around the main build (Markdown out of DOCX and PDF, in-place edits, publisher PDF, registry changes). Open it when a step fails or when the job is something other than "Markdown to a new .docx".

Path convention in commands: `SKILL_ROOT` is the folder of `SKILL.md`; `OFFICE="$SKILL_ROOT/../lit-pptx/scripts"` is where the shared office helpers live (`office-runtime.mjs`, `office_data.py`, `render_pages.py`, `ooxml_integrity.py`, `office_runtime_bootstrap.py`, the pinned lock folder). `lit-docx` and `lit-pptx` use one runtime, so the engine is installed once.

## 1. Runtime readiness

| Command | Effect |
| --- | --- |
| `node "$OFFICE/office-runtime.mjs" status --json` | readiness, cache path, missing pieces, host tools (`soffice`, `pandoc`, `xelatex`); installs nothing |
| `node "$OFFICE/office-runtime.mjs" install --json` | installs the pinned Node and Python halves into `$XDG_DATA_HOME/litgravity/runtime/office`; `--python` installs only the half this skill needs |

- Documents need only the Python half (python-docx, Markdown, beautifulsoup4, PyMuPDF, PyYAML and pins). The first helper call installs it by itself and prints one notice line; every helper then re-runs under that interpreter, so `python3` is the right command.
- `LITGRAVITY_OFFICE_PYTHON` names another interpreter (3.10 or newer). A Python release that has no published wheels yet fails with `No matching distribution found`; point the variable at a release with wheels (3.12 to 3.14) and rerun the install. `LITGRAVITY_OFFICE_RUNTIME` replaces the cache root; `LITGRAVITY_NODE` names the Node binary the helpers call.
- A refused `run_command` or a failed install is `BLOCKED:`. Quote the error line and give the user command `npx @litfamily/litgravity runtime install office`.
- Host tools are reported and never installed: `soffice` (rendered pages and the page checks), `pandoc` (DOCX to Markdown, the publisher PDF path), `xelatex` (publisher PDF).

## 2. Numbers from a data file

When the document quotes one figure in several places, or carries totals, shares, growth rates or a budget that must add up, keep the numbers in one file beside the Markdown:

```yaml
data: budget.data.json          # frontmatter; a CSV path, or several paths separated by commas
```

```json
{
  "values": {"staff": 3, "monthly_cost": 420, "annual_cost": "=monthly_cost * 12", "capex": 9600, "monthly_saving": 1150,
             "payback_months": "=capex / (monthly_saving - monthly_cost)"},
  "tables": {"budget": {"csv": "budget.csv", "derive": {"비중(%)": "=share(금액, sum(budget.금액))"}, "total": "합계", "format": {"비중(%)": ".1f"}}},
  "checks": ["budget.금액['합계'] == capex", "payback_months < 36"]
}
```

| Piece | Meaning |
| --- | --- |
| `values` | named numbers; a string starting with `=` is a formula over other names |
| `tables` | a CSV (first row headers, first column row keys) or inline `columns` and `rows`; `derive` adds computed columns, `total` names the total row, `format` sets a Python format spec per column |
| `checks` | plain expressions that must hold; the converter refuses to build when one fails |

In the Markdown: `{{ annual_cost }}` (thousands separators; a whole amount prints without decimals), `{{ payback_months | .1f }}`, `{{ growth(new, old) | +.1f }}%`, `{{ table:budget }}` for the whole table with derived columns and total row. Add a format such as `| .1f` only to values that really have decimals, because `24.0억 원` reads as a typo for `24억 원`. Formulas allow arithmetic, `sum avg min max abs round len growth share approx`, `table.column`, `table.column['row']` and `table['column name']`; nothing else is evaluated.

`python3 "$OFFICE/office_data.py" check report.md` prints every computed value and check before conversion. Quote numbers in the reply from that output, and deliver the data file and CSVs with the document, since they are how a reader reruns the numbers. A short memo with two figures needs no data file.

## 3. Conversion and the Korean conventions

- The tonality comes from the frontmatter (`tonality:`); `--tonality`, `--density`, `--variance` override it (a direction strip uses this). `--publisher <profile>` (elsevier, acs, ieee, nature, korean-generic) and `--template <file.docx>` exclude `--tonality` and exclude each other. `--registry <file>` points at an edited registry. `--locale auto|en|ko|mixed` forces the language detection.
- Korean documents: an ISO date is rewritten as `2026. 6. 30.` (frontmatter too); a table caption `표 1. 제목` prints as `<표 1> 제목` above the table; a unit shared by the number columns moves to a right-aligned `(단위: 억 원)` line; `주:` and `출처:` lines print under the table (`자료:` for the source); figures read `[그림 1]`; bullets are plain dashes; Hangul is emphasised by weight and stays upright. Word breaks Hangul between words and a LibreOffice preview breaks between syllables, which is expected.
- Pretendard is set for Hangul and Latin (Journal keeps Times New Roman for Latin body text). The fonts are not embedded, so the preview is true where Pretendard is installed (`fc-list` lists families); the reply says so when the renderer substituted a face.
- Figures: `![그림 1. <caption> (출처: <source>)](path.png)` with the image beside the Markdown file.

## 4. The gate in groups

`python3 "$SKILL_ROOT/scripts/qa_docx.py" report.docx --source report.md --layout --kind report` must exit 0; `--tonality` names the tonality when the source frontmatter does not, `--publisher <profile>` applies a profile, `--compare other.docx` adds `tonality.structure`.

| Group | Checks (ids in `references/page-composition.md`) |
| --- | --- |
| Page fill and flow | `fill.page`, `memo.fit`, `page.spill` |
| Splits | `list.split`, `heading.column`, `columns.balance`, `heading.apart`, `heading.stranded` |
| Tables, boxes, figures | `table.split`, `figure.split` |
| Headings and furniture | `heading.wrap`, `title.lines`, `folio.total`, `sidebar.overlap`, `component.variety` |
| Restraint on a tonality document | `color.accent-kinds`, `heading.ink`, `heading.ratio`, `table.fill`, `component.budget`, `cover.block`, `furniture.chip`, `date.iso` |
| Structural (always runs) | `heading.declarative`, `heading.order`, `notice.dash` |
| Package and content | OOXML integrity, every source heading reached the document, no `[blank]`, `XXX` or `TBD`, no frontmatter leaked into the body |
| Prose lint | AI-tell phrases, hedge pile-ups, stock openers and closers, adjective stacks, Korean rules (`--kind report` leaves out the journal-outline rules) |
| Design audit | banned fonts, profile margins, booktabs tables, highlights, tracked changes, ASCII ellipsis, Hangul runs without the Pretendard east-Asian pairing, right-aligned numeric columns (OF-302); body lines above 90 characters, 38 for Korean, as the advisory OF-301 |

Without `soffice` the page checks are reported as not run and the reply says so. A fix goes into the Markdown followed by a reconvert; the gate stays as it is. For a manuscript also run `python3 "$SKILL_ROOT/scripts/slop_lint.py" draft.md --publisher <profile> --report lint.md` (add `--kind report` to skip the manuscript-only rules) for the full report and the submission checklist.

## 5. The look step

```bash
python3 "$SKILL_ROOT/scripts/visual_audit.py" report.docx --out-dir renders --pages 3
```

It writes a PDF and `page-NN.png` files through `soffice` (`--dpi` defaults to 110). Open each PNG with `read_file`. The questions: does the cover or title block read at once, is the heading rhythm even, does the callout hold the decision, does each key figure show its basis, do Korean glyphs render, do table rules, page breaks and figures sit where the composition notes say, and does the direction still fit now that pages exist (the card's "wrong if" line)? Three rounds is the budget; a surviving defect goes into the reply with its page number. Use `nice -n 10` for long renders.

## 6. Other workflows

- **DOCX to Markdown.** `pandoc in.docx -f docx -t gfm --wrap=none --extract-media=media --markdown-headings=atx -o draft.md` (add `--track-changes=all` for tracked changes), then `python3 "$SKILL_ROOT/scripts/clean_markdown.py" draft.md clean.md`, then review against `references/markdown_quality_checklist.md`. `python3 "$SKILL_ROOT/scripts/embed_images.py" clean.md inline.md --root media` makes the result self-contained. List what the conversion dropped (footnotes, text boxes, equations, comments, images) when it matters. A missing pandoc is `BLOCKED` for DOCX input only.
- **PDF to Markdown.** `python3 "$SKILL_ROOT/scripts/convert_pdf.py" in.pdf out.md` handles multi-column layouts, paragraph merging and header and footer removal. Check the reading order of two-column pages against the page images.
- **Edit a .docx.** `python3 "$SKILL_ROOT/scripts/edit_docx.py" in.docx --replace "OLD" "NEW" -o out.docx` (add `--case-insensitive`), `--append-md extra.md`, `--insert-at "{{MARKER}}" "text"`, `--extract-text`, `--show-structure`. The output is a new file and the original stays untouched unless the user asks. Afterwards extract the text of both files and confirm only the intended paragraphs changed.
- **Publisher PDF.** `python3 "$SKILL_ROOT/scripts/convert_md_to_pdf.py" draft.md out.pdf --publisher <profile>` checks pandoc, xelatex and the class file first and exits with an install hint instead of failing halfway (`--submission` and `--draft` select the mode). When either tool is missing, offer the DOCX rendered to PDF through `soffice`: `python3 "$OFFICE/render_pages.py" report.docx --out-dir renders --pages 1` writes `<stem>.pdf` there.
- **New or changed publisher profile.** Edit a copy of `templates/registry.yaml`, run `python3 "$SKILL_ROOT/scripts/generate_docx_templates.py" --registry my-registry.yaml --out-dir my-templates`, and pass `--registry` to the converter and the linter. Regenerating into the installed skill is out of bounds.

## 7. Evidence layout

| File under `.litgravity/evidence/<slug>/` | Content |
| --- | --- |
| `gate.txt` | the last `qa_docx.py` output with its exit code |
| `office-status.txt` | the runtime `status` output |
| `pages.md` | one line per page opened and what it showed, including the "wrong if" verdict |
| `lint.md` | the lint report for a manuscript |

Ledger lines: a `decision` line for the direction card and an `evidence` line per artifact (`{ts, kind, text, path?}` appended to `.litgravity/ledger/<conversation-id>.jsonl`).
