# MDAnalysis-based MARTINI / coarse-grained trajectory visualization

Open this reference when a task calls for practical visualization of MARTINI or other coarse-grained MD trajectories, particularly when VMD auto-bond rendering gets awkward or water beads dominate the scene.

## Durable lesson

Coarse-grained MARTINI systems usually read best as particle clouds, with molecule and bond drawings as the secondary view:

- Hide water by default. Tens of thousands of water beads would otherwise bury the morphology.
- Load `.gro` topology/coordinates into MDAnalysis whenever `.tpr` support is uncertain or the file is newer than the installed MDAnalysis version understands.
- Render by bead class: CP/oil beads, surfactant heads, surfactant tails, counterions, and water when requested.
- For morphology work, pair static PNG snapshots with an interactive HTML/WebGL or GUI viewer. Static images serve reports; an orbit and slider build intuition.

## Recommended output pattern

Deliver both outputs for a trajectory visualization task:

1. Interactive HTML viewer
   - embedded sampled frames
   - slider and play controls
   - drag/orbit and wheel/zoom where possible
   - water hidden by default

2. PNG outputs
   - one last-frame PNG
   - optionally a directory with a sampled frame sequence
   - frame/time annotation on every image
   - a color label for each bead class

When the user casually says to "just run/open/shoot it," carry out the action: generate the artifact and open it locally when possible. Print the command alone only when they ask for instructions.

## Minimal MDAnalysis bead-selection scaffold

```python
import MDAnalysis as mda
import numpy as np
import matplotlib.pyplot as plt
from style_presets import rcparams, style_legend

rcparams()

u = mda.Universe("eq_whole.gro", "traj.xtc")

# Common MARTINI CP/SDS labels from the CP-SDS emulsion project.
cp = u.select_atoms("resname CYP CYPE")
sds_head = u.select_atoms("resname SDS and name S1")
sds_tail = u.select_atoms("resname SDS and name C1 C2 C3")
na = u.select_atoms("resname NA or name NA")

u.trajectory[-1]
fig = plt.figure(figsize=(8, 7))
ax = fig.add_subplot(111, projection="3d")
for group, label, color, size in [
    (cp, "CP", "#18a999", 8),
    (sds_tail, "SDS tail", "#b8b8b8", 8),
    (sds_head, "SDS head", "#d62728", 18),
    (na, "Na+", "#8e44ad", 8),
]:
    if len(group):
        p = group.positions / 10.0  # MDAnalysis positions are Angstrom; plot nm.
        ax.scatter(p[:,0], p[:,1], p[:,2], s=size, c=color, label=label, alpha=0.85, edgecolors="none")
box = u.trajectory.ts.dimensions[:3] / 10.0
ax.set_xlim(0, box[0]); ax.set_ylim(0, box[1]); ax.set_zlim(0, box[2])
ax.set_xlabel("x (nm)"); ax.set_ylabel("y (nm)"); ax.set_zlabel("z (nm)")
ax.text2D(0.02, 0.96, f"frame {u.trajectory.frame}, t={u.trajectory.time/1000:.2f} ns", transform=ax.transAxes)
style_legend(ax, outside=True)
fig.savefig("mda_last.png", dpi=600, bbox_inches="tight", transparent=True)
```

## Practical tool ranking

- MDAnalysis: the top choice for analysis-coupled visuals, automated PNGs, sampled frame sequences and reproducible reports.
- OVITO: a good GUI option for bead/particle systems, with slicing, particle radii and quick visual exploration.
- VMD: remains useful for MD trajectory handling; MARTINI needs an explicit representation setup because bonds may be absent and water beads dominate.

## Verification checklist

Before declaring the work complete:

- Run the script against the real `.gro`/`.xtc` pair.
- Confirm the output files exist and have a nontrivial size.
- Open at least one PNG or browser-rendered HTML page and inspect it.
- Check that water stays hidden unless the user asked for it.
- Match the CP/SDS/head/tail/counterion colors and legend against the intended selections.
- For a PNG sequence, count the expected frame files and inspect the dimensions of the first and last image.
