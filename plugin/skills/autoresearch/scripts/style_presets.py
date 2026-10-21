#!/usr/bin/env python3
"""
Figure style presets for autoresearch convergence plots.

Importing this module needs only the Python standard library. Applying the style with rcparams()
needs matplotlib in the user's own environment; when it is missing, rcparams() raises
StyleUnavailable with the install line to report, and the loop records the figure as skipped.

Usage from a plotting script the approved run writes:
    import sys
    sys.path.insert(0, "<skill-folder>/scripts")
    from style_presets import rcparams, OKABE_ITO, convergence_axes_labels
    rcparams()  # call before the first plt.subplots()

Command line:
    python3 style_presets.py --check   prints {"matplotlib": true|false, "palette": [...]} and exits 0
"""

import json
import sys

# Okabe-Ito palette: distinguishable under the common forms of colour-vision deficiency.
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

# Role colours for a convergence plot: kept iterations, reverted ones, guard violations, the best-so-far line.
ROLE_COLOURS = {
    "kept": "#0072B2",
    "reverted": "#999999",
    "guard_violation": "#D55E00",
    "best_so_far": "#009E73",
    "baseline": "#000000",
    "target": "#CC79A7",
}

PREFERRED_FONTS = ["Pretendard", "Arial", "Helvetica", "DejaVu Sans"]


class StyleUnavailable(RuntimeError):
    """Raised when matplotlib is not importable in this interpreter."""


def _matplotlib():
    try:
        import matplotlib as mpl
        from matplotlib import font_manager, rcParams
    except ImportError as error:
        raise StyleUnavailable(
            "matplotlib is not installed for this interpreter; the user can run "
            "'python3 -m pip install matplotlib' in their own environment, or skip the figure"
        ) from error
    return mpl, font_manager, rcParams


def convergence_axes_labels(metric_name: str, direction: str) -> dict:
    """Axis and title text for a convergence plot."""
    arrow = "higher is better" if direction == "maximize" else "lower is better"
    return {
        "xlabel": "Iteration",
        "ylabel": f"{metric_name} ({arrow})",
        "title": f"Convergence of {metric_name}",
    }


def rcparams() -> None:
    """Apply a clean, print-ready style. Call before creating any figure."""
    mpl, font_manager, rcParams = _matplotlib()

    rcParams["font.family"] = "sans-serif"
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in PREFERRED_FONTS:
        if name in available:
            rcParams["font.sans-serif"] = [name]
            break

    # Type sizes
    rcParams["font.size"] = 14
    rcParams["axes.titlesize"] = 18
    rcParams["axes.titleweight"] = "normal"
    rcParams["axes.titlepad"] = 10
    rcParams["axes.labelsize"] = 16
    rcParams["axes.labelweight"] = "normal"
    rcParams["axes.labelpad"] = 8
    rcParams["xtick.labelsize"] = 12
    rcParams["ytick.labelsize"] = 12

    # Ticks point inward, minor ticks visible
    for axis in ("xtick", "ytick"):
        rcParams[f"{axis}.direction"] = "in"
        rcParams[f"{axis}.minor.visible"] = True
        rcParams[f"{axis}.major.width"] = 1
        rcParams[f"{axis}.minor.width"] = 0.5
        rcParams[f"{axis}.major.size"] = 5
        rcParams[f"{axis}.minor.size"] = 3
        rcParams[f"{axis}.major.pad"] = 7
        rcParams[f"{axis}.color"] = "black"

    # Axes
    rcParams["axes.linewidth"] = 1
    rcParams["axes.edgecolor"] = "black"
    rcParams["axes.labelcolor"] = "black"
    rcParams["axes.axisbelow"] = True
    rcParams["axes.grid"] = False
    rcParams["axes.prop_cycle"] = mpl.cycler(color=OKABE_ITO)

    # Figure on a white background
    rcParams["figure.figsize"] = (5, 4)
    rcParams["figure.dpi"] = 100
    rcParams["figure.facecolor"] = "white"
    rcParams["figure.autolayout"] = False

    # Lines and markers
    rcParams["lines.linewidth"] = 1.5
    rcParams["lines.markersize"] = 5
    rcParams["lines.markeredgewidth"] = 0.5

    # Legend with an opaque black frame
    rcParams["legend.fontsize"] = 12
    rcParams["legend.frameon"] = True
    rcParams["legend.edgecolor"] = "black"
    rcParams["legend.framealpha"] = 1
    rcParams["legend.loc"] = "best"

    # Saved files: high resolution, tight box, opaque
    rcParams["savefig.dpi"] = 600
    rcParams["savefig.bbox"] = "tight"
    rcParams["savefig.pad_inches"] = 0.05
    rcParams["savefig.transparent"] = False
    rcParams["savefig.facecolor"] = "white"

    rcParams["image.cmap"] = "viridis"


def _check() -> int:
    try:
        _matplotlib()
        ready = True
    except StyleUnavailable:
        ready = False
    print(json.dumps({"matplotlib": ready, "palette": OKABE_ITO, "roles": ROLE_COLOURS}))
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        sys.exit(_check())
    print("usage: style_presets.py --check  (import the module to apply the style)", file=sys.stderr)
    sys.exit(2)
