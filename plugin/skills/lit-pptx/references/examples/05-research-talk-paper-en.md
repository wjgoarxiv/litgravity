---
tonality: paper
title: Rolling recalibration of low-cost air sensors
date: 2026-10-02
department: Example Sensor Lab
presenter: Example Speaker
notice: Example data — replace with real figures
---

---
layout: cover-index

# Rolling recalibration of low-cost air sensors over twelve months
---

---
layout: statement

## Can cheap sensors stay accurate without a trip back to the lab?

Factory-calibrated particle sensors reach 26% error within six months at every field site we tested.
---

---
layout: section-field

# Baseline drift, recalibration layout and symbols
---

---
layout: figure-academic

## Factory-calibrated baseline error, months 0-12

![Figure 1. Mean absolute error over time, factory calibration, four sites | Source: example image](assets/example-a.png)

- **Observation** Error climbs steadily: 9% at month 2, 26% at month 6, 38% at month 12
- **Observation** Nearly two thirds of the twelve-month drift appears in the first six months
- **Basis** 20 sensors, four field sites, one sensor model, collocated reference monitor at each site (example data)
- **Implication** Drift, not noise, limits how long a sensor stays useful
- Source: Example Sensor Lab baseline deployments D1-D4, 2025-2026 (example data)
---

---
layout: method

## Rolling recalibration layout and symbols

![Figure 2. Recalibration scheme used in all deployments | Source: example image](assets/example-b.png)

- **Layout** each sensor is corrected every week against the nearest reference station
- **e** mean absolute error, the average gap to the reference reading, %
- **d** drift rate, the change in error per month, points
- **w** correction window, 14 days of paired readings
- **L** distance to the nearest reference station, km
- **c** correction factor, refitted by least squares at each update
- **t₀, t₁** start of deployment and first refit, day 0 and day 7
- Source: Example Sensor Lab protocol sheet, version 2, September 2026
---

---
layout: chart-insight

## Error over time, rolling vs factory calibration

::: chart type=line unit="%"
| Month | Factory calibration (%) | Rolling recalibration (%) |
|---|---|---|
| 0 | 5 | 5 |
| 2 | 9 | 5 |
| 4 | 17 | 6 |
| 6 | 26 | 6 |
| 8 | 31 | 7 |
| 10 | 35 | 7 |
| 12 | 38 | 8 |
> Mean absolute error of 20 sensors per condition, 10 km station spacing (example data)
:::

- The rolling scheme stays below the factory baseline from month 2 on
- The gap opens after month 4, when factory drift speeds up
- At month 12 the rolling scheme sits at 8% error against 38%
- Spread between sensors stays under 2 points in the rolling condition
- Source: Example Sensor Lab deployments R1-R4 and D1-D4, 2025-2026 (example data)
---

---
layout: table-insight

## Error at month 12 by distance to the reference station

| Distance (km) | Factory (%) | Rolling (%) | Gain (points) | Relative gain (%) |
|---|---|---|---|---|
| 2 | 38 | 6 | 32 | 84 |
| 5 | 37 | 7 | 30 | 81 |
| 10 | 38 | 8 | 30 | 79 |
| 20 | 39 | 11 | 28 | 72 |
| 40 | 38 | 16 | 22 | 58 |
| 80 | 39 | 25 | 14 | 36 |

> Table 1. Mean absolute error at month 12 by station distance (example data)

- The gain stays at 28 points or more up to 20 km
- The relative gain falls from 84% at 2 km to 36% at 80 km
- Beyond 40 km the reference no longer follows local air
- Station spacing, not the refit schedule, limits the sparse networks
- Source: Example Sensor Lab distance series, 40 sensors, 2025-2026 (example data)
---

---
layout: section-field

# Technician view, contributions and limits
---

---
layout: quote

## Field technician feedback

“I stopped climbing the pole every spring; the sensors fixed themselves from the web page.”

— Example field technician interview, city network, after the last recalibrated season (2026)
---

---
layout: comparison

## Contributions and limits of this study

:::: columns 1fr 1fr
::: col
- **Contributions**
  (1) Accuracy: month-12 error falls from 38% to 8% with the same hardware
  (2) Effort: the scheme needs one weekly refit, no site visits
  (3) Range: the gain is 28 points or more at stations up to 20 km away
  (4) Evidence: 40 sensors, spread between sensors under 2 points
:::
::: col
- **Limits**
  (1) Accuracy: one sensor model and one particle size range (PM2.5)
  (2) Effort: four sites in one climate zone, none above 1,000 m
  (3) Range: dust events and stations farther than 80 km are untested
  (4) Evidence: no cost model yet for reference stations and data upkeep
:::
::::

- Source: Example Sensor Lab recalibration study, 2025-2026 (example data)
---

---
layout: closing-summary-list

## Findings and next step

- A weekly rolling refit holds error at 8% over twelve months against 38% for factory calibration
- The gain holds from 2 to 20 km, 28 points or more at every distance
- The scheme needs a nearby reference station and a weekly refit, no site visits
- The open question is sparse networks: at 80 km the gain halves
- Ask: access to eight more reference stations in two climate zones, 16 months of data
- Next step: a station placement model, Example Sensor Lab, draft by 15 December 2026
---

---
layout: references-appendix

## References and data sources

- [1] Example, A. and Sample, B. (2021). Drift in optical particle sensors outdoors. *Journal of Example Sensing*, 12(3), 201-219.
- [2] Specimen, C. (2023). Collocation calibration of low-cost monitors. *Example Air Letters*, 8, 55-63.
- [3] Example Sensor Lab (2026). Rolling recalibration deployments, synthetic data set, version 1.
- [4] Demo, D. et al. (2024). Humidity effects on low-cost particle counts. *Example Atmosphere Review*, 5, 140-158.
- [5] Sample, E. (2022). Least-squares correction of sensor networks. *Example Environmental Notes*, 27, 9-22.
- [6] Example, F. and Demo, G. (2025). Reference station spacing for urban networks. *Journal of Example Monitoring*, 4(2), 71-88.
- [7] Specimen, H. (2020). Long-term stability of optical sensors, a review. *Example Measurement Reviews*, 9, 1-34.
- [8] Example Sensor Lab (2026). Deployment logs D1-D4 and R1-R4, internal record, September 2026.
- [9] Error e: mean absolute gap between the sensor and the collocated reference reading, divided by the reference mean
- [10] Gain: factory-calibration error minus rolling-calibration error at month 12, in percentage points
---
