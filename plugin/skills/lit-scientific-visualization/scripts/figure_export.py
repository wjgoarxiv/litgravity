#!/usr/bin/env python3
"""
Figure Export Utilities for Publication-Ready Scientific Figures

Exports matplotlib figures in publication-ready formats.
Default raster DPI is 600 (must be > 500 per project requirements). Vector
formats remain editable; DPI only affects rasterized artists embedded in them.
"""

import matplotlib.pyplot as plt
from pathlib import Path
from typing import List, Optional, Union


def save_publication_figure(
    fig: plt.Figure,
    filename: Union[str, Path],
    formats: Optional[List[str]] = None,
    dpi: int = 600,
    transparent: bool = True,
    bbox_inches: str = 'tight',
    pad_inches: float = 0.1,
    facecolor: str = 'white',
    **kwargs
) -> List[Path]:
    """
    Save a matplotlib figure in multiple formats with publication-quality settings.

    Parameters
    ----------
    fig : matplotlib.figure.Figure
        The figure to save
    filename : str or Path
        Base filename (without extension)
    formats : list of str, default ['pdf', 'png']
        List of file formats to save. Options: 'pdf', 'png', 'eps', 'svg', 'tiff'
    dpi : int, default 600
        Resolution for raster formats (png, tiff). Must be > 500.
    transparent : bool, default True
        If True, save with transparent background. Journal-specific exports
        override this to False unless explicitly changed.
    bbox_inches : str, default 'tight'
        Bounding box specification. 'tight' removes excess whitespace
    pad_inches : float, default 0.1
        Padding around the figure when bbox_inches='tight'
    facecolor : str, default 'white'
        Background color (ignored if transparent=True)
    **kwargs
        Additional keyword arguments passed to fig.savefig()

    Returns
    -------
    list of Path
        List of paths to saved files
    """
    if formats is None:
        formats = ['pdf', 'png']

    filename = Path(filename)
    base_name = filename.stem
    output_dir = filename.parent
    if not output_dir.exists():
        raise FileNotFoundError(f"Output directory does not exist: {output_dir}")

    saved_files = []

    for fmt in formats:
        output_file = output_dir / f"{base_name}.{fmt}"

        save_kwargs = {
            'dpi': dpi,
            'bbox_inches': bbox_inches,
            'pad_inches': pad_inches,
            'facecolor': facecolor if not transparent else 'none',
            'edgecolor': 'none',
            'transparent': transparent,
            'format': fmt,
        }

        save_kwargs.update(kwargs)

        try:
            fig.savefig(output_file, **save_kwargs)
            saved_files.append(output_file)
            print(f"Saved: {output_file}")
        except Exception as e:
            print(f"Failed to save {output_file}: {e}")

    return saved_files


def save_for_journal(
    fig: plt.Figure,
    filename: Union[str, Path],
    journal: str,
    figure_type: str = 'combination'
) -> List[Path]:
    """
    Save figure with journal-specific requirements.

    Parameters
    ----------
    fig : matplotlib.figure.Figure
        The figure to save
    filename : str or Path
        Base filename (without extension)
    journal : str
        Journal name. Options: 'nature', 'science', 'cell', 'plos', 'acs', 'ieee'
    figure_type : str, default 'combination'
        Type of figure. Options: 'line_art', 'photo', 'combination'

    Returns
    -------
    list of Path
        List of paths to saved files
    """
    journal = journal.lower()

    journal_specs = {
        'nature': {
            'line_art': {'formats': ['pdf', 'eps'], 'dpi': 1000},
            'photo': {'formats': ['tiff'], 'dpi': 600},
            'combination': {'formats': ['pdf'], 'dpi': 600},
        },
        'science': {
            'line_art': {'formats': ['eps', 'pdf'], 'dpi': 1000},
            'photo': {'formats': ['tiff'], 'dpi': 600},
            'combination': {'formats': ['eps'], 'dpi': 600},
        },
        'cell': {
            'line_art': {'formats': ['pdf', 'eps'], 'dpi': 1000},
            'photo': {'formats': ['tiff'], 'dpi': 600},
            'combination': {'formats': ['pdf'], 'dpi': 600},
        },
        'plos': {
            'line_art': {'formats': ['pdf', 'eps'], 'dpi': 600},
            'photo': {'formats': ['tiff', 'png'], 'dpi': 600},
            'combination': {'formats': ['tiff'], 'dpi': 600},
        },
        'acs': {
            'line_art': {'formats': ['tiff', 'pdf'], 'dpi': 600},
            'photo': {'formats': ['tiff'], 'dpi': 600},
            'combination': {'formats': ['tiff'], 'dpi': 600},
        },
        'ieee': {
            'line_art': {'formats': ['pdf', 'eps'], 'dpi': 600},
            'photo': {'formats': ['tiff'], 'dpi': 600},
            'combination': {'formats': ['pdf'], 'dpi': 600},
        },
    }

    if journal not in journal_specs:
        available = ', '.join(journal_specs.keys())
        raise ValueError(f"Journal '{journal}' not recognized. Available: {available}")

    if figure_type not in journal_specs[journal]:
        available = ', '.join(journal_specs[journal].keys())
        raise ValueError(f"Figure type '{figure_type}' not valid. Available: {available}")

    specs = journal_specs[journal][figure_type]

    return save_publication_figure(
        fig=fig,
        filename=filename,
        formats=specs['formats'],
        dpi=specs['dpi'],
        transparent=False,
        facecolor='white'
    )


def check_figure_size(fig: plt.Figure, journal: str = 'nature') -> dict:
    """
    Check if figure dimensions are appropriate for journal requirements.

    Parameters
    ----------
    fig : matplotlib.figure.Figure
        The figure to check
    journal : str, default 'nature'
        Journal name

    Returns
    -------
    dict
        Dictionary with figure dimensions and compliance status
    """
    journal = journal.lower()

    width_inches, height_inches = fig.get_size_inches()
    width_mm = width_inches * 25.4
    height_mm = height_inches * 25.4

    specs = {
        'nature': {'single': 89, 'one_half': 120, 'double': 183, 'max_height': 247},
        'science': {'single': 55, 'one_half': 120, 'double': 175, 'max_height': 233},
        'cell': {'single': 85, 'double': 178, 'max_height': 230},
        'plos': {'single': 83, 'one_half': 114, 'double': 173, 'max_height': 233},
        'acs': {'single': 82.5, 'double': 178, 'max_height': 247},
        'ieee': {'single': 89, 'double': 182, 'max_height': 247},
    }

    if journal not in specs:
        journal_spec = specs['nature']
    else:
        journal_spec = specs[journal]

    column_type = None
    width_ok = False

    tolerance = 5  # mm
    for width_name in ('single', 'one_half', 'double'):
        if width_name in journal_spec and abs(width_mm - journal_spec[width_name]) < tolerance:
            column_type = width_name
            width_ok = True
            break

    height_ok = height_mm <= journal_spec['max_height']

    result = {
        'width_inches': width_inches,
        'height_inches': height_inches,
        'width_mm': width_mm,
        'height_mm': height_mm,
        'journal': journal,
        'column_type': column_type,
        'width_ok': width_ok,
        'height_ok': height_ok,
        'compliant': width_ok and height_ok,
        'recommendations': {
            'single_column_mm': journal_spec['single'],
            'one_half_column_mm': journal_spec.get('one_half'),
            'double_column_mm': journal_spec['double'],
            'max_height_mm': journal_spec['max_height'],
        }
    }

    return result
