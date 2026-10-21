#!/usr/bin/env python3
"""
style_presets.py: matplotlib style for autoconference figures (conference_progress.png,
researcher heatmaps, synthesis diagrams). The rules it encodes are in references/visualization-guide.md.

The module imports with the standard library alone; matplotlib is loaded when rcparams() runs.
Run figure scripts through the sciviz engine of the lit-scientific-visualization skill, which
provides a pinned matplotlib in its own runtime cache:

    node "<skills-dir>/lit-scientific-visualization/scripts/sciviz-runtime.mjs" run -- plot_progress.py

Inside a figure script:

    import os, sys
    sys.path.insert(0, os.path.join("<skill-folder>", "scripts"))
    from style_presets import rcparams, OKABE_ITO
    rcparams()  # before the first plt.subplots()

Running this file directly prints the palette and whether matplotlib is importable (exit 0 when it is,
1 when it is missing), which makes a quick readiness probe.
"""

import importlib.util
import sys

# Okabe-Ito, a palette that stays distinguishable under the common colour-vision deficiencies.
OKABE_ITO = [
    "#E69F00",  # orange
    "#56B4E9",  # sky blue
    "#009E73",  # bluish green
    "#F0E442",  # yellow
    "#0072B2",  # blue
    "#D55E00",  # vermillion
    "#CC79A7",  # reddish purple
    "#000000",  # black
]

TARGET_LINE = {"color": "#555555", "linestyle": "--", "linewidth": 1.0}
ENVELOPE_LINE = {"color": "#000000", "linewidth": 2.0}


class MatplotlibMissing(RuntimeError):
    """Raised when rcparams() runs without matplotlib on the path."""


def matplotlib_available() -> bool:
    return importlib.util.find_spec("matplotlib") is not None


def rcparams():
    """Apply the publication style. Call before creating any figure."""
    if not matplotlib_available():
        raise MatplotlibMissing(
            "matplotlib is not importable; run the figure script through the sciviz engine "
            "(sciviz-runtime.mjs run -- <script>) or skip the figure and note it in the round log."
        )
    import matplotlib as mpl
    from matplotlib import font_manager, rcParams

    # Font: Pretendard when installed, then Arial, then the system sans-serif.
    rcParams["font.family"] = "sans-serif"
    available = {f.name for f in font_manager.fontManager.ttflist}
    if "Pretendard" in available:
        rcParams["font.sans-serif"] = ["Pretendard"]
    elif "Arial" in available:
        rcParams["font.sans-serif"] = ["Arial"]

    rcParams["font.size"] = 14
    rcParams["axes.titlesize"] = 18
    rcParams["axes.titleweight"] = "normal"
    rcParams["axes.titlepad"] = 10
    rcParams["axes.labelsize"] = 16
    rcParams["axes.labelweight"] = "normal"
    rcParams["axes.labelpad"] = 8
    rcParams["xtick.labelsize"] = 12
    rcParams["ytick.labelsize"] = 12

    # Ticks point inward, with minor ticks visible.
    rcParams["xtick.direction"] = "in"
    rcParams["ytick.direction"] = "in"
    rcParams["xtick.minor.visible"] = True
    rcParams["ytick.minor.visible"] = True
    rcParams["xtick.major.width"] = 1
    rcParams["ytick.major.width"] = 1
    rcParams["xtick.minor.width"] = 0.5
    rcParams["ytick.minor.width"] = 0.5
    rcParams["xtick.major.size"] = 5
    rcParams["ytick.major.size"] = 5
    rcParams["xtick.minor.size"] = 3
    rcParams["ytick.minor.size"] = 3
    rcParams["xtick.major.pad"] = 7
    rcParams["ytick.major.pad"] = 7
    rcParams["xtick.color"] = "black"
    rcParams["ytick.color"] = "black"

    rcParams["axes.linewidth"] = 1
    rcParams["axes.edgecolor"] = "black"
    rcParams["axes.labelcolor"] = "black"
    rcParams["axes.axisbelow"] = True
    rcParams["axes.grid"] = False
    rcParams["axes.prop_cycle"] = mpl.cycler(color=OKABE_ITO)

    # White figure background, single-panel default size.
    rcParams["figure.figsize"] = (5, 4)
    rcParams["figure.dpi"] = 100
    rcParams["figure.facecolor"] = "white"
    rcParams["figure.autolayout"] = False

    rcParams["lines.linewidth"] = 1.5
    rcParams["lines.markersize"] = 5
    rcParams["lines.markeredgewidth"] = 0.5

    # Legend with a black, fully opaque frame.
    rcParams["legend.fontsize"] = 12
    rcParams["legend.frameon"] = True
    rcParams["legend.edgecolor"] = "black"
    rcParams["legend.framealpha"] = 1
    rcParams["legend.loc"] = "best"

    # Saved files: 600 dpi, tight box, opaque white.
    rcParams["savefig.dpi"] = 600
    rcParams["savefig.bbox"] = "tight"
    rcParams["savefig.pad_inches"] = 0.05
    rcParams["savefig.transparent"] = False
    rcParams["savefig.facecolor"] = "white"

    rcParams["image.cmap"] = "viridis"


def color_legend_text(legend):
    """Colour each legend label like its line, as the visualization guide asks."""
    for text, handle in zip(legend.get_texts(), legend.legend_handles if hasattr(legend, "legend_handles") else legend.legendHandles):
        color = handle.get_color() if hasattr(handle, "get_color") else None
        if color is not None:
            text.set_color(color)


if __name__ == "__main__":
    print("Okabe-Ito:", " ".join(OKABE_ITO))
    ok = matplotlib_available()
    print("matplotlib:", "importable" if ok else "missing (use the sciviz engine)")
    sys.exit(0 if ok else 1)
