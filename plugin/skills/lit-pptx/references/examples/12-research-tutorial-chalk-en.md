---
tonality: chalk
title: Calibration curves for defensible results
date: 2026-10-02
department: Example Chemistry Group
presenter: Example Tutor
notice: Example data — replace with real figures
---

---
layout: cover-numeral

# Calibration curves for defensible results
---

---
layout: agenda

## Calibration tutorial outline

- **Why calibrate** an instrument reads a signal, not a concentration
- **Four steps** from standards to a reported value with its range
- **Worked example** nitrate in river water, five standards
- **Checks** residuals and the limit of detection
- **Practice** the nitrate data set, due Thursday
---

---
layout: comparison

## Effect of standard quality on the reported value

:::: columns 1fr 1fr
::: col
- **Practice run, two poor standards**
  (1) Standards: 2.0 and 4.0 mg/L made by eye, not weighed
  (2) Fit: slope 0.093 per mg/L, intercept −0.009, largest residual 0.019
  (3) Result: sample reported at 3.50 mg/L, interval ± 0.31 mg/L
  (4) Verdict: 12% above the value from good standards, and nothing flagged it
:::
::: col
- **Repeat run, five weighed standards**
  (1) Standards: every one weighed and diluted by pipette
  (2) Fit: slope 0.101 per mg/L, intercept 0.001, largest residual 0.002
  (3) Result: sample reported at 3.13 mg/L, interval ± 0.06 mg/L
  (4) Verdict: a curve is only as good as the standards behind it
:::
::::

- Source: Example Chemistry Group teaching runs, nitrate standards, September 2026 (example data)
---

---
layout: section-numeral

# The four calibration steps
---

---
layout: process

## Calibration steps: prepare, measure, fit, report

- **1. Prepare** five standards that bracket the expected sample range (0.5-8 mg/L)
  (1) Who and how long: the analyst, about 40 minutes with a balance and class A pipettes
  (2) Check: each standard weighed to 0.1 mg, recorded with its lot number
- **2. Measure** each standard three times in random order, blank first
  (1) Who and how long: the analyst at the instrument, about 25 minutes for 18 readings
  (2) Check: the three readings of a standard agree within 2%
- **3. Fit** a straight line by least squares, signal against concentration
  (1) Who and how long: the analyst in the spreadsheet, about 10 minutes
  (2) Check: no residual above 1% of the top signal, signs alternate
- **4. Report** the sample value with its 95% interval from the fit
  (1) Who and how long: the analyst, then a second person checks the sheet
  (2) Check: the sample signal lies between the lowest and highest standard
---

---
layout: method

## Line equation and symbols

c = (y − b) ÷ m

- **Use** the fitted line converts a signal into a concentration
- **y** signal the instrument reports for the sample
- **m** slope of the fitted line, signal per mg/L
- **b** intercept, the signal of a blank
- **c** concentration of the sample, mg/L
- **Residual** measured signal minus the signal the line predicts at that standard
- **Interval** the range the fit allows for c, here ± 0.06 mg/L at 95%
- **LOD** limit of detection, about three times the blank's spread divided by m
- **Example** y = 0.317, b = 0.001, m = 0.101 gives c = 0.316 ÷ 0.101 = 3.13 mg/L
- **Units** m carries signal per mg/L, so c comes out in mg/L without conversion
- **Blank** a sample with no nitrate, run first and last; its mean signal estimates b
- **Bracketing** the sample signal must fall between the lowest and highest standard
- **Drift** a slow change in the instrument's signal over a run, caught by the closing blank
- **r²** the share of signal variation the line explains; it can stay high when one standard is wrong
- Source: Example Chemistry Group calibration notes, 2026 (example)
---

---
layout: table-insight

## Standard signals and residuals, five standards

| Standard (mg/L) | Reading 1 | Reading 2 | Reading 3 | Mean signal | Residual |
|---|---|---|---|---|---|
| 0.5 | 0.051 | 0.053 | 0.052 | 0.052 | +0.001 |
| 1.0 | 0.100 | 0.102 | 0.101 | 0.101 | −0.002 |
| 2.0 | 0.204 | 0.206 | 0.205 | 0.205 | +0.002 |
| 4.0 | 0.407 | 0.410 | 0.408 | 0.408 | +0.001 |
| 8.0 | 0.806 | 0.811 | 0.810 | 0.809 | −0.002 |

> Table 1. Mean of three readings per standard and residual from the fit (example data)

- The five standards fall close to one straight line: slope 0.101 per mg/L, intercept 0.001
- No residual is larger than 0.002, about 1% of the top standard
- The residuals change sign, so the line is not curving away
- Source: Example Chemistry Group repeat run, five weighed standards, September 2026 (example data)
---

---
layout: image-split

## Worked example: river sample at signal 0.317

![Figure 1. Fitted line with the sample marked | Source: example image](assets/example-b.png)

- **Signal** mean of three readings, 0.317
- **Concentration** (0.317 − 0.001) ÷ 0.101 = 3.13 mg/L
- **Interval** 3.13 ± 0.06 mg/L from the fit
- **Check** the value lies inside the standards, so no extrapolation
- **Compare** the practice run gave 3.50 mg/L for the same signal, 12% higher
- **Write** "Nitrate 3.13 ± 0.06 mg/L (95%, five standards, 0.5-8 mg/L)"
- Source: Example river sample R-07, measured September 2026 (example data)
---

---
layout: sidebar-note

## Four common calibration mistakes

- **Reading outside the standards**
  (1) A sample above 8 mg/L must be diluted and measured again
  (2) The fit says nothing about linearity beyond the top standard
- **Forcing the line through zero**
  (1) A blank still gives a small signal, and dropping it biases low samples
  (2) Here, forcing zero moves a 0.5 mg/L sample by about 2%
- **Measuring standards in one rising run**
  (1) Drift over the run then looks like a change in slope
  (2) Randomise the order and rerun the blank at the end
- **Skipping the residual check**
  (1) A high r² can hide one bad standard; the practice run still had r² 0.99
  (2) Read the residual table before you read the slope

::: main-box
Report the value, its interval and the standard range together
:::
---

---
layout: closing-summary-list

## Takeaways and practice for this week

- Bracket every sample with standards, and never report outside them
- Weigh every standard; two standards made by eye moved the result by 12%
- Read the residuals before the slope: none should exceed 1% of the top signal
- Report the concentration with the interval the fit gives you, and the standard range
- Practice: fit the nitrate data set and bring your residual table on Thursday, 8 October
- Next session: the limit of detection, using the blanks from this week's runs
- Source: Example Chemistry Group practice set, 2026 (example data)
---
