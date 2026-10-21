# Publication-Ready Figure Guidelines

## Core Principles

A scientific figure earns its place by being clear, accurate and accessible. Four principles guide every publication-ready figure:

1. **Clarity**: A reader grasps the message at first glance
2. **Accuracy**: The data appear exactly as measured, with no manipulation
3. **Accessibility**: Every reader can interpret the figure, including readers with visual impairments
4. **Professional**: The finish is clean and polished enough for a peer-reviewed journal

## Resolution and File Format

### Resolution Requirements
- **Raster images (photos, microscopy)**: 300-600 DPI at final print size
- **Line art and graphs**: 600-1200 DPI (or vector format)
- **Combined figures**: 300-600 DPI

### File Formats
- **Vector formats (preferred for graphs/plots)**: PDF, EPS, SVG
  - Scale to any size with full quality
  - Produce small files for line art
  - Suit plots, diagrams and schematics

- **Raster formats**: TIFF, PNG (JPEG is unsuitable for scientific data)
  - Reserve them for photographs, microscopy and continuous-tone images
  - TIFF: lossless and widely accepted
  - PNG: lossless and convenient for the web and supplementary materials
  - **Avoid JPEG**: its lossy compression adds artifacts

### Size Specifications
- **Single column**: 85-90 mm (3.35-3.54 inches) width
- **1.5 column**: 114-120 mm (4.49-4.72 inches) width
- **Double column**: 174-180 mm (6.85-7.08 inches) width
- **Maximum height**: typically 230-240 mm (9-9.5 inches)

## Typography

### Font Guidelines
- **Font family**: Sans-serif fonts (Arial, Helvetica, Calibri) suit most journals
  - Check each journal's guidelines, since some name a specific font
  - Keep one font family across every figure in the manuscript

- **Font sizes at final print size**:
  - Axis labels: 7-9 pt minimum
  - Tick labels: 6-8 pt minimum
  - Legends: 6-8 pt
  - Panel labels (A, B, C): 8-12 pt, bold
  - Title: generally omitted in multi-panel figures

- **Font weight**: Regular weight for text, with bold reserved for panel labels

### Text Best Practices
- Write axis labels in sentence case ("Time (hours)" rather than "TIME (HOURS)")
- Put units in parentheses
- Spell terms out, and abbreviate only when space is tight, defining each abbreviation in the caption
- Keep all text at 5-6 pt or larger at final size

## Color Usage

### Color Selection Principles
1. **Colorblind-friendly**: about 8% of males have a color vision deficiency
   - Pair blue with orange or blue with yellow, and add texture or pattern where possible
   - Keep red and green apart
   - Check the result with colorblindness simulators

2. **Purposeful color**: color carries meaning beyond decoration
   - Use color to separate categories or to highlight the key data
   - Give the same treatment the same color in every figure

3. **Print considerations**:
   - Colors can shift between print and screen
   - Choose CMYK for print and RGB for digital delivery
   - Secure enough contrast to survive grayscale conversion

### Recommended Color Palettes
- **Qualitative (categories)**: ColorBrewer, Okabe-Ito palette
- **Sequential (low to high)**: Viridis, Cividis, Blues, Oranges
- **Diverging (negative to positive)**: RdBu, PuOr, BrBG (confirm they are colorblind-safe)

### Grayscale Compatibility
- Every figure should remain interpretable in grayscale
- Vary line styles (solid, dashed, dotted) and markers
- Add patterns or hatching to bars and areas

## Layout and Composition

### Multi-Panel Figures
- **Panel labels**: bold uppercase letters (A, B, C) in the top-left corner
- **Spacing**: generous white space between panels
- **Alignment**: line panels up along shared edges or axes wherever possible
- **Sizing**: related panels share one size
- **Arrangement**: a logical reading flow (left-to-right, top-to-bottom)

### Plot Elements

#### Axes
- **Axis lines**: 0.5-1 pt thickness
- **Tick marks**: all pointing inward or all pointing outward
- **Tick frequency**: enough to read values without clutter (typically 4-7 major ticks)
- **Axis labels**: on every plot, with units
- **Axis ranges**: bar charts start from zero (unless that is scientifically inappropriate)

#### Lines and Markers
- **Line width**: 1-2 pt for data lines; 0.5-1 pt for reference lines
- **Marker size**: 3-6 pt, larger than the line width
- **Marker types**: distinct shapes (circles, squares, triangles) for multiple series
- **Error bars**: 0.5-1 pt width, with caps where they fit

#### Legends
- **Position**: inside the plot area when space permits, outside otherwise
- **Frame**: optional, and thin (0.5 pt) when present
- **Order**: follows the order in which the data appear (top to bottom or left to right)
- **Content**: concise descriptions, with full details in the caption

### White Space and Margins
- Trim surplus white space around plots
- Keep margins consistent
- In matplotlib, use `tight_layout()` or `constrained_layout=True`

## Data Representation Best Practices

### Statistical Rigor
- **Error bars**: show uncertainty (SD, SEM, CI) and name the type in the caption
- **Sample size**: report n in the figure or caption
- **Significance**: mark statistical significance clearly (*, **, ***)
- **Replicates**: display individual data points wherever possible, alongside summary statistics

### Appropriate Chart Types
- **Bar plots**: compare discrete categories, with the y-axis starting at zero
- **Line plots**: display time series or continuous relationships
- **Scatter plots**: show correlation, independent observations, replicate clouds and embeddings. Draw points only, adding a fitted model or regression line when it is scientifically justified. Unordered scatter observations stay unconnected by line segments.
- **Box plots**: compare distributions and show outliers
- **Heatmaps**: present matrix data, correlations and expression patterns
- **Violin plots**: compare distribution shapes (stronger than box plots for bimodal data)

### Avoiding Distortion
- **Flat graphics**: 3D effects distort the perception of values
- **Plain styling**: leave out gradients, shadows and chart junk
- **Consistent scales**: comparable panels share one scale
- **Full axes**: truncate only with a clear indication and a scientific reason
- **Linear vs. log scales**: select the fitting scale and label it clearly

## Accessibility

### Colorblind Considerations
- Test figures with online simulators (e.g., Coblis, Color Oracle)
- Combine patterns or textures with color
- Offer alternative representations in supplementary materials when needed

### Visual Impairment
- Strong contrast between elements
- Lines at least 0.5 pt thick
- Clear, uncluttered layouts

### Data Availability
- Add data tables to supplementary materials
- Supply source data files for the graphs
- Consider interactive figures for online supplementary materials

## Common Mistakes to Avoid

1. **Font too small**: text that cannot be read at final print size
2. **Low resolution**: pixelated or blurry images
3. **Chart junk**: extra grid lines, 3D effects and decorations
4. **Poor color choices**: red/green combinations and low contrast
5. **Missing elements**: absent axis labels, units or error bars
6. **Inconsistent styling**: fonts and sizes that differ within a figure or between figures
7. **Data distortion**: truncated axes, inappropriate scales and 3D effects
8. **JPEG compression**: artifacts around text and lines
9. **Too much information**: many data series crammed into one plot
10. **Inaccessible legends**: legends that fall outside the figure boundary after export

## LLM Agent Harness Safeguards

An LLM agent writing matplotlib or seaborn scripts should anticipate defaults that depend on the environment:

- **Fonts may be missing**: configure Pretendard as the first choice and Arial as the primary fallback, and turn to emergency system/CJK fallbacks only when both are unavailable. Embed vector fonts (`pdf.fonttype=42`, `ps.fonttype=42`).
- **Seaborn may re-enable grids**: call the skill's `rcparams()` after `sns.set_theme()`, or pass `rc={'axes.grid': False}`, unless the user asked for gridlines.
- **Zero-origin axes need zero ticks**: once an axis lower limit is 0, check explicitly that the first major tick is labelled 0.
- **Scatter-only data must stay scatter-only**: call `plot_scatter_only()` or `ax.scatter()` for independent observations. The call `ax.plot(..., marker='o')` creates connecting lines and belongs to ordered data.
- **Legends can hide evidence**: place legends outside for dense data. The setting `loc='best'` offers a heuristic and no guarantee of non-overlap.
- **Figure size is final-size dependent**: pick the journal width and panel count first, then scale fonts and spacing to that physical size.
- **Export semantics differ**: raster outputs need 600+ DPI, and vector outputs keep text and lines editable. Export with tight bounding boxes, then inspect legends and colorbars for clipping.

## Figure Checklist

Confirm each item before submission:

- [ ] Resolution meets journal requirements (300+ DPI for raster)
- [ ] File format is acceptable (vector for plots, TIFF/PNG for images)
- [ ] Figure dimensions match journal specifications
- [ ] All text is readable at final size (minimum 6-7 pt)
- [ ] Fonts are consistent and embedded (for PDF/EPS)
- [ ] Colors are colorblind-friendly
- [ ] Figure is interpretable in grayscale
- [ ] All axes are labeled with units
- [ ] Error bars or uncertainty indicators are present
- [ ] Statistical significance is marked if applicable
- [ ] Panel labels are present and consistent (A, B, C)
- [ ] Legend is clear and complete
- [ ] No chart junk or unnecessary elements
- [ ] File naming follows journal conventions
- [ ] Figure caption is comprehensive
- [ ] Source data is available

## Journal-Specific Considerations

Consult the specific journal's author guidelines every time. Typical variations include:

- **Nature journals**: RGB, 300 DPI minimum, specific size requirements
- **Science**: EPS or high-res TIFF, specific font requirements
- **Cell Press**: PDF or EPS preferred, Arial or Helvetica fonts
- **PLOS**: TIFF or EPS, specific color space requirements
- **ACS journals**: Application files (AI, EPS) or high-res TIFF

`journal_requirements.md` lists detailed specifications from the major publishers.
