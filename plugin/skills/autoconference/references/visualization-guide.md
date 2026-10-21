# autoconference: visualization guide

Rules for every figure a conference produces: the per-round `conference_progress.png`, the optional per-lane progress plots, and the figures analyze and ship modes put into their reports. The figures follow the house style of the `lit-scientific-visualization` skill; this file adds what is specific to conferences: which panels to draw, which data feeds them, and how to render them with agy tools.

Figures are a by-product. When the plotting runtime is not ready, skip the figure, append a `note` ledger line saying so, and keep the round going.

## Runtime

Plots run in the Python runtime that `lit-scientific-visualization` manages (matplotlib and numpy, installed on first use into `$XDG_DATA_HOME/litgravity/runtime/sciviz`). Check it once per conference with `run_command`:

```bash
node "<skills-dir>/lit-scientific-visualization/scripts/sciviz-runtime.mjs" status --json
```

- `"ready": true`: render with `node "<skills-dir>/lit-scientific-visualization/scripts/sciviz-runtime.mjs" run -- <plot script>`.
- `"ready": false`: run the same file with `install --json` once (first use). If `run_command` is refused, or the run is headless and the install cannot run, skip figures for this conference and report the user command `npx @litfamily/litgravity runtime install sciviz` as an optional action.

`<skills-dir>` is the parent of this skill's folder, taken from the SKILL.md path in the activation note. Write each plot script into CONF_DIR (`plot_progress.py`), never into the skill folder or the user's source tree.

## Style setup

Every plot script starts by loading this skill's style helper and calling it before the first figure is created:

```python
import os, sys
sys.path.insert(0, "<skill-folder>/scripts")   # this skill's folder, absolute path
from style_presets import rcparams
rcparams()                                       # before plt.subplots()
```

The helper, `scripts/style_presets.py`, sets the font stack (Pretendard, then Arial, then the default sans), inward ticks, the Okabe-Ito colour cycle, a white background and 600 DPI output.

## Seven rules for every figure

1. **Axis ends carry numbers.** The first and last ticks on both axes show values; set the limits explicitly with `set_xlim` and `set_ylim`.
2. **Panels keep their spacing.** Use `constrained_layout=True` or `fig.tight_layout(pad=1.5)`; labels never overlap.
3. **The legend stays off the data.** Place it in empty space (`loc="upper right"` or `bbox_to_anchor` outside the axes).
4. **Captions, no titles.** Leave `set_title` and `suptitle` out; the report or the caption line says what the figure shows.
5. **Legend text matches its series colour.** After `leg = ax.legend(...)`, set each text's colour to the colour of its line.
6. **Legend frame:** black edge, `framealpha=1`: `ax.legend(frameon=True, edgecolor="black", framealpha=1)`.
7. **Resolution above 500 DPI.** Save PNG and PDF at 600 DPI with `bbox_inches="tight"`.

## Palette (Okabe-Ito)

| Colour | Hex | Use in conference figures |
| --- | --- | --- |
| Blue | `#0072B2` | Researcher A; kept iterations in single-lane plots |
| Vermillion | `#D55E00` | Researcher B; reverted iterations in single-lane plots |
| Bluish green | `#009E73` | Researcher C; the best-of-conference envelope |
| Reddish purple | `#CC79A7` | Researcher D |
| Sky blue | `#56B4E9` | Researcher E |
| Orange | `#E69F00` | the target line |
| Yellow | `#F0E442` | highlights, sparingly (low contrast on white) |
| Black | `#000000` | baselines, text, round boundaries |

Keep a lane's colour fixed across every figure of one conference. More than five lanes: reuse the palette with different line styles (solid, dashed, dotted) before adding colours.

## The per-round progress figure

`conference_progress.png` (and `.pdf`) in CONF_DIR, redrawn after every Phase 1 and overwritten each time.

- **Data:** `conference_results.tsv`, read with the standard `csv` module (`delimiter="\t"`). Use rows with status `baseline`, `kept` or `reverted`; skip `failed`.
- **x axis:** a global iteration index per lane (`(round - 1) × iterations_per_round + iteration`), with thin black vertical lines at round boundaries.
- **Series:** one line per lane, its colour from the table above; kept iterations as filled markers, reverted ones hollow.
- **Envelope:** the best validated value so far across lanes, as a bluish-green step line. Rows not yet reviewed are left out of the envelope, so it moves only after Phase 4.
- **Target:** a dashed orange horizontal line at the target, labelled in the legend.
- **Qualitative mode:** the y axis is the score (1 to 10, limits 0 and 10), lanes show self-scores, and the Reviewer's scores per round appear as black diamonds at each round boundary.
- **Single panel**, sized 7 by 4.5 inches.

## Analysis and report figures

Analyze and ship modes use a multi-panel layout, with panel letters in bold at the top left of each panel (`ax.text(-0.08, 1.06, "A", transform=ax.transAxes, fontweight="bold", va="top")`):

- **Panel A:** each lane's metric trajectory across all rounds (the progress figure without the envelope).
- **Panel B:** the best-of-conference envelope with markers where a validated finding entered Shared Knowledge, each marker labelled with its finding id.
- **Panel C:** review verdicts per round as stacked bars (validated in bluish green, challenged in orange, overturned in vermillion).
- **Panel D (optional):** a lane-by-round heatmap of the best value per round, or a transfer graph showing which lane's finding fed which lane's next gain, when analyze mode has that data.

Per-lane plots (`researcher_<ID>_progress.png`) are optional. When a lane has no shell, the root draws them from the TSV after the round; they use the single-lane colours (kept blue, reverted vermillion, best-so-far bluish green, target orange).

## Checking a figure

Open the PNG with `read_file` (agy shows images) and check the seven rules by eye: axis end numbers visible, no overlapping labels, legend clear of the data, no title, legend text coloured, frame black, file size consistent with 600 DPI. Append an `evidence` ledger line with the figure path once it passes; analyze and ship modes cite that path.
