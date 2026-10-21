# The build loop in detail

`SKILL.md` carries the spine of the procedure. This file holds the detail behind steps 1, 5, 6, 7 and 8: the runtime probe and its failure modes, the data-file grammar, what the compiler prints, the whole gate catalogue and the look step. Open it when a step fails or when a deck needs numbers that must agree.

## 1. Runtime readiness

`scripts/office-runtime.mjs` owns the pinned environment. Its commands:

| Command | Effect |
| --- | --- |
| `status [--json]` | Reports readiness, the cache path, the missing pieces and the host tools (`soffice`, `pandoc`, `xelatex`). Installs nothing. |
| `install [--node] [--python] [--json]` | Installs the pinned Node packages (pptxgenjs, sharp) and the pinned Python virtual environment; with a flag, only that half. `ensure` is a synonym. Prints one notice line per half. |
| `node-modules` | Ensures the Node half and prints the `node_modules` path (the engine's `runtime-require.js` calls this). |
| `python` | Ensures the Python half and prints the interpreter (the Python helpers call this when they re-run themselves). |

Where things live:

- Cache root: `$XDG_DATA_HOME/litgravity/runtime/office`, default `~/.local/share/litgravity/runtime/office`; `LITGRAVITY_OFFICE_RUNTIME` replaces the root (tests, isolated probes).
- Environments are keyed by a hash of the lock files, the platform and the Python minor version (`node-<key>`, `python-<key>`), so a lock change or a new interpreter gets a fresh environment and an old one stays untouched.
- `LITGRAVITY_OFFICE_PYTHON` names the interpreter (default `python3`, minimum 3.10). A Python release that has no published wheels yet fails the pip step with `No matching distribution found`; point the variable at a release that has wheels (3.12 to 3.14) and rerun `install`.
- `LITGRAVITY_NODE` names the Node binary the Python helpers use to reach the runtime.
- Installs run `npm ci --ignore-scripts` and `pip install --only-binary=:all:`; nothing is installed globally and no agy configuration is touched. One installer per environment runs at a time (a lock directory), and a stale lock older than 20 minutes is taken over.

Failure vocabulary: `OFFICE_RUNTIME_PYTHON_UNAVAILABLE` (no interpreter of 3.10 or newer), `OFFICE_RUNTIME_VENV_FAILED`, `OFFICE_RUNTIME_PYTHON_INSTALL_FAILED` (pip exit and the last 600 characters of its error), `OFFICE_RUNTIME_LOCKED`. Each one is reported as `BLOCKED:` with the line quoted and the user command `npx @litfamily/litgravity runtime install office`.

## 2. Writing the source: the pieces that cause most repairs

- Frontmatter keys the compiler reads are listed in `references/authoring-guide.md`; the dialect contract is in `specs/markdown-slide-spec-v1.md` and `specs/markdown-slide-spec-v2.md`.
- A legacy template is chosen on the command line with `--template NAME`. A frontmatter `template:` line alone leaves the design unselected.
- `faces: a2z` (or `--faces a2z`) swaps the bundled Pretendard faces for A2Z; `--accent`, `--bg` and `--font` override single design inputs when the user supplies them.
- Each slide's `title:` line pins a treatment from `references/title-treatments.md`; an unlisted treatment for that pack and family is rejected with a message that lists the allowed ones.

## 3. Numbers from a data file

A deck quotes one figure in several places (a KPI card, a chart, a table, a closing). Keep the figures in one file beside the source so they cannot drift:

```yaml
data: metrics.data.json          # frontmatter; a CSV path, or several paths separated by commas
```

```json
{
  "values": {"prev": 8400, "now": "=sum(regions.방문)", "growth_pct": "=growth(now, prev)", "top_share": "=share(regions.방문['중앙'], now)"},
  "tables": {"regions": {"csv": "regions.csv", "derive": {"대출률(%)": "=share(대출, 방문)"}, "total": "합계", "format": {"대출률(%)": ".1f"}}},
  "checks": ["regions.방문['합계'] == now", "top_share < 100"]
}
```

| Piece | Meaning |
| --- | --- |
| `values` | Named numbers. A string starting with `=` is a formula over other names. |
| `tables` | A CSV (first row headers, first column row keys) or inline `columns` and `rows`. `derive` adds computed columns, `total` names the total row, `format` sets a Python format spec per column. |
| `checks` | Plain expressions that must hold. A failed check stops the compile with `Data error: data check failed: …`. |

Placeholders on the slides: `{{ now }}` (thousands separators; a whole amount prints without decimals), `{{ growth_pct | +.1f }}%`, `{{ table:regions }}` (the whole table with derived columns and the total row). Inside a `::: chart` block, `{{ table:regions | columns=방문,대출 no-total }}` plots only the named series. Add a format such as `| .1f` only to values that really have decimals, because `24.0억 원` reads as a typo for `24억 원`. Formulas allow arithmetic, `sum avg min max abs round len growth share approx`, `table.column`, `table.column['row']` and `table['column name']`; the evaluator runs nothing else.

Run `python3 "$SKILL_ROOT/scripts/office_data.py" check deck.md` before compiling. It prints every computed value and every check. Quote figures in the reply from that output. Deliver the data file and the CSVs with the deck: they are how a reader reruns the numbers.

## 4. What the compiler prints

| Line | Meaning | Action |
| --- | --- | --- |
| first line | tonality, density, variance, grid | copy into the build log |
| `note:` | the engine drew something other than the source asked (a family the pack lacks, a variant it cannot draw, a title moved for its glyph budget or for fill) | correct the source when the note shows a wrong request |
| `fill:` | which slides the fill policies grew and the band before and after | copy into the build log; a `none` outcome says the family cannot grow, so choose a fuller family |
| `Treatments:` | the title treatment per slide | compare with the card |
| `Data error:` | a data-file check or formula failed | fix the data file, never the check |
| `PPTX written to …` | success | continue to the gate |

## 5. The gate catalogue

`qa_deck.py` exits 0 only when no blocking finding remains. It runs these groups.

| Group | Checks |
| --- | --- |
| Layout inventory (`layout_inventory.py`) | text spilling out of its frame; text or a grown table past the canvas; a text box off the canvas |
| Contrast and collisions | WCAG contrast on the real fill (body 4.5:1, large text 3:1); picture and table occlusion; text-on-text collisions |
| Anti-slop terms | `forbidden-terms.json` |
| Evidence | captions carry 출처 or Source; appendix links are real hyperlinks; no text under 6 pt |
| Package integrity | zip, content types, well-formed parts, relationship targets, font parts, `NaN` attributes, python-pptx reopen (`ooxml_integrity.py`) |
| Deck craft (`deck_craft.py`) | a content slide filled under 45 % of the area below its title; a mostly-table deck with no chart; a shape past the canvas; an empty outlined box; an unfilled `[blank]`; a long foreign-language source line on a Korean deck |
| Craft floor per slide (`craft_extras.py`, OF-101 to OF-109) | one accent colour family; body lines of at most 90 characters (38 for Korean); right-aligned numeric columns; concentric nested frames; card spacing; no gradient text, glow or emoji bullets; no empty band over 35 % of a slide or card |
| Deck output (OF-110 to OF-113) | at least three title treatments on a deck of eight or more slides; each title drawn as its named treatment; content slides sharing one composition on at most 40 % of them; a median empty band under the body of at most 0.20; one title frame per treatment |
| Label and region checks | OF-114 titles and the cover subtitle written as labels; OF-115 no region left empty; OF-117 no light figure card on a dark ground; OF-118 a bold run-in label has its own separator (the engine sets the colon); OF-119 no count numeral beside an agenda title |
| Pair check | `--sibling other.pptx` adds OF-116: two tonalities of one source differ in skeleton on at least two content slides |

On a legacy template the variety checks and the median band are advisories, and a MEDIUM finding is advisory everywhere. Every failure reason carries a fix hint. The repair order that works: correct the source (family, visual, takeaway, merge or split, shorter text), recompile, rerun the gate. A threshold stays where it is. `references/anti-slop-checklist.md` maps each id to its fix.

Detail tools when the gate fails:

```bash
python3 "$SKILL_ROOT/scripts/layout_inventory.py" deck.pptx --issues-only
python3 "$SKILL_ROOT/scripts/deck_craft.py" deck.pptx
python3 "$SKILL_ROOT/scripts/craft_extras.py" deck.pptx
```

## 6. The look step

```bash
python3 "$SKILL_ROOT/scripts/render_pages.py" deck.pptx --out-dir renders --pages 99
```

- `render_pages.py` converts through `soffice` and rasterises with PyMuPDF; `--dpi` and `--json` are available. The PNG names are `page-NN.png`.
- Open every PNG with `read_file` at its real size. The questions: does the hierarchy read in one glance, do Korean glyphs render, do the numbers match the source, is any card cramped or any half-slide empty, does a title wrap into a widow, does the treatment suit the slide's job, does the deck still fit its card?
- LibreOffice substitutes a missing font silently. When Pretendard is absent on the machine, the preview differs from the embedded result in PowerPoint; the reply says so once when it matters (`fc-list` lists installed families).
- Three rounds of compile, gate and look is the budget. A defect that survives them goes into the reply with its slide number.
- Without `soffice` the step reports `BLOCKED: slide render check`; deliver the structurally gated deck and say the visual pass was skipped.

## 7. Evidence layout

| File | Content |
| --- | --- |
| `.litgravity/evidence/<slug>/build.md` | the direction card, compile notes, fill lines |
| `.litgravity/evidence/<slug>/gate.txt` | the last `qa_deck.py` output with its exit code |
| `.litgravity/evidence/<slug>/office-status.txt` | the `status` output of the runtime |
| `.litgravity/evidence/<slug>/pages.md` | one line per page opened and what it showed, including the card's "wrong if" verdict |
| ledger lines | a `decision` line for the direction, an `evidence` line per gate result |
