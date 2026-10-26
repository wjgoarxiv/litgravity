---
tonality: night
title: Q3 2026 platform review for the all-hands stage
date: 2026-10-02
department: Example Platform Group
presenter: Example Speaker
notice: Example data — replace with real figures
---

---
layout: cover-figures

# Q3 2026 platform review: traffic and reliability
---

---
layout: kpi-row
title: side-rail

## Q3 traffic, availability and incidents

| Requests per day | Availability | Incidents | p95 latency | Error rate |
|---|---|---|---|---|
| 4.8 bn | 99.97% | 3 | 182 ms | 0.04% |
| Q2 3.9 bn, +22% | Target 99.95% | Q2 7, none above sev 2 | Q2 205 ms, target 200 | Q2 0.07% |

> Q3 2026, weekly platform metrics (example data)

- Traffic grew and reliability held through the quarter
- Requests per day grew 22% on Q2, mostly from the two new regions
- Availability stayed above the 99.95% target in all thirteen weeks
- Incidents fell from seven in Q2 to three, none above severity 2
- p95 latency came under the 200 ms target after the cache rework in August
- Source: Example weekly platform metrics, Q2-Q3 2026
- Note: availability is successful requests over all requests, weekly, all regions
---

---
layout: kpi-over-chart
title: top-plain-large

## Cost per million requests, Q3 2025-Q3 2026

| Cost per million | Target | Change on Q2 | Change on Q3 2025 | Quarterly spend |
|---|---|---|---|---|
| $1.82 | $2.00 | ▼ −9% | ▼ −30% | $0.80m |
| Q3 2026 | FY2026 plan | Q2 $2.00 | Q3 2025 $2.61 | Q2 $0.71m |

::: chart type=line unit="$"
| Quarter | Cost per million requests ($) |
|---|---|
| Q3 2025 | 2.61 |
| Q4 2025 | 2.34 |
| Q1 2026 | 2.12 |
| Q2 2026 | 2.00 |
| Q3 2026 | 1.82 |
> Cost per million requests by quarter (example data)
:::

- Unit cost fell for a fourth quarter, 30% below Q3 2025
- Spend rose 13% while traffic rose 22%, so each request got cheaper
- Source: Example finance ledger and platform metrics, Q3 2025-Q3 2026
---

---
layout: chart-insight

## Daily requests by region, Q2 vs Q3 2026

::: chart type=column unit="bn requests/day"
| Region | Q2 2026 | Q3 2026 |
|---|---|---|
| North | 1.6 | 1.7 |
| Central | 1.4 | 1.5 |
| West (new) | 0.6 | 1.0 |
| South (new) | 0.3 | 0.6 |
> Daily requests by region, quarterly mean (example data)
:::

- The two new regions led the growth: West and South added 0.7 bn a day
- They carry 33% of traffic, up from 23% in Q2
- North and Central grew 6% together
- South doubled after its August launch campaign
- Source: Example platform metrics, quarterly mean of daily requests, Q2-Q3 2026
---

---
layout: section-numeral

# Reliability
---

---
layout: big-number
title: top-plain-large

## Recovery time and paging, Q3 2026

| Median time to recover | Auto rollbacks | Slowest recovery | Pages per week |
|---|---|---|---|
| 8 min | 2 of 3 | 21 min | 4.1 |
| Q2 27 min | Before anyone was paged | Database failover, week 9 | Q2 9.6 |

> Q3 2026 incident records (example data)

- Recovery time is now under ten minutes
- The median fell from 27 minutes after automatic rollback went live in July
- The one slow recovery was a failover; warm standby removes that case
- Pages per on-call engineer fell by more than half, from 9.6 to 4.1 a week
- Source: Example incident records and paging logs, Q2-Q3 2026
---

---
layout: timeline
title: band

## Q3 incidents and shipped fixes

| Date | Incident | Fix | Owner |
|---|---|---|---|
| 14 Jul | Config push slowed checkout for 12 minutes | Staged rollout for config, live 28 Jul | Release Team |
| 22 Aug | Cache node lost in West region, 6 min of errors | Third replica per region, live 5 Sep | Storage Team |
| 3 Sep | Database failover took 21 minutes | Warm standby in West, others pending | SRE Team |
| 30 Sep | Review of all three incidents | Runbooks updated, drills monthly | SRE Team |

> Table 1. Q3 incidents and the fixes shipped; every incident has a fix in place (example data)

- Each incident had its fix live within 14 days; Q2 fixes took 31 days on average
- Only the failover fix is partial: three regions still lack a warm standby
- Source: Example incident reviews and change log, July-September 2026
---

---
layout: comparison

## Q4 options: fifth region vs warm standby

:::: columns 1fr 1fr
::: col
- **Plan A: open a fifth region**
  (1) Capacity: adds 0.8 bn requests a day, headroom to Q4 2027
  (2) Cost: $2.4m in year one, then $1.3m a year to run
  (3) Recovery: median stays at 8 min, failover near 20 min
  (4) Timing: live in Q2 2027 at the earliest, 6 months of build
:::
::: col
- **Plan B: warm standby everywhere**
  (1) Capacity: current four regions last to Q2 2027 at 80% use
  (2) Cost: $1.1m in year one, then $0.4m a year to run
  (3) Recovery: failover falls to under 5 min in every region
  (4) Timing: live in January 2027, fifth region moves to a study
:::
::::

- Source: Example SRE Team cost and capacity estimates, September 2026
---

---
layout: dashboard-grid
title: side-rail

## Peak CPU and storage use, Jul-Sep 2026

::: chart type=line unit="%"
| Month | Peak CPU (%) |
|---|---|
| Jul | 56 |
| Aug | 58 |
| Sep | 61 |
> Peak CPU use, all regions (example data)
:::

::: chart type=line unit="%"
| Month | Storage used (%) |
|---|---|
| Jul | 64 |
| Aug | 65 |
| Sep | 67 |
> Storage use, all regions (example data)
:::

- Capacity is enough until Q2 2027: both lines reach the 80% planning limit in May 2027
- CPU grows 2.5 points a month, storage 1.5 points a month
- Plan B buys time; the fifth-region study must report before Q1 2027 ends
- Source: Example capacity monitoring, monthly peaks, July-September 2026
- Note: the 80% planning limit leaves room for one region to fail over to the others
---

---
layout: closing-decision-box

## Plan B approval request, October 2026

| Decision | Cost | Owner | When |
|---|---|---|---|
| Warm standby in all four regions | $1.1m | Example SRE Team | Approve by 31 Oct |
| Fifth region study, no build | $0.1m | Example Platform Group | Report in Q1 2027 |
| Capacity review against the 80% limit | None | Example SRE Team | Monthly from Nov |

- Ask: the leadership team approves Plan B this month
- Next step: Example SRE Team starts the standby build on 4 Nov and reports weekly at the ops review
- Source: Example platform metrics and finance plan, September 2026 (example data)
---
