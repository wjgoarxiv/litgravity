# Azure Professional — the legacy blue and white template

The design system behind the legacy `AZURE-PRO` and `AZURE-A2Z` templates, 16:9 widescreen. It is
one fixed look: geometric covers, tinted numbered cards, KPI badges, navy dividers. It is used only
when the user names one of these templates or an existing deck source already does; a new deck takes
a tonality from the direction step (`direction-step.md`). Under a legacy template the gate reports
the variety checks and the median empty band as advisories, because the user asked for this look.

## Color tokens (locked)

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#FFFFFF` | Primary slide ground |
| `--paper` | `#F6F9FE` | Cool off-white card / band fill |
| `--ink` | `#0E1B2C` | Titles & body (near-black navy — premium, softer than pure black) |
| `--ink-muted` | `#51607A` | Secondary text / captions (≥4.5:1 on white) |
| `--primary` | `#1D4ED8` | Primary blue — key accent, one emphasized word, marks |
| `--primary-deep` | `#0B2E6F` | Deep navy-blue — dark panels, dividers, display |
| `--azure` | `#3B82F6` | Vivid mid-blue — secondary accent, links |
| `--azure-soft` | `#93C5FD` | Light blue — soft accents, chart series 2 |
| `--tint` | `#EEF4FF` | Very light blue surface — card fills, header bands |
| `--tint-2` | `#DCE9FF` | Slightly deeper tint |
| `--line` | `#D5DEEC` | Cool hairline / rules |
| semantic+ | `#0E9F6E` | Positive (sparse) |
| semantic− | `#E02424` | Negative (sparse) |
| semantic! | `#D97706` | Warning (sparse) |

Gradients (rasterized to PNG for PPTX — pptxgenjs has no native gradient):
- Hero: `linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)` (blue→indigo)
- Soft: `linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)`

Contrast (verified intent): ink/white very high; ink-muted/white ≈5.6:1; primary/white ≈5.4:1 (large/bold ok); white/primary-deep & white/primary high.

## Type scale (Pretendard; A2Z variant uses 에이투지체 weight families)
- Display (cover/divider): **48–64pt**, 800. One emphasized word in `--primary`.
- Slide title: **26–30pt**, 700, `--ink`.
- Section header: **15–17pt**, 700.
- Body: **13–15pt**, 400/500, line-height 1.35.
- Eyebrow / label: **10–11pt**, 700, UPPERCASE, +tracking, `--ink-muted` or `--primary`.
- Caption/source: **8–9pt**, `--ink-muted`.
- KPI numeral: **40–56pt**, 800, `--primary` or `--ink`.

## Geometric motif (restrained — curated, not the busy stock look)
- One hero geometric cluster per COVER and DIVIDER only (corner-anchored gradient quarter-circle/ring + 1–2 small accents: a ring outline, a small filled circle, a plus). Content slides stay clean.
- Shapes: full circles, rings (outline), quarter-circles, rounded squares, plus marks, pills. All blue family.
- Image masks: circle or rounded-rect.

## Per-layout treatment
- **cover**: off-white ground; corner gradient geometric cluster; eyebrow w/ square mark; huge display title (one word `--primary`); subtitle; **pill date badge** (`--primary` fill, white). Asymmetric balance.
- **content**: title + short `--primary` underline bar (or numbered badge); body OR 2–3 **rounded tint cards** (`--tint` fill, `--card-radius` 12px, each: small colored square/icon chip + bold heading + body). One primary accent.
- **main**: title + body; one emphasized **callout band** (rounded, `--primary-deep` or `--tint`).
- **summary**: two groups in rounded tint cards; optional right image (circle/rounded mask).
- **divider/section**: full-bleed `--primary-deep` (or hero gradient PNG) panel; big white number + title; subtle accent ring.
- **closing**: clean; centered thanks; small geometric accent; contact pill.

## Radius / spacing
- `--card-radius`: **12px** (soft, modern). Pills: full. Hairline: 1px `--line`.
- 4pt spacing scale. Generous margins (16:9): outer ≈0.6in.

## Canvas
- 16:9 widescreen: **13.333 × 7.5 in** (1280×720px @96).
