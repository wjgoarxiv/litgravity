---
tonality: paper
title: Staged feeding in a fixed-volume reactor
date: 2026-10-02
department: Example Process Lab
presenter: Example Speaker
notice: Example data — replace with real figures
---

---
layout: cover-index

# Staged feeding and conversion in a 20 L reactor
---

---
layout: statement

## Can conversion rise without a larger reactor?

Single-feed runs plateau at 50% conversion after 30 minutes in every pilot vessel we tested.
---

---
layout: section-field

# Baseline conversion, feed layout and symbols
---

---
layout: figure-academic

## Single-feed baseline conversion, 0-60 min

![Figure 1. Conversion over time, single feed, three replicates | Source: example image](assets/example-a.png)

- **Observation** Conversion stalls after 30 minutes: 44% at 30 min, 50% at 60 min
- **Observation** The baseline gains only 6 points after minute 30
- **Basis** 1.0 L/min feed, 20 L reactor, three replicates at one temperature and one catalyst batch (example data)
- **Implication** The plateau, not the kinetics, limits throughput
- Source: Example Process Lab baseline runs B1-B3, May 2026 (example data)
---

---
layout: method

## Three-stage feed layout and symbols

![Figure 2. Process layout used in all runs | Source: example image](assets/example-b.png)

- **Layout** the feed is split into three stages along the reactor
- **X** conversion, the fraction of feed that reacted
- **k** first-order rate constant, 1/min
- **τ** residence time per stage, min
- **n** number of feed stages, three in every run
- **q** feed split between stages, 50/30/20 by volume
- **t₂, t₃** start of stages two and three, minute 20 and minute 35
- Source: Example Process Lab run sheet, version 1, June 2026
---

---
layout: chart-insight

## Conversion over time, staged vs single feed

::: chart type=line unit="%"
| Minute | Single feed (%) | Staged feed (%) |
|---|---|---|
| 0 | 0 | 0 |
| 10 | 21 | 24 |
| 20 | 36 | 45 |
| 30 | 44 | 59 |
| 40 | 47 | 67 |
| 50 | 49 | 72 |
| 60 | 50 | 75 |
> Mean conversion of three replicates per condition (example data)
:::

- The staged feed leads at every time point after minute 10
- The gap opens after minute 20, when the second stage starts feeding
- At minute 60 the staged feed reaches 75% against 50%
- Replicate spread stays under 3 points in both conditions
- Source: Example Process Lab runs S1-S3 and B1-B3, 1.0 L/min, June 2026 (example data)
---

---
layout: table-insight

## Conversion at 60 min by feed rate

| Feed rate (L/min) | Single feed (%) | Staged feed (%) | Gain (points) | Relative gain (%) |
|---|---|---|---|---|
| 0.5 | 52 | 77 | 25 | 48 |
| 0.75 | 51 | 76 | 25 | 49 |
| 1.0 | 50 | 75 | 25 | 50 |
| 1.25 | 49 | 73 | 24 | 49 |
| 1.5 | 47 | 71 | 24 | 51 |
| 2.0 | 41 | 64 | 23 | 56 |

> Table 1. Conversion at 60 minutes by feed rate (example data)

- The gain holds at all six feed rates tested, 23-25 points
- The relative gain is 48-56% at every rate
- The gap narrows by two points at the highest rate
- Heat removal, not the feed schedule, limits the fastest runs
- Source: Example Process Lab feed-rate series, 36 runs, June 2026 (example data)
---

---
layout: section-field

# Operator view, contributions and limits
---

---
layout: quote

## Pilot-plant operator feedback

“We hit the target conversion without changing the vessel, only the feed valves.”

— Example operator interview, pilot plant, after the last staged run (June 2026)
---

---
layout: comparison

## Contributions and limits of this study

:::: columns 1fr 1fr
::: col
- **Contributions**
  (1) Yield: conversion rises from 50% to 75% at equal reactor volume
  (2) Equipment: the schedule needs only valve timing, no new vessel
  (3) Range: the 23-25 point gain holds at six feed rates, 0.5-2.0 L/min
  (4) Evidence: 36 runs, replicates within 3 points of each other
:::
::: col
- **Limits**
  (1) Yield: tested at one temperature (60 °C) and one catalyst batch
  (2) Equipment: pilot scale only, 20 L vessels against 2,000 L in production
  (3) Range: heat removal above 2.0 L/min and at full scale is untested
  (4) Evidence: no cost model yet for the valve control and its upkeep
:::
::::

- Source: Example Process Lab staged-feeding study, May-June 2026 (example data)
---

---
layout: closing-summary-list

## Findings and next step

- A three-stage feed lifts conversion from 50% to 75% in the same 60 minutes
- The gain holds from 0.5 to 2.0 L/min feed rate, 23-25 points at every rate
- The schedule needs only valve timing, no new vessel and no new catalyst
- The open question is heat removal: the fastest runs lose two points of gain
- Ask: pilot time for a second temperature (75 °C) and a second catalyst batch, 12 runs
- Next step: a heat-removal model at full scale, Example Process Lab, draft by 15 December 2026
---

---
layout: references-appendix

## References and data sources

- [1] Example, A. and Sample, B. (2021). Single-feed conversion limits in stirred reactors. *Journal of Example Engineering*, 14(2), 101-118.
- [2] Specimen, C. (2023). Two-stage feeding at pilot scale. *Example Process Letters*, 9, 33-41.
- [3] Example Process Lab (2026). Staged feeding runs, synthetic data set, version 1.
- [4] Demo, D. et al. (2024). Heat removal in large fed-batch vessels. *Example Reactor Review*, 6, 210-229.
- [5] Sample, E. (2022). Residence-time models for staged feeds. *Example Chemical Notes*, 31, 5-19.
- [6] Example, F. and Demo, G. (2025). Valve timing in fed-batch control. *Journal of Example Control*, 3(1), 44-58.
- [7] Specimen, H. (2020). First-order kinetics in stirred tanks, a review. *Example Reaction Reviews*, 11, 1-27.
- [8] Example Process Lab (2026). Pilot reactor run sheets B1-B3 and S1-S3, internal record, June 2026.
- [9] Conversion X: moles of feed reacted over moles fed, measured by offline sampling every 10 minutes
- [10] Gain: staged-feed conversion minus single-feed conversion at 60 minutes, in percentage points
---
