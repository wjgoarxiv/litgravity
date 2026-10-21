# Convergence figures

A run may end with a figure that shows how the metric moved: `results.png` and `results.pdf` under the artifact root. The figure is optional; the results table is the record. Read this file with `read_file` before writing the plotting script, and check the finished figure against the rules below before citing it in `final_report.md`.

## Authority

Rendering writes files and runs a plotting interpreter, so the figure's output paths, the source files it reads and the command are part of the approved packet. Without that approval, describe the trend in words in the report and skip the figure. The plotting script reads `autoresearch-results.tsv` and writes only the two figure files and the script itself, all under the artifact root.

## Runtime

The figure needs Python with matplotlib. agy installs nothing for this skill on its own, so pick one of these routes in order:

1. When the `lit-scientific-visualization` skill is present (read `../lit-scientific-visualization/SKILL.md` with `read_file`), use the `sciviz` engine it declares: check it with its runtime `status --json`, install on first use with its `install --json`, and run the plotting script through it. That engine installs only under `$XDG_DATA_HOME/litgravity/runtime/sciviz`.
2. When the project already has a Python environment with matplotlib, run the script with it.
3. Otherwise skip the figure, say so in one line of the report, and keep the TSV as the evidence. A headless run that cannot install stops the figure step, never the run.

This skill's `scripts/` folder carries a small style preset module for matplotlib (SKILL.md names it). Import it before creating any axes so every autoresearch figure looks the same; when it is unavailable, set the same values by hand from the table below.

## Seven rules every figure follows

1. **Both axes show their end values.** Set limits explicitly (`set_xlim`, `set_ylim`) so the first and last tick carry numbers.
2. **Panels keep their spacing.** Use `constrained_layout=True` or `tight_layout(pad=1.5)`; labels never overlap.
3. **The legend sits clear of the data.** Move it (`loc`, `bbox_to_anchor`) until no point is hidden.
4. **No titles on the axes or the figure.** The caption in the report carries the explanation.
5. **Legend text takes its series colour.** After drawing the legend, set each text entry's colour to its line or marker colour.
6. **Legend frame is black and opaque.** `frameon=True, edgecolor='black', framealpha=1`.
7. **Resolution above 500 dpi.** Save PNG and PDF at 600 dpi with `bbox_inches='tight'`.

## Style values

| Setting | Value |
|---|---|
| font family | Pretendard when installed, else Arial, else the system sans-serif |
| font sizes | base 14, axis labels 16, tick labels 12 |
| ticks | inward, minor ticks visible |
| background | white |
| palette | Okabe-Ito (table below), colour-blind safe |
| output | `results.png` and `results.pdf`, 600 dpi |

## Layout: two panels

```python
import csv
import matplotlib.pyplot as plt

rows = list(csv.DictReader(open("autoresearch-results.tsv"), delimiter="\t"))
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), constrained_layout=True)
for ax, label in ((ax1, "A"), (ax2, "B")):
    ax.text(-0.08, 1.08, label, transform=ax.transAxes, fontsize=16, fontweight="bold", va="top")
```

**Panel A, convergence.**
- Kept iterations as blue points (`#0072B2`), reverted and guard-violation iterations as vermillion points (`#D55E00`).
- The best-so-far line in bluish green (`#009E73`), stepped, so it only moves on a keep.
- The target as an orange dashed line (`#E69F00`).
- The baseline and best values annotated with their numbers.
- `reference` rows as black open markers (`#000000`), labelled, outside the best-so-far line.

**Panel B, the domain result.** Choose by what was optimised:

| Run type | Panel B |
|---|---|
| code speed | bar chart of runtime per kept iteration |
| model or curve fit | predictions over the data points |
| error count (`fix` mode) | stacked bars of remaining errors by category |
| prompt or document quality | score per criterion, baseline against final |
| coverage modes (`scenario`, `security`) | filled cells or addressed findings per category |

## Okabe-Ito palette

| Colour | Hex | Use |
|---|---|---|
| orange | `#E69F00` | target line, warnings |
| sky blue | `#56B4E9` | secondary series, training data |
| bluish green | `#009E73` | best-so-far, success |
| yellow | `#F0E442` | highlights |
| blue | `#0072B2` | kept iterations, primary series |
| vermillion | `#D55E00` | reverted iterations, errors |
| reddish purple | `#CC79A7` | prediction curves |
| black | `#000000` | baseline, reference points, text |

## Checking the figure

Open `results.png` with `read_file` (it renders images) and confirm: both panels present, end ticks labelled, legend clear of data and coloured per series, no title, target line visible when a target exists. Record the check as an `evidence` line in the ledger pointing at the PNG. A figure that fails a rule is fixed before the report cites it; when it cannot be fixed inside the budget, the report drops it and says why.
