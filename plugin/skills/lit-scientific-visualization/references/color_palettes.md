## Table of Contents

- [Overview](#overview)
- [Colorblind-Friendly Palettes](#colorblind-friendly-palettes)
  - [Okabe-Ito Palette (Recommended for Categories)](#okabe-ito-palette-recommended-for-categories)
  - [Wong Palette (Alternative for Categories)](#wong-palette-alternative-for-categories)
  - [Paul Tol Palettes](#paul-tol-palettes)
- [Sequential Colormaps (Continuous Data)](#sequential-colormaps-continuous-data)
  - [Perceptually Uniform Colormaps](#perceptually-uniform-colormaps)
  - [When to Use Sequential Maps](#when-to-use-sequential-maps)
- [Diverging Colormaps (Negative to Positive)](#diverging-colormaps-negative-to-positive)
  - [Colorblind-Safe Diverging Maps](#colorblind-safe-diverging-maps)
  - [Avoid These Diverging Maps](#avoid-these-diverging-maps)
  - [When to Use Diverging Maps](#when-to-use-diverging-maps)
- [Special Purpose Palettes](#special-purpose-palettes)
  - [For Genomics/Bioinformatics](#for-genomicsbioinformatics)
  - [For Microscopy](#for-microscopy)
- [Color Usage Best Practices](#color-usage-best-practices)
  - [Categorical Data (Qualitative Color Schemes)](#categorical-data-qualitative-color-schemes)
  - [Continuous Data (Sequential/Diverging Schemes)](#continuous-data-sequentialdiverging-schemes)
- [Testing for Colorblind Accessibility](#testing-for-colorblind-accessibility)
  - [Online Simulators](#online-simulators)
  - [Types of Color Vision Deficiency](#types-of-color-vision-deficiency)
  - [Python Tools](#python-tools)
- [Implementation Examples](#implementation-examples)
  - [Setting Global Matplotlib Style](#setting-global-matplotlib-style)
  - [Seaborn with Custom Palette](#seaborn-with-custom-palette)
  - [Plotly with Discrete Colors](#plotly-with-discrete-colors)
- [Grayscale Compatibility](#grayscale-compatibility)
- [Color Spaces](#color-spaces)
  - [RGB vs CMYK](#rgb-vs-cmyk)
  - [Matplotlib Color Spaces](#matplotlib-color-spaces)
- [Common Mistakes](#common-mistakes)
- [Resources](#resources)

# Scientific Color Palettes and Guidelines

## Overview

Color carries meaning in a scientific figure, so the palette decides whether a reader can tell groups apart and read magnitudes correctly. This reference collects colorblind-friendly palettes, colormap recommendations and working rules for applying them.

## Colorblind-Friendly Palettes

### Okabe-Ito Palette (Recommended for Categories)

Okabe and Ito built this set so that readers with any form of color vision deficiency can separate every hue. Reach for it first whenever a figure needs categorical colors.

```python
# Okabe-Ito colors (RGB values)
okabe_ito = {
    'orange': '#E69F00',      # RGB: (230, 159, 0)
    'sky_blue': '#56B4E9',    # RGB: (86, 180, 233)
    'bluish_green': '#009E73', # RGB: (0, 158, 115)
    'yellow': '#F0E442',      # RGB: (240, 228, 66)
    'blue': '#0072B2',        # RGB: (0, 114, 178)
    'vermillion': '#D55E00',  # RGB: (213, 94, 0)
    'reddish_purple': '#CC79A7', # RGB: (204, 121, 167)
    'black': '#000000'        # RGB: (0, 0, 0)
}
```

**Usage in Matplotlib:**
```python
import matplotlib.pyplot as plt
from style_presets import rcparams, set_color_palette

rcparams()
set_color_palette('okabe_ito')
```

**Usage in Seaborn:**
```python
import seaborn as sns

okabe_ito_palette = ['#E69F00', '#56B4E9', '#009E73', '#F0E442',
                      '#0072B2', '#D55E00', '#CC79A7']
sns.set_palette(okabe_ito_palette)
```

**Usage in Plotly:**
```python
import plotly.graph_objects as go

okabe_ito_plotly = ['#E69F00', '#56B4E9', '#009E73', '#F0E442',
                     '#0072B2', '#D55E00', '#CC79A7']
fig = go.Figure()
# Apply to discrete color scale
```

### Wong Palette (Alternative for Categories)

Bang Wong (Nature Methods) published a second strong colorblind-friendly set. It shares its hues with Okabe-Ito and lists black first.

```python
wong_palette = {
    'black': '#000000',
    'orange': '#E69F00',
    'sky_blue': '#56B4E9',
    'green': '#009E73',
    'yellow': '#F0E442',
    'blue': '#0072B2',
    'vermillion': '#D55E00',
    'purple': '#CC79A7'
}
```

### Paul Tol Palettes

Paul Tol designed several palettes, each tuned for a different number of categories and a different visual weight.

**Bright Palette (up to 7 categories):**
```python
tol_bright = ['#4477AA', '#EE6677', '#228833', '#CCBB44',
              '#66CCEE', '#AA3377', '#BBBBBB']
```

**Muted Palette (up to 9 categories):**
```python
tol_muted = ['#332288', '#88CCEE', '#44AA99', '#117733',
             '#999933', '#DDCC77', '#CC6677', '#882255', '#AA4499']
```

**High Contrast (3 categories only):**
```python
tol_high_contrast = ['#004488', '#DDAA33', '#BB5566']
```

## Sequential Colormaps (Continuous Data)

A sequential colormap maps low-to-high values along a single hue ramp that grows steadily in lightness.

### Perceptually Uniform Colormaps

Equal steps in the data produce equal perceived steps in color across the whole scale.

**Viridis (default in Matplotlib):**
- Readable for colorblind viewers
- Keeps its ordering when printed in grayscale
- Perceptually uniform
```python
plt.imshow(data, cmap='viridis')
```

**Cividis:**
- Optimized for colorblind viewers
- Built around deuteranopia and protanopia
```python
plt.imshow(data, cmap='cividis')
```

**Plasma, Inferno, Magma:**
- Perceptually uniform siblings of viridis
- Offer different looks when aesthetic preference matters
```python
plt.imshow(data, cmap='plasma')
```

### When to Use Sequential Maps
- Heatmaps showing intensity
- Geographic elevation data
- Probability distributions
- Any single-variable continuous data (low → high)

## Diverging Colormaps (Negative to Positive)

A diverging colormap places a neutral color at the center and two contrasting hues at the extremes.

### Colorblind-Safe Diverging Maps

**RdYlBu (Red-Yellow-Blue):**
```python
plt.imshow(data, cmap='RdYlBu_r')  # _r reverses: blue (low) to red (high)
```

**PuOr (Purple-Orange):**
- Works very well for colorblind viewers
```python
plt.imshow(data, cmap='PuOr')
```

**BrBG (Brown-Blue-Green):**
- Offers good colorblind accessibility
```python
plt.imshow(data, cmap='BrBG')
```

### Avoid These Diverging Maps
- **RdGn (Red-Green)**: red-green colorblind readers lose the contrast
- **RdYlGn (Red-Yellow-Green)**: the same red-green confusion applies

### When to Use Diverging Maps
- Correlation matrices
- Change/difference data (positive vs. negative)
- Deviation from a central value
- Temperature anomalies

## Special Purpose Palettes

### For Genomics/Bioinformatics

**Sequence type identification:**
```python
# DNA/RNA bases
nucleotide_colors = {
    'A': '#00CC00',  # Green
    'C': '#0000CC',  # Blue
    'G': '#FFB300',  # Orange
    'T': '#CC0000',  # Red
    'U': '#CC0000'   # Red (RNA)
}
```

**Gene expression:**
- Sequential colormaps (viridis, YlOrRd) suit expression levels
- Diverging colormaps (RdBu) suit log2 fold change

### For Microscopy

**Fluorescence channels:**
```python
# Traditional fluorophore colors (use with caution)
fluorophore_colors = {
    'DAPI': '#0000FF',      # Blue - DNA
    'GFP': '#00FF00',       # Green (problematic for colorblind)
    'RFP': '#FF0000',       # Red
    'Cy5': '#FF00FF'        # Magenta
}

# Colorblind-friendly alternatives
fluorophore_alt = {
    'Channel1': '#0072B2',  # Blue
    'Channel2': '#E69F00',  # Orange (instead of green)
    'Channel3': '#D55E00',  # Vermillion
    'Channel4': '#CC79A7'   # Magenta
}
```

## Color Usage Best Practices

### Categorical Data (Qualitative Color Schemes)

**Do:**
- Pick distinct, saturated colors from the Okabe-Ito or Wong palette
- Cap each plot at 7-8 categories
- Assign every category one color and keep it across all figures
- Add patterns or markers wherever color alone may fall short

**Avoid:**
- Red/green pairings
- The rainbow (jet) colormap for categories
- Neighboring hues that look alike

### Continuous Data (Sequential/Diverging Schemes)

**Do:**
- Choose perceptually uniform colormaps (viridis, plasma, cividis)
- Select a diverging map when the data has a meaningful center point
- Attach a colorbar with labeled ticks
- Check the appearance in grayscale

**Avoid:**
- The rainbow (jet) colormap, whose steps are perceptually uneven
- Red-green diverging maps
- Heatmaps that lack a colorbar

## Testing for Colorblind Accessibility

### Online Simulators
- **Coblis**: https://www.color-blindness.com/coblis-color-blindness-simulator/
- **Color Oracle**: Free downloadable tool for Windows/Mac/Linux
- **Sim Daltonism**: Mac application

### Types of Color Vision Deficiency
- **Deuteranopia** (~5% of males): no green perception
- **Protanopia** (~2% of males): no red perception
- **Tritanopia** (<1%): no blue perception (rare)

### Python Tools
```python
# Using colorspacious to simulate colorblind vision
from colorspacious import cspace_convert

def simulate_deuteranopia(image_rgb):
    from colorspacious import cspace_convert
    # Convert to colorblind simulation
    # (Implementation would require colorspacious library)
    pass
```

## Implementation Examples

### Setting Global Matplotlib Style
```python
import matplotlib.pyplot as plt
from style_presets import rcparams, set_color_palette

rcparams()
set_color_palette('okabe_ito')

# rcparams() also sets viridis as the default continuous colormap.
```

### Seaborn with Custom Palette
```python
import seaborn as sns

# Set Paul Tol muted palette
tol_muted = ['#332288', '#88CCEE', '#44AA99', '#117733',
             '#999933', '#DDCC77', '#CC6677', '#882255', '#AA4499']
sns.set_palette(tol_muted)

# For heatmaps
sns.heatmap(data, cmap='viridis', annot=True)
```

### Plotly with Discrete Colors
```python
import plotly.express as px

# Use Okabe-Ito for categorical data
okabe_ito_plotly = ['#E69F00', '#56B4E9', '#009E73', '#F0E442',
                     '#0072B2', '#D55E00', '#CC79A7']

fig = px.scatter(df, x='x', y='y', color='category',
                 color_discrete_sequence=okabe_ito_plotly)
```

## Grayscale Compatibility

Every figure should stay interpretable when printed in grayscale. Render a grayscale copy to check:

```python
# Convert figure to grayscale for testing
fig.savefig('figure_gray.png', dpi=600, bbox_inches='tight')
```

**Strategies for grayscale compatibility:**
1. Vary line styles (solid, dashed, dotted)
2. Vary marker shapes (circles, squares, triangles)
3. Add hatching patterns to bars
4. Keep a clear luminance gap between colors

## Color Spaces

### RGB vs CMYK
- **RGB** (Red, Green, Blue): digital and screen display
- **CMYK** (Cyan, Magenta, Yellow, Black): print

**Important:** Print and screen render the same color differently. When preparing a figure for print:
1. Convert to the CMYK color space
2. Review the figure in a CMYK preview
3. Confirm the contrast survives the conversion

### Matplotlib Color Spaces
```python
# Save for print (CMYK)
# Note: Direct CMYK support limited; use PDF and let publisher convert
fig.savefig('figure.pdf', dpi=600, bbox_inches='tight')

# For RGB (digital)
fig.savefig('figure.png', dpi=600, bbox_inches='tight', transparent=True)
```

## Common Mistakes

1. **Using jet/rainbow colormap**: its steps are perceptually uneven, so choose viridis or a sibling
2. **Red-green combinations**: ~8% of males confuse these hues
3. **Too many colors**: beyond 7-8 the hues blur together
4. **Inconsistent color meaning**: one color should keep one meaning across figures
5. **Missing colorbar**: attach one to every continuous-data plot
6. **Low contrast**: give neighboring colors a clear difference
7. **Relying solely on color**: add texture, patterns, or markers

## Resources

- **ColorBrewer**: http://colorbrewer2.org/ - Choose palettes by colorblind-safe option
- **Paul Tol's palettes**: https://personal.sron.nl/~pault/
- **Okabe-Ito palette origin**: "Color Universal Design" (Okabe & Ito, 2008)
- **Matplotlib colormaps**: https://matplotlib.org/stable/tutorials/colors/colormaps.html
- **Seaborn palettes**: https://seaborn.pydata.org/tutorial/color_palettes.html
