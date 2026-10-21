# Template enrollment contract

Status: frozen for contract version 1. A change to a key, a default or a check below needs a version
bump in the files that carry it.

## 1. Purpose and scope

An enrolled template is a folder of three YAML files that tells the compiler how to draw the five
classic layouts (and any layout the template adds) on one canvas: where each region sits, which font
role each region uses, which furniture belongs on which layout, and which blocks each layout accepts.
Adding a template is a file operation, and the compiler discovers it by scanning folders. The
compiler contains no template names.

Two kinds of template follow this contract:

| Kind | Origin | Typical home |
|---|---|---|
| Enrolled | Written by hand; the four bundled ones are `AZURE-PRO`, `AZURE-A2Z`, `BOILERPLATE-PRETENDARD`, `BOILERPLATE-A2Z` | `templates/enrolled/<NAME>/` inside the skill |
| Learned | Produced from a user's own `.pptx` by `scripts/learn_template.py` | `.lit-pptx/templates/<NAME>/` in the user's working directory |

Tonality packs (`templates/tonalities/<id>/pack.yaml`) are a separate mechanism with their own schema,
checked by `validatePack` in `scripts/lib/template-registry.js`. A deck chooses one or the other: a
`tonality:` line in the frontmatter (or `--tonality`) selects a pack, `--template <NAME>` selects an
enrolled or learned template. When a deck names a tonality the template flag is ignored and the
compile log says so.

## 2. Where templates are found

`template-registry.js` searches these folders in order and takes the first folder that holds a
`template.yaml` with the requested name:

1. each folder listed in `LIT_PPTX_TEMPLATE_DIRS` (separated by the platform path delimiter);
2. `.lit-pptx/templates` under the current working directory;
3. the skill's own `templates/enrolled`.

The installed skill folder is read-only for users, so learned and custom templates live in folder 1
or 2. A template name matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`; any other string is rejected before the
disk is touched. `node "$SKILL_ROOT/scripts/compile-deck.js" --list-templates` prints every name the
search finds, and `--list-layouts <NAME>` prints each layout with its allowed blocks and its regions.

## 3. Package layout

```
<NAME>/
├── template.yaml         identity, fonts, canvas, palette, global type rules
├── layout-mapping.yaml   layouts -> regions, variants; decorations
└── capabilities.yaml     supported blocks, font roles, constraints
```

The loader reads exactly these three files. A missing one stops the compile with
`Template "<NAME>" is missing <file>`. Decoration images are not part of the folder: an `image`
decoration with `dir: azure` reads `assets/azure/<asset>` inside the skill, and one without `dir`
reads `assets/media/<asset>`. A learned template carries no image decorations.

## 4. YAML subset

The registry has its own small parser. Write plain block-style YAML:

- two-space indentation, `key: value` lines and `- item` lists;
- scalars: quoted or bare strings, numbers, `true`, `false`, `null`;
- flow lists of scalars such as `[title, body, image]` are read as lists;
- a flow mapping such as `{ font: "Brand Sans", size: 24 }` is read as one string, so every mapping
  is written out in block style;
- quote every hex colour (`"#1D4ED8"`) and every font name that contains a space;
- a comment starts after whitespace and `#`; a `#` inside quotes stays;
- keys match `[\w][\w.-]*`; anchors, multi-line strings and tabs are unsupported.

Positions and sizes are inches, type sizes are points, `char_spacing` is points as pptxgenjs reads it.

## 5. `template.yaml`

```yaml
name: LIBRARY-DEMO
version: "1.0.0"
label: "Municipal library (example)"
description: "Example template for an invented municipal library"

fonts:
  title: "Brand Sans Bold"
  body: "Brand Sans Medium"
  light: "Brand Sans Light"

dimensions:
  width: 10.833
  height: 7.5
  unit: inches
  format: "custom"

palette:
  ink: "#1F2933"
  ink_muted: "#52606D"
  paper: "#FFFFFF"
  line: "#CBD2D9"
  header_fill: "#E4E7EB"
  metric: "#0B5FA5"

global_typography:
  char_spacing: -0.3
  bullet_font: "Brand Sans Medium"
  bullet_char: "•"
  bullet_color: "1F2933"
  section_accent: "1F2933"
```

| Key | Use |
|---|---|
| `name` | Matches the folder name and the deck's `template:` line; the loader falls back to the folder name |
| `version` | Contract version in semver; the loader falls back to `0.0.0` |
| `label`, `description` | Shown in listings |
| `fonts` | Title, body and light families; the font-swap logic reassigns them (see section 9) |
| `dimensions` | Canvas in inches; `format` is `16:9`, `4:3` or `custom` |
| `palette` | Free-form roles. The pack view reads `primary`, `primary_deep`, `ground`, `paper`, `tint`, `paper_warm`, `header_fill`, `ink`, `ink_muted`, `muted` and `line` when present, and falls back to neutral greys |
| `global_typography` | Default character spacing, bullet font, bullet character and colours (colours without `#` here) |
| `decoration_assets` | Informational map of image files; the render path reads the decoration elements instead |
| `pack` | Optional legacy-pack block, below |

The `pack` block opts a template into rich drawing:

```yaml
pack:
  capabilities: [rich-blocks, recolor, font-swap, mesh-background]
  tokens:
    card:
      pad: 0.30
```

`capabilities` is a list drawn from `rich-blocks` (cards, KPI tiles and styled tables instead of plain
text regions), `recolor` (the `--accent <hex>` flag, or `accent:` in the frontmatter, derives a
contrast-safe palette and regenerates the gradient circles), `font-swap` (`--font pretendard` or
`--font a2z` reassigns the whole font system) and `mesh-background` (`--bg mesh` adds a generated
gradient ground). An absent block means plain regions only, and each flag is ignored by a template
that lacks its capability.
`tokens` overrides one geometry group at a time: `card`, `kpi`, `bullet`, `secHeader`, `summary`,
`toc`, `notice`. Both AZURE templates declare all four capabilities; the BOILERPLATE templates declare
none.

## 6. `layout-mapping.yaml`

```yaml
layouts:
  cover:
    layout_source: none
    decorations: cover
    variants:
      rule:
        decorations: cover_rule
        regions:
          title:
            x: 0.84
            y: 2.60
            w: 8.8
            h: 1.6
            font_role: cover_title
    regions:
      title:
        x: 0.60
        y: 2.90
        w: 9.60
        h: 1.10
        font_role: cover_title
        valign: middle
decorations:
  cover:
    elements: []
```

### 6.1 Layouts and regions

Each layout carries `layout_source: none`, a `decorations` key naming an entry of the top-level
`decorations:` map, `regions`, and optionally `variants`. A region is a rectangle with `x`, `y`, `w`
and usually `h`, plus these optional keys:

| Key | Meaning |
|---|---|
| `font_role` | Entry of `font_roles` in `capabilities.yaml` used for the text |
| `heading_role`, `sub_item_role` | Roles for a summary group's heading and its items |
| `font_role_header`, `font_role_data` | Roles for a table region (default `table_header`, `table_data`) |
| `align`, `valign` | Horizontal and vertical alignment; `valign` is `top`, `middle` or `bottom` |
| `autofit` | `resize` grows the frame to the text, `shrink` shrinks the text; any other value leaves it fixed |
| `border` | `width` and `color` of an outline, used by `main_box` |

### 6.2 Region names and the blocks they hold

| Region | Block it holds |
|---|---|
| `title` | `title` |
| `body` | `body` |
| `table` (content, summary), `kpi_table` (main) | `kpi-table` and `table` |
| `image` | `image` (several images share the region as a grid) |
| `main_box` | `main-box` |
| `key_message` | `key-message` |
| `figure_caption`, `table_caption` | the caption blocks, numbered across the deck |
| `group_top`, `group_bottom` | `summary-group`, by its position |
| `metadata`, `subtitle`, `eyebrow`, `date_line` | cover text, filled from the frontmatter |

On a cover, `date_line` joins `date` and `department` with two spaces, a bar and two spaces. Any other
cover region whose name equals a frontmatter key (`subtitle`, `eyebrow`) is filled from that key. A
slide's own `::: region name=<region>` line overrides the default mapping.

### 6.3 Decorations

`decorations.<key>.elements` is a list drawn behind the regions, in order. Element types:

| `type` | Keys |
|---|---|
| `image` | `asset`, optional `dir: azure`, `x`, `y`, `w`, `h`, `rotate` |
| `rect`, `roundRect`, `pill` | `x`, `y`, `w`, `h`, `fill`, `line`, `line_width`, `alpha`, `radius`, optional `text` with `size`, `bold`, `text_color` |
| `ellipse`, `ring` | `x`, `y`, `w`, `h`, `fill` or `line`, `line_width`, `alpha` |
| `text` | `text`, `x`, `y`, `w`, `h`, `size`, `color`, `align`, `valign`, `bold` |
| `line` | `x`, `y`, `w`, `color`, `width` |
| `confidential_mark` | `x`, `y`, `w`, `h`; draws a bordered Korean confidentiality label, styled by the `confidential_mark` font role |
| `disclaimer` | `x`, `y`, `w`, `h`, optional `text`; styled by the `disclaimer` font role |

A `slide_number` element is accepted in the file and the renderer draws nothing for it. Keep a
one-line `note:` on each element that explains why it exists; the loader ignores it.

## 7. `capabilities.yaml`

```yaml
supported_layouts: [cover, content, main, summary, closing]
supported_blocks:
  cover: [title]
  content: [title, body, image, notes, kpi-table, figure-caption, table-caption]
  closing: [title]
supported_body_items: [bullet, numbered, section]
font_roles:
  body_text:
    font: "Brand Sans Medium"
    size: 12
    char_spacing: -0.3
    line_spacing: 1.3
    align: left
    bold: false
    color: "#1F2933"
constraints:
  max_columns_per_table: 6
  no_bold_on_bold_fonts: false
  body_text_stays_black: false
```

- `supported_blocks` is enforced. The spec validator first applies the fixed block set of the five
  classic layouts (`block type "body" is not supported. Allowed: title, box, shape, columns` for a
  closing slide with a bullet list); the resolver then applies the template's list and stops with
  `Slide <n> (layout: <name>): block type "<type>" is not allowed. Allowed: ...` for a block the
  template left out. `notes` and the placement blocks (`box`, `shape`, `columns`) are allowed on every
  layout.
- `supported_layouts`, `supported_body_items` and most `constraints` are declarative. They document
  the template for reviewers and listings, and the compiler leaves them unread. The one constraint the
  engine changes is `no_bold_on_bold_fonts`, which the font-swap sets to match the font system it
  applies.
- `font_roles` entries accept `font`, `size`, `color`, `align`, `char_spacing`, `line_spacing`,
  `bold`, `space_after`, `bullet_type` (`bullet` or `number`), `bullet_char`, `bullet_font`,
  `number_type` (for example `arabicParenBoth`), `marL`, `indent`, `fill`, `border_color` and
  `border_width`. Role names are free. The renderer looks up `table_header`, `table_data`,
  `figure_caption`, `table_caption`, `disclaimer` and `confidential_mark` by name; every other role is
  reached through a region's `font_role` or a slide's `::: box role=<name>` (an unknown role stops the
  compile and lists the available ones).
- Per-weight families (A2Z, "Brand Sans" style sets) set `bold: false` on every role and choose the
  weight by family name, with `no_bold_on_bold_fonts: true`. Single weighted families (Pretendard) use
  `bold: true` where the hierarchy needs it.

## 8. Compile-time checks

For a deck that names a template the compiler verifies, in order:

1. The name resolves in the search path, else `Unknown template: "<NAME>" not found in <folders>`.
2. A `layout:` the template declares is used as written. A family name the template does not declare
   (`kpi-row`, `agenda`, `cover-figures`) is drawn on the layout that hosts its kind of slide: the
   cover, section or content layout. A name that resolves nowhere stops with
   `layout "<name>" not found in template mapping. Available: ..., free`, and a name that is neither
   a family nor a layout gets a message listing the families and the legacy layouts.
3. Every block belongs to the layout (section 7). When `supported_blocks` has no entry for the
   layout, the allowed blocks derive from the regions the layout declares.
4. A `variant:` slide key names a variant of that layout, else
   `layout "<name>" has no variant "<v>". Available: ...`.
5. A slide-level `title:` key is rejected on a template, since a title treatment needs a tonality.

## 9. Fonts

Fonts named in the files must exist on the machine that opens the deck. `--embed-fonts` embeds the
families the skill bundles (Pretendard, and the A2Z faces under `fonts/`); any other family is skipped
with a warning, so a learned template's own fonts need a local install on the viewing machine. The
font-swap capability reassigns every role by its weight class (bold, black, medium, regular, light),
which it reads from the role name: titles, headers and `eyebrow` take bold, `kpi_value` takes black,
`disclaimer` takes light and the rest take regular. Name new roles with those words when a swap should
treat them correctly. On a tonality the same choice is `--faces a2z`.

## 10. Learning a template from a deck

```bash
python3 "$SKILL_ROOT/scripts/learn_template.py" brand-deck.pptx --name LIBRARY-DEMO
```

The default output folder is `.lit-pptx/templates/<NAME>`. The script reads the source as untrusted
input: it requires a `.pptx` with `ppt/presentation.xml`, caps the package at 5000 entries and 500 MB
uncompressed, and rejects an entry with a compression ratio above 200. XML is parsed with
`defusedxml`.

What it learns:

| Fact | Source in the deck |
|---|---|
| Canvas | `sldSz` of `presentation.xml`; format `16:9`, `4:3` or `custom` |
| Palette | the theme colour scheme (`dk1`, `lt1`, `dk2`, `lt2`, `accent1` to `accent6`, `hlink`) |
| Fonts | the theme's major and minor Latin and East Asian faces, preferring faces the slides use |
| Regions | proportions of the canvas: side margin 6%, title at 6% of the height, body at 18% |

It writes `layout_source: none` layouts for cover, content, main, summary and closing with empty
decoration lists, so logos and background art stay with the original deck and are added to the
template by hand.

### Closed-set verification

Before writing any file the script asserts that every font in `font_roles` appears in the source
(slide runs plus theme faces; `Arial` is allowed only when the source names no font) and that every
palette value comes from the theme or from a neutral set (`#000000`, `#FFFFFF`, `#444444`, `#CCCCCC`,
`#EEEEEE`). A violation prints `CLOSED-SET VERIFICATION FAILED` with one line per offender and exits
3. Exit 2 means the input was unusable. Four palette roles fall back to fixed colours when the theme
lacks the source slot (`accent_red` from `accent2`, `accent_green` from `accent6`, `accent_amber`
from `accent4`, `source_blue` from `hlink`); those fallbacks are outside the neutral set, so a theme
without the slot fails closed. Fix it by adding the missing theme colour to the source deck.

## 11. Variants and the open layout set

A template may declare any layout name matching `^[a-z][a-z0-9-]*$`. With no `supported_blocks` entry,
the allowed blocks come from the regions the layout declares, so adding a layout needs no table edit.

`free` needs no declaration. It means a slide that uses no template region, so every template supports
it; a template that declares its own `free` layout takes precedence.

A variant lives under its layout and swaps the decoration set, optionally moving regions:

```yaml
layouts:
  cover:
    decorations: cover
    variants:
      split-navy:
        decorations: cover_split_navy
        regions:
          title:
            x: 0.84
            y: 1.55
            w: 5.5
            h: 2.6
            font_role: cover_title
    regions:
      title:
        x: 0.84
        y: 1.55
        w: 7.4
        h: 1.85
        font_role: cover_title
```

`decorations` names another entry of the top-level map; `regions` merges over the layout's own. Move
a region whenever you move the thing it sits on: a date pill relocated without its `date_line`
region leaves white text on a white ground, and the contrast check finds it only after a render.
Both AZURE templates ship `split-navy` and `minimal` cover variants and a `rule` section variant.

## 12. Enrolling a template

1. Start from the closest bundled folder or from `learn_template.py` output, and copy it to
   `.lit-pptx/templates/<NAME>/` (or a folder on `LIT_PPTX_TEMPLATE_DIRS`).
2. Edit the three files to match the real typography and geometry, reading positions off the source
   deck (inches = EMU / 914400, accurate to 0.01).
3. Place image assets and point `dir` / `asset` at them.
4. Write two fixture decks: a 5-slide deck (cover, content, main, summary, closing) and a deck that
   uses a table, an image and every block the template supports.
5. Run the gate below on both. No compiler change is needed.

## 13. Verification gate

| Gate | Tool | Pass condition |
|---|---|---|
| Discovery | `compile-deck.js --list-templates` and `--list-layouts <NAME>` | The name and every layout appear with the expected blocks |
| Compilation | `compile-deck.js <fixture>.md --template <NAME> --pptx out.pptx` | Both fixtures compile |
| Canvas | python-pptx | Slide width and height within 5000 EMU of `dimensions` |
| Slide count | python-pptx | Matches the fixture |
| Hygiene | `scripts/validate_pptx.py out.pptx` | `pass: true` |
| Inventory | `scripts/layout_inventory.py out.pptx --issues-only` | No overflow, overlap or off-slide shape |
| Honest gate | `scripts/qa_deck.py out.pptx` | Exit 0 |
| Look | `scripts/render_pages.py out.pptx --out-dir renders --pages 5` | Pages open and show no clipped or empty region |

## 14. Review checklist

File completeness:
- [ ] Three YAML files parse and use the subset in section 4.
- [ ] `template.yaml` carries name, version, label, fonts, dimensions and palette.
- [ ] Every supported layout has numeric regions.
- [ ] Referenced image assets exist.
- [ ] Both fixture decks exist.

Contract correctness:
- [ ] `font_roles` match the real typography.
- [ ] `supported_blocks` per layout is accurate and complete.
- [ ] Region positions match the source within 0.01 in.
- [ ] Per-weight families set `no_bold_on_bold_fonts: true` and `bold: false` on every role.

Compiler independence:
- [ ] The template appears in `--list-templates` from directory scanning alone.
- [ ] No compiler file mentions the template's name.

Gate:
- [ ] Every row of section 13 passes on both fixtures.
