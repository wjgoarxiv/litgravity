#!/usr/bin/env python3
"""
Matplotlib Style Presets for Publication-Ready Scientific Figures

Primary style is set via rcparams(), which configures Pretendard first, Arial
fallback second, emergency system font fallbacks after that, inward ticks with
minor ticks visible, grids off, transparent tight generic export, and
publication-appropriate sizing.
"""

import matplotlib.pyplot as plt
import matplotlib as mpl
from matplotlib import rcParams
from matplotlib import font_manager
from typing import Optional, Dict, Any, Tuple


# Okabe-Ito colorblind-friendly palette
OKABE_ITO_COLORS = [
    '#E69F00',  # Orange
    '#56B4E9',  # Sky Blue
    '#009E73',  # Bluish Green
    '#F0E442',  # Yellow
    '#0072B2',  # Blue
    '#D55E00',  # Vermillion
    '#CC79A7',  # Reddish Purple
    '#000000'   # Black
]

# Paul Tol palettes
TOL_BRIGHT = ['#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE', '#AA3377', '#BBBBBB']
TOL_MUTED = ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#882255', '#AA4499']
TOL_HIGH_CONTRAST = ['#004488', '#DDAA33', '#BB5566']

# Wong palette
WONG_COLORS = ['#000000', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7']

PREFERRED_FONT_STACK = [
    'Pretendard',
    'Arial',
    'Helvetica',
    'DejaVu Sans',
    'AppleGothic',
    'Noto Sans CJK KR',
    'Noto Sans CJK SC',
    'Noto Sans CJK JP',
    'Malgun Gothic',
]

JOURNAL_CONFIGS = {
    'nature': {
        'widths': {'single': 89, 'one_half': 120, 'double': 183},
        'max_height': 247,
        'style': 'nature',
    },
    'science': {
        'widths': {'single': 55, 'one_half': 120, 'double': 175},
        'max_height': 233,
        'style': 'science',
    },
    'cell': {
        'widths': {'single': 85, 'double': 178},
        'max_height': 230,
        'style': 'cell',
    },
    'plos': {
        'widths': {'single': 83, 'one_half': 114, 'double': 173},
        'max_height': 233,
        'style': 'default',
    },
    'acs': {
        'widths': {'single': 82.5, 'double': 178},
        'max_height': 247,
        'style': 'default',
    },
    'ieee': {
        'widths': {'single': 89, 'double': 182},
        'max_height': 247,
        'style': 'default',
    },
}


def _available_preferred_fonts() -> list:
    """Return installed fonts from the preferred publication fallback stack."""
    available_fonts = {f.name for f in font_manager.fontManager.ttflist}
    installed = [name for name in PREFERRED_FONT_STACK if name in available_fonts]
    return installed or PREFERRED_FONT_STACK


def rcparams():
    """
    Apply the canonical publication style. This is the primary style function
    that must be called at the start of every figure script.

    Sets Pretendard first and Arial fallback second, then emergency system
    fallbacks, inward ticks with minor ticks, and publication-appropriate font
    sizes.
    """
    rcParams['figure.figsize'] = 5, 4
    rcParams['font.family'] = 'sans-serif'

    rcParams['font.sans-serif'] = _available_preferred_fonts()
    rcParams['pdf.fonttype'] = 42
    rcParams['ps.fonttype'] = 42
    rcParams['svg.fonttype'] = 'none'

    # Label should be far away from the axes
    rcParams['axes.labelpad'] = 8
    rcParams['xtick.major.pad'] = 7
    rcParams['ytick.major.pad'] = 7

    # Add minor ticks
    rcParams['xtick.minor.visible'] = True
    rcParams['ytick.minor.visible'] = True

    # Tick width
    rcParams['xtick.major.width'] = 1
    rcParams['ytick.major.width'] = 1
    rcParams['xtick.minor.width'] = 0.5
    rcParams['ytick.minor.width'] = 0.5

    # Tick length
    rcParams['xtick.major.size'] = 5
    rcParams['ytick.major.size'] = 5
    rcParams['xtick.minor.size'] = 3
    rcParams['ytick.minor.size'] = 3

    # Tick color
    rcParams['xtick.color'] = 'black'
    rcParams['ytick.color'] = 'black'

    rcParams['font.size'] = 14
    rcParams['axes.titlepad'] = 10
    rcParams['axes.titleweight'] = 'normal'
    rcParams['axes.titlesize'] = 18

    # Axes settings
    rcParams['axes.labelweight'] = 'normal'
    rcParams['xtick.labelsize'] = 12
    rcParams['ytick.labelsize'] = 12
    rcParams['axes.labelsize'] = 16
    rcParams['xtick.direction'] = 'in'
    rcParams['ytick.direction'] = 'in'

    # Additional publication defaults
    rcParams['axes.linewidth'] = 1
    rcParams['axes.edgecolor'] = 'black'
    rcParams['axes.labelcolor'] = 'black'
    rcParams['axes.axisbelow'] = True
    rcParams['axes.grid'] = False
    rcParams['axes.prop_cycle'] = mpl.cycler(color=OKABE_ITO_COLORS)

    # Figure
    rcParams['figure.dpi'] = 100
    rcParams['figure.facecolor'] = 'white'
    rcParams['figure.autolayout'] = False

    # Lines
    rcParams['lines.linewidth'] = 1.5
    rcParams['lines.markersize'] = 5
    rcParams['lines.markeredgewidth'] = 0.5

    # Legend — black border, fully opaque
    rcParams['legend.fontsize'] = 12
    rcParams['legend.frameon'] = True
    rcParams['legend.edgecolor'] = 'black'
    rcParams['legend.framealpha'] = 1
    rcParams['legend.loc'] = 'best'

    # Savefig — DPI > 500
    rcParams['savefig.dpi'] = 600
    rcParams['savefig.format'] = 'pdf'
    rcParams['savefig.bbox'] = 'tight'
    rcParams['savefig.pad_inches'] = 0.05
    rcParams['savefig.transparent'] = True
    rcParams['savefig.facecolor'] = 'none'

    # Image
    rcParams['image.cmap'] = 'viridis'
    rcParams['image.aspect'] = 'auto'


# Keep backward compatibility
def apply_publication_style(style_name: str = 'default') -> None:
    """
    Apply a pre-configured publication style.

    Calls rcparams() first, then applies journal-specific overrides.

    Parameters
    ----------
    style_name : str, default 'default'
        Name of the style to apply. Options:
        - 'default': General publication style (rcparams)
        - 'nature': Nature journal style
        - 'science': Science journal style
        - 'cell': Cell Press style
        - 'minimal': Minimal clean style
        - 'presentation': Larger fonts for presentations
    """
    # Always start from rcparams base
    rcparams()

    # Style-specific modifications (overlaid on rcparams)
    if style_name == 'nature':
        mpl.rcParams.update({
            'font.size': 7,
            'axes.labelsize': 8,
            'axes.titlesize': 8,
            'xtick.labelsize': 6,
            'ytick.labelsize': 6,
            'legend.fontsize': 6,
            'savefig.transparent': False,
            'savefig.facecolor': 'white',
        })

    elif style_name == 'science':
        mpl.rcParams.update({
            'font.size': 7,
            'axes.labelsize': 8,
            'xtick.labelsize': 6,
            'ytick.labelsize': 6,
            'legend.fontsize': 6,
            'savefig.transparent': False,
            'savefig.facecolor': 'white',
        })

    elif style_name == 'cell':
        mpl.rcParams.update({
            'font.size': 8,
            'axes.labelsize': 9,
            'xtick.labelsize': 7,
            'ytick.labelsize': 7,
            'legend.fontsize': 7,
            'savefig.transparent': False,
            'savefig.facecolor': 'white',
        })

    elif style_name == 'minimal':
        mpl.rcParams.update({
            'axes.linewidth': 0.8,
            'lines.linewidth': 2,
        })

    elif style_name == 'presentation':
        mpl.rcParams.update({
            'font.size': 14,
            'axes.labelsize': 16,
            'axes.titlesize': 18,
            'xtick.labelsize': 12,
            'ytick.labelsize': 12,
            'legend.fontsize': 12,
            'axes.linewidth': 1.5,
            'lines.linewidth': 2.5,
            'lines.markersize': 8,
        })

    elif style_name != 'default':
        print(f"Warning: Style '{style_name}' not recognized. Using 'default'.")


def set_color_palette(palette_name: str = 'okabe_ito') -> None:
    """
    Set a colorblind-friendly color palette.

    Parameters
    ----------
    palette_name : str, default 'okabe_ito'
        Name of the palette. Options:
        'okabe_ito', 'wong', 'tol_bright', 'tol_muted', 'tol_high_contrast'
    """
    palettes = {
        'okabe_ito': OKABE_ITO_COLORS,
        'wong': WONG_COLORS,
        'tol_bright': TOL_BRIGHT,
        'tol_muted': TOL_MUTED,
        'tol_high_contrast': TOL_HIGH_CONTRAST,
    }

    if palette_name not in palettes:
        available = ', '.join(palettes.keys())
        print(f"Warning: Palette '{palette_name}' not found. Available: {available}")
        palette_name = 'okabe_ito'

    colors = palettes[palette_name]
    plt.rcParams['axes.prop_cycle'] = plt.cycler(color=colors)


def figure_size_for_journal(
    journal: str,
    figure_width: str = 'single',
    aspect: float = 0.75,
) -> Tuple[float, float]:
    """
    Return a journal-safe figure size in inches.

    Parameters
    ----------
    journal : str
        Journal name: 'nature', 'science', 'cell', 'plos', 'acs', 'ieee'
    figure_width : str, default 'single'
        Figure width: 'single', 'one_half' where supported, or 'double'
    aspect : float, default 0.75
        Height / width ratio before max-height clipping.
    """
    journal = journal.lower()
    if journal not in JOURNAL_CONFIGS:
        available = ', '.join(JOURNAL_CONFIGS.keys())
        raise ValueError(f"Journal '{journal}' not recognized. Available: {available}")

    config = JOURNAL_CONFIGS[journal]
    widths = config['widths']
    if figure_width not in widths:
        available = ', '.join(widths.keys())
        raise ValueError(f"Figure width '{figure_width}' not valid for {journal}. Available: {available}")

    width_inches = widths[figure_width] / 25.4
    max_height_inches = config['max_height'] / 25.4
    height_inches = min(width_inches * aspect, max_height_inches)
    return width_inches, height_inches


def configure_for_journal(journal: str, figure_width: str = 'single', aspect: float = 0.75) -> None:
    """
    Configure matplotlib for a specific journal.

    Calls rcparams() first, then applies journal-specific size and font overrides.

    Parameters
    ----------
    journal : str
        Journal name: 'nature', 'science', 'cell', 'plos', 'acs', 'ieee'
    figure_width : str, default 'single'
        Figure width: 'single', 'one_half' where supported, or 'double' column
    aspect : float, default 0.75
        Height / width ratio before max-height clipping
    """
    journal = journal.lower()

    if journal not in JOURNAL_CONFIGS:
        available = ', '.join(JOURNAL_CONFIGS.keys())
        raise ValueError(f"Journal '{journal}' not recognized. Available: {available}")

    config = JOURNAL_CONFIGS[journal]

    # Apply style (which calls rcparams() internally)
    apply_publication_style(config['style'])

    plt.rcParams['figure.figsize'] = figure_size_for_journal(journal, figure_width, aspect)


def ensure_zero_origin_ticks(ax, x: bool = False, y: bool = False, nbins: int = 5) -> None:
    """Ensure axes that start at zero also have their first major tick at zero."""
    locator = mpl.ticker.MaxNLocator(nbins=max(1, nbins - 1))

    def ticks_from_zero(upper):
        if upper <= 0:
            return [0]
        ticks = [tick for tick in locator.tick_values(0, upper) if 0 <= tick <= upper]
        if not ticks or abs(ticks[0]) > 1e-12:
            ticks.insert(0, 0)
        if ticks[-1] < upper and len(ticks) < nbins + 1:
            ticks.append(upper)
        return ticks

    if x:
        left, right = ax.get_xlim()
        if abs(left) <= 1e-12:
            ax.set_xticks(ticks_from_zero(right))
            ax.set_xlim(0, right)

    if y:
        bottom, top = ax.get_ylim()
        if abs(bottom) <= 1e-12:
            ax.set_yticks(ticks_from_zero(top))
            ax.set_ylim(0, top)


def _artist_color(artist):
    if hasattr(artist, 'get_color'):
        return artist.get_color()
    if hasattr(artist, 'get_facecolor'):
        colors = artist.get_facecolor()
        try:
            if len(colors) == 4 and not hasattr(colors[0], '__len__'):
                return tuple(colors)
            if len(colors):
                first = colors[0]
                return tuple(first) if hasattr(first, '__len__') else tuple(colors)
        except TypeError:
            return colors
    return 'black'


def style_legend(ax, color_text: bool = False, outside: bool = False, **kwargs):
    """
    Create a publication-safe legend with black border and optional colored text.

    Nature-style output should keep legend text black and use colored handles;
    set ``color_text=True`` only when the target style explicitly wants colored
    legend labels.
    """
    legend_kwargs = {
        'frameon': True,
        'edgecolor': 'black',
        'framealpha': 1,
    }
    if outside:
        legend_kwargs.update({'loc': 'center left', 'bbox_to_anchor': (1.02, 0.5), 'borderaxespad': 0})
    legend_kwargs.update(kwargs)

    legend = ax.legend(**legend_kwargs)
    legend.get_frame().set_edgecolor('black')
    legend.get_frame().set_alpha(1)
    handles = getattr(legend, 'legend_handles', None) or getattr(legend, 'legendHandles', None)
    if handles is None:
        handles, _ = ax.get_legend_handles_labels()
    for text, handle in zip(legend.get_texts(), handles):
        text.set_color(_artist_color(handle) if color_text else 'black')
    return legend


def plot_scatter_only(ax, x, y, **kwargs):
    """
    Plot independent observations as scatter only, with no connecting lines.

    Use this for unordered observations, replicate clouds, correlations,
    embeddings, and other point data where connecting observations would imply
    a trajectory or interpolation that is not scientifically justified.
    """
    kwargs.setdefault('edgecolors', 'none')
    return ax.scatter(x, y, **kwargs)


def reset_to_default() -> None:
    """Reset matplotlib to default settings."""
    mpl.rcdefaults()


def show_color_palettes() -> None:
    """Display available color palettes for visual inspection."""
    palettes = {
        'Okabe-Ito': OKABE_ITO_COLORS,
        'Wong': WONG_COLORS,
        'Tol Bright': TOL_BRIGHT,
        'Tol Muted': TOL_MUTED,
        'Tol High Contrast': TOL_HIGH_CONTRAST,
    }

    fig, axes = plt.subplots(len(palettes), 1, figsize=(8, len(palettes) * 0.5))

    for ax, (name, colors) in zip(axes, palettes.items()):
        ax.set_xlim(0, len(colors))
        ax.set_ylim(0, 1)
        ax.set_yticks([])
        ax.set_xticks([])
        ax.set_ylabel(name, fontsize=10)

        for i, color in enumerate(colors):
            ax.add_patch(plt.Rectangle((i, 0), 1, 1, facecolor=color, edgecolor='black', linewidth=0.5))
            ax.text(i + 0.5, 0.5, color, ha='center', va='center',
                   fontsize=7, color='white' if i >= len(colors) - 1 else 'black')

    fig.suptitle('Colorblind-Friendly Palettes', fontsize=12, fontweight='bold')
    plt.tight_layout()
    plt.show()
