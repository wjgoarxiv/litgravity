## Table of Contents

- [Overview](#overview)
- [Setup and Configuration](#setup-and-configuration)
  - [Publication-Quality Matplotlib Configuration](#publication-quality-matplotlib-configuration)
  - [Helper Function for Saving](#helper-function-for-saving)
- [Example 1: Line Plot with Error Bars](#example-1-line-plot-with-error-bars)
- [Example 2: Multi-Panel Figure](#example-2-multi-panel-figure)
- [Example 3: Box Plot with Individual Points](#example-3-box-plot-with-individual-points)
- [Example 4: Heatmap with Colorbar](#example-4-heatmap-with-colorbar)
- [Example 5: Seaborn Violin Plot](#example-5-seaborn-violin-plot)
- [Example 6: Scientific Scatter with Regression](#example-6-scientific-scatter-with-regression)
- [Example 7: Time Series with Shaded Error](#example-7-time-series-with-shaded-error)
- [Example 8: Plotly Interactive Figure](#example-8-plotly-interactive-figure)
- [Example 9: Grouped Bar Plot with Significance](#example-9-grouped-bar-plot-with-significance)
- [Example 10: Publication-Ready Figure for Nature](#example-10-publication-ready-figure-for-nature)
- [Tips for Each Library](#tips-for-each-library)
  - [Matplotlib](#matplotlib)
  - [Seaborn](#seaborn)
  - [Plotly](#plotly)
- [Common Workflow](#common-workflow)
- [Resources](#resources)

# Publication-Ready Matplotlib Examples

> Current skill contract: call `rcparams()` before creating any figure, leave grids off unless requested, prefer `layout='constrained'`, build legends with `style_legend()` for the black border, apply `ensure_zero_origin_ticks()` on zero-baseline axes, and export rasters at 600+ DPI with `bbox_inches='tight'`. Convert any older snippet that uses low DPI, a frameless legend or direct rcParams edits to the current helpers before reusing it.

> Scatter-only rule: independent observations, replicate clouds, correlations and embeddings belong in `plot_scatter_only()` or `ax.scatter()` as separate points. Reserve lines for ordered trajectories and for fitted or model curves that the analysis justifies.

## Overview

The examples below show practical code for publication-ready scientific figures in Matplotlib, Seaborn and Plotly. Each follows the guidance in `publication_guidelines.md` and takes its colorblind-friendly palettes from `color_palettes.md`.

## Setup and Configuration

### Publication-Quality Matplotlib Configuration

```python
import matplotlib.pyplot as plt
import numpy as np
from style_presets import rcparams

# Set publication quality parameters from the skill single source of truth.
rcparams()
```

### Helper Function for Saving

```python
from figure_export import save_publication_figure
```

## Example 1: Line Plot with Error Bars

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate sample data
x = np.linspace(0, 10, 50)
y1 = 2 * x + 1 + np.random.normal(0, 1, 50)
y2 = 1.5 * x + 2 + np.random.normal(0, 1.2, 50)

# Calculate means and standard errors for binned data
bins = np.linspace(0, 10, 11)
y1_mean = [y1[(x >= bins[i]) & (x < bins[i+1])].mean() for i in range(len(bins)-1)]
y1_sem = [y1[(x >= bins[i]) & (x < bins[i+1])].std() /
          np.sqrt(len(y1[(x >= bins[i]) & (x < bins[i+1])]))
          for i in range(len(bins)-1)]
x_binned = (bins[:-1] + bins[1:]) / 2

# Create figure with appropriate size (single column width = 3.5 inches)
fig, ax = plt.subplots(figsize=(3.5, 2.5))

# Plot with error bars
ax.errorbar(x_binned, y1_mean, yerr=y1_sem,
            marker='o', markersize=4, capsize=3, capthick=0.5,
            label='Condition A', linewidth=1.5)

# Add labels with units
ax.set_xlabel('Time (hours)')
ax.set_ylabel('Fluorescence intensity (a.u.)')

# Add legend
ax.legend(frameon=True, edgecolor='black', framealpha=1, loc='upper left')

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Tight layout
fig.tight_layout()

# Save
save_publication_figure(fig, 'line_plot_with_errors')
plt.show()
```

## Example 2: Multi-Panel Figure

```python
import matplotlib.pyplot as plt
import numpy as np
from string import ascii_uppercase

# Create figure with multiple panels (double column width = 7 inches)
fig = plt.figure(figsize=(7, 4))

# Define grid for panels
gs = fig.add_gridspec(2, 3, hspace=0.4, wspace=0.4,
                      left=0.08, right=0.98, top=0.95, bottom=0.08)

# Panel A: Line plot
ax_a = fig.add_subplot(gs[0, :2])
x = np.linspace(0, 10, 100)
for i, offset in enumerate([0, 0.5, 1.0]):
    ax_a.plot(x, np.sin(x) + offset, label=f'Dataset {i+1}')
ax_a.set_xlabel('Time (s)')
ax_a.set_ylabel('Amplitude (V)')
ax_a.legend(frameon=True, edgecolor='black', framealpha=1, fontsize=6)
ax_a.spines['top'].set_visible(False)
ax_a.spines['right'].set_visible(False)

# Panel B: Bar plot
ax_b = fig.add_subplot(gs[0, 2])
categories = ['Control', 'Treatment\nA', 'Treatment\nB']
values = [100, 125, 140]
errors = [5, 8, 6]
ax_b.bar(categories, values, yerr=errors, capsize=3,
         color=['#0072B2', '#E69F00', '#009E73'], alpha=0.8)
ax_b.set_ylabel('Response (%)')
ax_b.spines['top'].set_visible(False)
ax_b.spines['right'].set_visible(False)
ax_b.set_ylim(0, 160)

# Panel C: Scatter plot
ax_c = fig.add_subplot(gs[1, 0])
x = np.random.randn(100)
y = 2*x + np.random.randn(100)
ax_c.scatter(x, y, s=10, alpha=0.6, color='#0072B2')
ax_c.set_xlabel('Variable X')
ax_c.set_ylabel('Variable Y')
ax_c.spines['top'].set_visible(False)
ax_c.spines['right'].set_visible(False)

# Panel D: Heatmap
ax_d = fig.add_subplot(gs[1, 1:])
data = np.random.randn(10, 20)
im = ax_d.imshow(data, cmap='viridis', aspect='auto')
ax_d.set_xlabel('Sample number')
ax_d.set_ylabel('Feature')
cbar = plt.colorbar(im, ax=ax_d, fraction=0.046, pad=0.04)
cbar.set_label('Intensity (a.u.)', rotation=270, labelpad=12)

# Add panel labels
panels = [ax_a, ax_b, ax_c, ax_d]
for i, ax in enumerate(panels):
    ax.text(-0.15, 1.05, ascii_uppercase[i], transform=ax.transAxes,
            fontsize=10, fontweight='bold', va='top')

save_publication_figure(fig, 'multi_panel_figure')
plt.show()
```

## Example 3: Box Plot with Individual Points

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate sample data
np.random.seed(42)
data = [np.random.normal(100, 15, 30),
        np.random.normal(120, 20, 30),
        np.random.normal(140, 18, 30),
        np.random.normal(110, 22, 30)]

fig, ax = plt.subplots(figsize=(3.5, 3))

# Create box plot
bp = ax.boxplot(data, widths=0.5, patch_artist=True,
                showfliers=False,  # the raw points are drawn manually below
                boxprops=dict(facecolor='lightgray', edgecolor='black', linewidth=0.8),
                medianprops=dict(color='black', linewidth=1.5),
                whiskerprops=dict(linewidth=0.8),
                capprops=dict(linewidth=0.8))

# Overlay individual points
colors = ['#0072B2', '#E69F00', '#009E73', '#D55E00']
for i, (d, color) in enumerate(zip(data, colors)):
    # Jitter the x positions so points do not stack
    x = np.random.normal(i+1, 0.04, size=len(d))
    ax.scatter(x, d, alpha=0.4, s=8, color=color)

# Customize
ax.set_xticklabels(['Control', 'Treatment A', 'Treatment B', 'Treatment C'])
ax.set_ylabel('Cell count')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.set_ylim(50, 200)

fig.tight_layout()
save_publication_figure(fig, 'boxplot_with_points')
plt.show()
```

## Example 4: Heatmap with Colorbar

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate correlation matrix
np.random.seed(42)
n = 10
A = np.random.randn(n, n)
corr_matrix = np.corrcoef(A)

# Create figure
fig, ax = plt.subplots(figsize=(4, 3.5))

# Plot heatmap
im = ax.imshow(corr_matrix, cmap='RdBu_r', vmin=-1, vmax=1, aspect='auto')

# Add colorbar
cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.set_label('Correlation coefficient', rotation=270, labelpad=15)

# Set ticks and labels
gene_names = [f'Gene{i+1}' for i in range(n)]
ax.set_xticks(np.arange(n))
ax.set_yticks(np.arange(n))
ax.set_xticklabels(gene_names, rotation=45, ha='right')
ax.set_yticklabels(gene_names)

# Add grid
ax.set_xticks(np.arange(n)-.5, minor=True)
ax.set_yticks(np.arange(n)-.5, minor=True)
ax.grid(which='minor', color='white', linestyle='-', linewidth=0.5)

fig.tight_layout()
save_publication_figure(fig, 'correlation_heatmap')
plt.show()
```

## Example 5: Seaborn Violin Plot

```python
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Generate sample data
np.random.seed(42)
data = pd.DataFrame({
    'condition': np.repeat(['Control', 'Drug A', 'Drug B'], 50),
    'value': np.concatenate([
        np.random.normal(100, 15, 50),
        np.random.normal(120, 20, 50),
        np.random.normal(140, 18, 50)
    ])
})

# Set style
sns.set_style('ticks')
sns.set_palette(['#0072B2', '#E69F00', '#009E73'])

fig, ax = plt.subplots(figsize=(3.5, 3))

# Create violin plot
sns.violinplot(data=data, x='condition', y='value', ax=ax,
               inner='box', linewidth=0.8)

# Add strip plot
sns.stripplot(data=data, x='condition', y='value', ax=ax,
              size=2, alpha=0.3, color='black')

# Customize
ax.set_xlabel('')
ax.set_ylabel('Expression level (AU)')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

fig.tight_layout()
save_publication_figure(fig, 'violin_plot')
plt.show()
```

## Example 6: Scientific Scatter with Regression

```python
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

# Generate data with correlation
np.random.seed(42)
x = np.random.randn(100)
y = 2.5 * x + np.random.randn(100) * 0.8

# Calculate regression
slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

# Create figure
fig, ax = plt.subplots(figsize=(3.5, 3.5))

# Scatter plot
from style_presets import plot_scatter_only

plot_scatter_only(ax, x, y, s=15, alpha=0.6, color='#0072B2')

# Regression line
x_line = np.array([x.min(), x.max()])
y_line = slope * x_line + intercept
ax.plot(x_line, y_line, 'r-', linewidth=1.5, label=f'y = {slope:.2f}x + {intercept:.2f}')

# Add statistics text
stats_text = f'$R^2$ = {r_value**2:.3f}\n$p$ < 0.001' if p_value < 0.001 else f'$R^2$ = {r_value**2:.3f}\n$p$ = {p_value:.3f}'
ax.text(0.05, 0.95, stats_text, transform=ax.transAxes,
        verticalalignment='top', fontsize=7,
        bbox=dict(boxstyle='round', facecolor='white', alpha=0.8, edgecolor='gray', linewidth=0.5))

# Customize
ax.set_xlabel('Predictor variable')
ax.set_ylabel('Response variable')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

fig.tight_layout()
save_publication_figure(fig, 'scatter_regression')
plt.show()
```

## Example 7: Time Series with Shaded Error

```python
import matplotlib.pyplot as plt
import numpy as np

# Generate time series data
np.random.seed(42)
time = np.linspace(0, 24, 100)
n_replicates = 5

# Simulate multiple replicates
data = np.array([10 * np.exp(-time/10) + np.random.normal(0, 0.5, 100)
                 for _ in range(n_replicates)])

# Calculate mean and SEM
mean = data.mean(axis=0)
sem = data.std(axis=0) / np.sqrt(n_replicates)

# Create figure
fig, ax = plt.subplots(figsize=(4, 2.5))

# Plot mean line
ax.plot(time, mean, linewidth=1.5, color='#0072B2', label='Mean ± SEM')

# Add shaded error region
ax.fill_between(time, mean - sem, mean + sem,
                alpha=0.3, color='#0072B2', linewidth=0)

# Customize
ax.set_xlabel('Time (hours)')
ax.set_ylabel('Concentration (μM)')
ax.legend(frameon=True, edgecolor='black', framealpha=1, loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.set_xlim(0, 24)
ax.set_ylim(0, 12)

fig.tight_layout()
save_publication_figure(fig, 'timeseries_shaded')
plt.show()
```

## Example 8: Plotly Interactive Figure

```python
import plotly.graph_objects as go
import numpy as np

# Generate data
np.random.seed(42)
x = np.random.randn(100)
y = 2*x + np.random.randn(100)
colors = np.random.choice(['Group A', 'Group B'], 100)

# Okabe-Ito colors for Plotly
okabe_ito_plotly = ['#E69F00', '#56B4E9']

# Create figure
fig = go.Figure()

for group, color in zip(['Group A', 'Group B'], okabe_ito_plotly):
    mask = colors == group
    fig.add_trace(go.Scatter(
        x=x[mask], y=y[mask],
        mode='markers',
        name=group,
        marker=dict(size=6, color=color, opacity=0.6)
    ))

# Update layout for publication quality
fig.update_layout(
    width=500,
    height=400,
    font=dict(family='Arial, sans-serif', size=10),
    plot_bgcolor='white',
    xaxis=dict(
        title='Variable X',
        showgrid=False,
        showline=True,
        linewidth=1,
        linecolor='black',
        mirror=False
    ),
    yaxis=dict(
        title='Variable Y',
        showgrid=False,
        showline=True,
        linewidth=1,
        linecolor='black',
        mirror=False
    ),
    legend=dict(
        x=0.02,
        y=0.98,
        bgcolor='rgba(255,255,255,0.8)',
        bordercolor='gray',
        borderwidth=0.5
    )
)

# Save as static image (requires kaleido)
fig.write_image('plotly_scatter.png', width=500, height=400, scale=3)  # scale=3 gives ~300 DPI
fig.write_html('plotly_scatter.html')  # Interactive version

fig.show()
```

## Example 9: Grouped Bar Plot with Significance

```python
import matplotlib.pyplot as plt
import numpy as np

# Data
categories = ['WT', 'Mutant A', 'Mutant B']
control_means = [100, 85, 70]
control_sem = [5, 6, 5]
treatment_means = [100, 120, 140]
treatment_sem = [6, 8, 9]

x = np.arange(len(categories))
width = 0.35

fig, ax = plt.subplots(figsize=(3.5, 3))

# Create bars
bars1 = ax.bar(x - width/2, control_means, width, yerr=control_sem,
               capsize=3, label='Control', color='#0072B2', alpha=0.8)
bars2 = ax.bar(x + width/2, treatment_means, width, yerr=treatment_sem,
               capsize=3, label='Treatment', color='#E69F00', alpha=0.8)

# Add significance markers
def add_significance_bar(ax, x1, x2, y, h, text):
    """Draw a significance bracket spanning two bars"""
    ax.plot([x1, x1, x2, x2], [y, y+h, y+h, y], linewidth=0.8, c='black')
    ax.text((x1+x2)/2, y+h, text, ha='center', va='bottom', fontsize=7)

# Mark significant differences
add_significance_bar(ax, x[1]-width/2, x[1]+width/2, 135, 3, '***')
add_significance_bar(ax, x[2]-width/2, x[2]+width/2, 155, 3, '***')

# Customize
ax.set_ylabel('Activity (% of WT control)')
ax.set_xticks(x)
ax.set_xticklabels(categories)
ax.legend(frameon=True, edgecolor='black', framealpha=1, loc='upper left')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.set_ylim(0, 180)

# Explain the significance symbol
ax.text(0.98, 0.02, '*** p < 0.001', transform=ax.transAxes,
        ha='right', va='bottom', fontsize=6)

fig.tight_layout()
save_publication_figure(fig, 'grouped_bar_significance')
plt.show()
```

## Example 10: Publication-Ready Figure for Nature

```python
import matplotlib.pyplot as plt
import numpy as np
from string import ascii_lowercase

# Nature specifications: 89mm single column
inch_per_mm = 0.0393701
width_mm = 89
height_mm = 110
figsize = (width_mm * inch_per_mm, height_mm * inch_per_mm)

fig = plt.figure(figsize=figsize)
gs = fig.add_gridspec(3, 2, hspace=0.5, wspace=0.4,
                      left=0.12, right=0.95, top=0.96, bottom=0.08)

# Panel a: Time course
ax_a = fig.add_subplot(gs[0, :])
time = np.linspace(0, 48, 100)
for i, label in enumerate(['Control', 'Treatment']):
    y = (1 + i*0.5) * np.exp(-time/20) * (1 + 0.3*np.sin(time/5))
    ax_a.plot(time, y, linewidth=1.2, label=label)
ax_a.set_xlabel('Time (h)', fontsize=7)
ax_a.set_ylabel('Growth (OD$_{600}$)', fontsize=7)
ax_a.legend(frameon=True, edgecolor='black', framealpha=1, fontsize=6)
ax_a.tick_params(labelsize=6)
ax_a.spines['top'].set_visible(False)
ax_a.spines['right'].set_visible(False)

# Panel b: Bar plot
ax_b = fig.add_subplot(gs[1, 0])
categories = ['A', 'B', 'C']
values = [1.0, 1.5, 2.2]
errors = [0.1, 0.15, 0.2]
ax_b.bar(categories, values, yerr=errors, capsize=2, width=0.6,
         color='#0072B2', alpha=0.8)
ax_b.set_ylabel('Fold change', fontsize=7)
ax_b.tick_params(labelsize=6)
ax_b.spines['top'].set_visible(False)
ax_b.spines['right'].set_visible(False)

# Panel c: Heatmap
ax_c = fig.add_subplot(gs[1, 1])
data = np.random.randn(8, 6)
im = ax_c.imshow(data, cmap='viridis', aspect='auto')
ax_c.set_xlabel('Sample', fontsize=7)
ax_c.set_ylabel('Gene', fontsize=7)
ax_c.tick_params(labelsize=6)

# Panel d: Scatter
ax_d = fig.add_subplot(gs[2, :])
x = np.random.randn(50)
y = 2*x + np.random.randn(50)*0.5
ax_d.scatter(x, y, s=8, alpha=0.6, color='#E69F00')
ax_d.set_xlabel('Expression gene X', fontsize=7)
ax_d.set_ylabel('Expression gene Y', fontsize=7)
ax_d.tick_params(labelsize=6)
ax_d.spines['top'].set_visible(False)
ax_d.spines['right'].set_visible(False)

# Add lowercase panel labels (Nature style)
for i, ax in enumerate([ax_a, ax_b, ax_c, ax_d]):
    ax.text(-0.2, 1.1, f'{ascii_lowercase[i]}', transform=ax.transAxes,
            fontsize=9, fontweight='bold', va='top')

# Save in Nature-preferred format
fig.savefig('nature_figure.pdf', dpi=1000, bbox_inches='tight',
           facecolor='white', edgecolor='none')
fig.savefig('nature_figure.png', dpi=600, bbox_inches='tight',
           facecolor='white', edgecolor='none')

plt.show()
```

## Tips for Each Library

### Matplotlib
- Call `fig.tight_layout()` or set `constrained_layout=True` so elements keep clear of each other
- Use 300-600 DPI for publication rasters
- Choose vector formats (PDF, EPS) for line plots
- Embed fonts in PDF/EPS files

### Seaborn
- Seaborn sits on matplotlib, so every matplotlib customization applies
- Start from `sns.set_style('ticks')` or `'whitegrid'` for a clean look
- `sns.despine()` drops the top and right spines
- Define a custom palette with `sns.set_palette()`

### Plotly
- A strong fit for interactive exploratory analysis
- Export static images with `fig.write_image()` (requires the kaleido package)
- The `scale` parameter sets the effective DPI (scale=3 ≈ 300 DPI)
- Expect to tune the layout extensively for publication quality

## Common Workflow

1. **Explore with default settings**
2. **Apply publication configuration** (see Setup section)
3. **Create the plot at the right size** (check journal requirements)
4. **Customize colors** (use colorblind-friendly palettes)
5. **Adjust fonts and line widths** (readable at final size)
6. **Strip chart junk** (top/right spines, heavy grids)
7. **Add clear labels with units**
8. **Test in grayscale**
9. **Save in multiple formats** (PDF for vector, PNG for raster)
10. **Verify in final context** (import into the manuscript to check size)

## Resources

- Matplotlib documentation: https://matplotlib.org/
- Seaborn gallery: https://seaborn.pydata.org/examples/index.html
- Plotly documentation: https://plotly.com/python/
- Nature Methods Points of View: Data visualization column archive
