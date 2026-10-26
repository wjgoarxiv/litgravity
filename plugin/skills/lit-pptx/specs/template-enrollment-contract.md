# Template Enrollment Contract

> **Status:** Frozen for v1. Changes require a version bump.
> **Date:** 2026-04-19

## Purpose

Define the contract that an enrolled template must satisfy to participate in the Markdown → AST → rendered slide pipeline. Enrollment is a declarative, file-based process — no compiler code changes are required to add a new template.

## 1. Enrollment Package Structure

An enrolled template lives in:

```
templates/enrolled/<TEMPLATE-NAME>/
├── template.yaml          # Identity and global properties
├── layout-mapping.yaml    # AST layout → template layout + regions
└── capabilities.yaml      # Supported layouts, blocks, and constraints
```

### 1.1 `template.yaml`

Declares template identity and global properties.

Required fields:

```yaml
name: MY-BRAND        # Unique enrollment name (matches frontmatter)
version: "1.0.0"                # Template contract version (semver)
label: "My Brand"      # Human-readable label
description: "Example corporate template learned from a brand deck"

fonts:
  title: "Brand Sans Bold"
  body: "Brand Sans Medium"
  light: "Brand Sans Light"

dimensions:
  width: 10.833                 # inches
  height: 7.5                   # inches (A4 landscape)

palette:
  ink: "#000000"
  paper: "#FFFFFF"
  line: "#E7E6E6"
  header_fill: "#E7E6E6"
  metric: "#003087"
  positive: "#00AD1D"
  negative: "#C00000"
  trust: "#002554"
```

### 1.2 `layout-mapping.yaml`

Maps each AST layout type to template-specific regions with exact positions.

```yaml
layouts:
  cover:
    decorations: cover
    regions:
      title:
        x: 0.518
        y: 2.665
        w: 8.743
        h: 0.740
        font_role: cover_title
      metadata:
        x: 0.600
        y: 3.898
        w: 3.100
        h: 1.227
        font_role: cover_metadata

  content:
    decorations: body
    regions:
      title:
        x: 0.394
        y: 0.315
        w: 8.110
        h: 0.472
        font_role: section_title
      body:
        x: 0.394
        y: 1.044
        w: 10.188
        font_role: body_text

  main:
    decorations: body
    regions:
      title:
        x: 0.394
        y: 0.315
        w: 8.110
        h: 0.472
        font_role: section_title
      body:
        x: 0.394
        y: 1.044
        w: 10.188
        font_role: body_text
      main_box:
        x: 0.761
        y: 5.691
        w: 9.582
        h: 0.757
        border: { width: 2, color: "#000000", opacity: 0.99 }
        font_role: body_text

  summary:
    decorations: body
    regions:
      title:
        x: 0.394
        y: 0.315
        w: 8.110
        h: 0.472
        font_role: section_title
      group_top:
        x: 0.394
        y: 1.044
        w: 10.188
      group_bottom:
        x: 0.394
        y: 3.863
        w: 10.188

  closing:
    decorations: closing
    regions:
      title:
        x: 0.745
        y: 3.290
        w: 9.344
        h: 0.737
        font_role: closing_title
        align: center
```

### 1.3 `capabilities.yaml`

Declares which AST constructs the template supports.

```yaml
supported_layouts:
  - cover
  - content
  - main
  - summary
  - closing

supported_blocks:
  cover: [title]
  content: [title, body, image, notes, kpi-table]
  main: [title, body, main-box, image, kpi-table]
  summary: [title, summary-group]
  closing: [title]

supported_body_items:
  - bullet
  - numbered
  - section

font_roles:
  cover_title: { font: "Brand Sans Bold", size: 33.45, char_spacing: -0.7, line_spacing: 1.0, align: left }
  cover_metadata: { font: "Brand Sans Medium", size: 16.73, char_spacing: -0.7, line_spacing: 1.0, align: left }
  section_title: { font: "Brand Sans Bold", size: 24, char_spacing: -0.7, line_spacing: 1.0, align: left }
  body_text: { font: "Brand Sans Medium", size: 16, char_spacing: -0.7, line_spacing: 1.25, align: left }
  section_header: { font: "Brand Sans Bold", size: 18, char_spacing: -0.7, line_spacing: 1.5, align: left }
  numbered_item: { font: "Brand Sans Medium", size: 16, char_spacing: -0.7, align: left }
  closing_title: { font: "Brand Sans Medium", size: 44, char_spacing: null, line_spacing: 0.9, align: center }
  disclaimer: { font: "Brand Sans Light", size: 6, char_spacing: null, line_spacing: 1.0, align: left }

decoration_presets:
  cover:
    - { type: image, asset: image11.png, position: background_right }
    - { type: image, asset: image12.png, position: top_left_logo }
    - { type: confidential_mark }
    - { type: disclaimer }
  body:
    - { type: line, color: "#00AE41", width: 1.5, y: 0.787 }
    - { type: image, asset: image10.png, position: top_right_logo }
    - { type: confidential_mark }
    - { type: slide_number }
  closing:
    - { type: line, color: "#00823D", width: 6, y: 4.079, full_width: true }
    - { type: image, asset: image9.png, position: top_right_logo }
```

## 2. Enrollment Validation

When a deck targets an enrolled template, the compiler MUST verify:

1. The template name exists in the enrollment directory.
2. Each slide layout is listed in `supported_layouts`.
3. Each block type is listed in `supported_blocks` for that layout.
4. Each body item type is listed in `supported_body_items`.

Violation of any check produces an error naming the specific unsupported construct, the slide index, and the template name.

## 3. Required Assets

Each enrolled template must provide or reference the following assets:

### 3.1 Image assets

Decoration presets in `capabilities.yaml` reference image files. These must exist in an `assets/` directory discoverable by the render adapter.

| Asset role | Purpose | Required |
|------------|---------|----------|
| `top_left_logo` | Cover slide logo (large, light version) | yes |
| `top_right_logo` | Body/closing slide logo (small, dark version) | yes |
| `background_right` | Cover slide right-side decorative image | cover layouts only |
| `background_full` | Optional full-slide background | no |

Asset files are placed in `templates/enrolled/<TEMPLATE-NAME>/assets/` or a shared `assets/` directory.

### 3.2 Font availability

All fonts declared in `template.yaml` and `capabilities.yaml` must be installed on the rendering machine. The enrollment contract does not bundle fonts — it assumes they are available system-wide.

For MY-BRAND, the required fonts are:
- `Brand Sans Bold` (1 space)
- `Brand Sans Medium` (2 spaces)
- `Brand Sans Light` (2 spaces)

### 3.3 Fixture decks

At minimum, two fixture Markdown decks must exist for regression testing:

- `tests/fixtures/decks/<template-name>-basic.md` — 5-slide deck (cover, content, main, summary, closing)
- `tests/fixtures/decks/<template-name>-complex.md` — deck with tables, images, and all supported block types

### 3.4 AST fixtures

Corresponding AST snapshot files must exist:

- `tests/fixtures/ast/<template-name>-basic.json`
- `tests/fixtures/ast/<template-name>-complex.json`

## 4. Adding a New Template (MY-BRAND-N)

To enroll a new template:

1. Create `templates/enrolled/MY-BRAND-N/` with all three YAML files.
2. Place required image assets in the assets directory.
3. Create fixture decks and AST snapshots (see §3.3–3.4).
4. Create mapping tests: `tests/test_template_example_N_mapping.js`.
5. Fill in all required fields from the YAML templates in §1.
6. Verify the enrollment by running:

```bash
node --test tests/test_template_example_N_mapping.js
python -m pytest tests/test_template_regression.py -v
```

7. No changes to compiler code are required — the template registry discovers enrolled templates by directory scan.

## 5. Regression Gate

Before an enrolled template is considered production-ready, it must pass the regression gate:

### 5.1 Gate checks

| Gate | Tool | Pass criteria |
|------|------|---------------|
| Compilation | `compile-deck.js` | Both fixture decks compile without error |
| Dimensions | python-pptx | Slide width/height within 5000 EMU of declared dimensions |
| Slide count | python-pptx | Matches expected count per fixture |
| Hygiene | `validate_pptx.py` | `pass: true` (no hard failures) |
| Inventory | `layout_inventory.py --issues-only` | No overflow, overlap, or formatting issues |
| Content | python-pptx | Every slide has text content |
| Score baseline | `evaluate_pptx.py` | Composite score within 2 points of established baseline |

### 5.2 Baseline establishment

On first run, the regression harness records baseline scores to `tests/baselines/`. Subsequent runs compare against these baselines. A regression of more than 2 composite points triggers a failure.

To reset baselines (e.g., after intentional template changes):

```bash
rm tests/baselines/baseline_*.json
python -m pytest tests/test_template_regression.py -v
```

### 5.3 Running the gate

```bash
# Full regression suite
python -m pytest tests/test_template_regression.py -v

# Node.js mapping tests (per template)
node --test tests/test_template_example_1_mapping.js

# Full verification pipeline
node --test tests/test_compile_deck.js tests/test_template_example_1_mapping.js
python -m pytest tests/test_template_regression.py -v
python validate_pptx.py test_output.pptx
python3 "$SKILL_ROOT/scripts/layout_inventory.py" test_output.pptx --issues-only
```

## 6. Enrollment Review Checklist

Before approving enrollment, verify every item:

### 6.1 File completeness
- [ ] All three YAML files exist and are valid YAML.
- [ ] `template.yaml` has all required fields (name, version, label, fonts, dimensions, palette).
- [ ] `layout-mapping.yaml` has regions for every supported layout with numeric positions.
- [ ] `capabilities.yaml` lists supported layouts, blocks, body items, font roles, and decoration presets.
- [ ] Required image assets exist in the assets directory.
- [ ] Fixture decks and AST snapshots exist.

### 6.2 Contract correctness
- [ ] `font_roles` match the actual template typography exactly.
- [ ] `decoration_presets` reference assets that exist.
- [ ] `supported_blocks` per layout are accurate and complete.
- [ ] `supported_body_items` covers all bullet/numbering styles used.
- [ ] Position values (x, y, w, h) are accurate to within 0.01 inches.

### 6.3 Compiler independence
- [ ] No hardcoded values in compiler code reference this template.
- [ ] The template is discoverable by the registry via directory scan alone.

### 6.4 Regression gate
- [ ] Node.js mapping tests pass.
- [ ] Python regression tests pass (all 7 gates).
- [ ] Baseline scores are established and recorded.
- [ ] `validate_pptx.py` reports `pass: true` on compiled output.

## 7. Enrollment File Format Rules

- YAML files use 2-space indentation.
- Positions are in inches (convert from EMU: `inches = EMU / 914400`).
- Font sizes are in points.
- Color values are hex strings without `#` prefix where used in code, with `#` prefix in YAML.
- Asset filenames reference files in the `assets/` directory.

## Variants and the open layout set (spec v2)

A template may declare any layout name matching `^[a-z][a-z0-9-]*$`. When it declares a
layout but publishes no `supported_blocks` entry for it, the allowed blocks are derived
from the regions that layout declares, so adding a layout does not mean editing a table
in the resolver.

`free` needs no declaration at all. It means "this slide uses no template region", so
every template supports it by construction; a template that declares its own `free`
layout still wins.

A **variant** is declared under the layout it belongs to:

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
      title: { ... }
```

`decorations` names another entry in the top-level `decorations:` map. `regions` is
merged over the layout's own, and exists because new furniture displaces content: a
split cover needs a narrower title than a full-bleed one, and shipping the two apart
guarantees they drift.

**Move the region whenever you move the thing it sits on.** A date pill relocated
without its `date_line` region leaves white text on a white ground — which the contrast
check will fail, but only after someone renders the deck.

Placement blocks (`box`, `shape`, `columns`) and `notes` are allowed in every layout and
need no capability entry, since they do not depend on a region existing.
