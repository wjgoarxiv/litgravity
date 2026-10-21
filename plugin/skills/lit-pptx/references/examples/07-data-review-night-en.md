---
tonality: night
title: Pickup scheduling review, September 2026
date: 2026-10-05
department: Example Operations Team
presenter: Example Analyst
notice: Example data — replace with real figures
---

---
layout: cover-numeral

# Pickup scheduling review, September 2026
---

---
layout: kpi-row

## Bookings, punctuality and cost, September

| Bookings | On-time pickups | Reschedule rate | Cost per pickup | Driver hours |
|---|---|---|---|---|
| 38,400 | 91% | 8.2% | €4.10 | 5,620 |
| August 36,900 (+4%) | August 84% | August 11.6% | August €4.20 | August 5,540 |

> Home pickups of the Example Laundry Service, 1-30 September 2026, test accounts removed (example)

- On-time pickups rose from 84% to 91% while bookings grew 4%
- Driver hours grew 1.4%, so each pickup cost ten cents less
- Reschedules fell by 3.4 points once customers got an evening-before reminder
- Source: Example booking system and driver time sheets, August-September 2026
---

---
layout: full-chart

## Late pickups by booked window, August vs September

::: chart type=column unit="% of pickups in window"
| Window | Late in August (%) | Late in September (%) |
|---|---|---|
| 07-10 | 11 | 7 |
| 10-13 | 13 | 8 |
| 13-16 | 20 | 9 |
| 16-19 | 22 | 11 |
| 19-21 | 9 | 7 |
> Share of pickups collected after the end of their booked window (example data)
:::

- Afternoon and early evening improved most after route re-sequencing on 6 September
- The 13-16 window fell by eleven points, the largest single gain
- The morning and night windows were already close to target
- Source: Example booking system, collection scans, August-September 2026
- Note: late means collected after the window closed, as defined on the method slide
---

---
layout: chart-insight

## Reschedule rate by booking channel, August vs September

::: chart type=bar unit="%"
| Channel | Reschedules in August (%) | Reschedules in September (%) |
|---|---|---|
| App | 10.2 | 6.6 |
| Web | 12.8 | 8.9 |
| Phone | 18.5 | 15.0 |
| Building desk | 5.0 | 4.2 |
> Reschedule rate by booking channel, September vs August 2026 (example data)
:::

- App customers gained most from the reminder: −3.6 points
- The reminder reaches the app and web within a minute of sending
- Phone bookings still reschedule one time in seven
- The app carries 52% of bookings, so it drives the overall fall
- Source: Example booking system, bookings by channel, August-September 2026
---

---
layout: dashboard-grid

## On-time rate and door wait per stop, W36-W39

::: chart type=line unit="%"
| Week | On-time pickups (%) |
|---|---|
| W36 | 85 |
| W37 | 90 |
| W38 | 94 |
| W39 | 94 |
> Weekly share of pickups inside the booked window, September 2026 (example data)
:::

::: chart type=line unit="min"
| Week | Door wait per stop (min) |
|---|---|
| W36 | 3.1 |
| W37 | 3.4 |
| W38 | 3.9 |
| W39 | 4.3 |
> Weekly median wait at the door, driver app (example data)
:::

- Tighter windows removed late pickups and exposed a new loss at the door
- Door wait rose in all four weeks while on-time held at 94%
- The June baseline was 2.6 minutes per stop
- Source: Example driver app timestamps, weeks 36-39 of 2026
---

---
layout: method

## Punctuality definitions and data window

On-time rate = 1 − (late pickups ÷ completed pickups)

- **Pickup** a completed collection at the booked address; a failed visit is counted separately
- **Late** a pickup scanned after the end of the booked two-hour or three-hour window
- **Reschedule** a booking moved by the customer after confirmation, counted once per booking
- **Window** bookings from 1 to 30 September, test accounts removed (about 1% of volume), against 1-31 August
- **Channel** the place where the booking was first made, even if the customer changed it later
- **Cost per pickup** driver hours × €28 an hour ÷ bookings, fuel and vehicles excluded
- **Door wait** median minutes between arrival at the door and the collection scan or the failed visit
- **Failed pickup** a visit where nobody handed over the bag within five minutes
- **Weeks** W36 is 31 August-6 September; W39 is 21-27 September
- Source: Example booking system and driver app, data pulled 2 October 2026
---

---
layout: section-field

# November improvement options
---

---
layout: comparison

## Arrival alert vs apartment lockers

:::: columns 1fr 1fr
::: col
- **Send an arrival alert**
  (1) Pickups: recovers about 700 a month, 31% of 2,300 failed visits
  (2) Dependency: needs only the messaging service already in contract
  (3) Effort: ships in two weeks with one engineer
  (4) Risk: customers may ignore alerts sent after 20:00
:::
::: col
- **Install apartment lockers**
  (1) Pickups: recovers about 600 a month at 12 buildings holding 26% of failures
  (2) Dependency: needs building consent and a locker supplier
  (3) Effort: pilot ready in ten weeks with a facilities lead
  (4) Risk: unused lockers cost €95 a month each in rent
:::
::::

- Source: Example Product Team and Facilities Team estimates, September 2026; alert trial, August 2026
---

---
layout: big-number

## Failed pickups at the door, June-September

| Failed visits | Share of bookings | Apartment share | Alert recovery |
|---|---|---|---|
| 2,300 | 6% | 26% | 31% |
| September visits | June 4% | of all failures | August trial |

> Driver app and booking logs, June-September 2026; alert trial, August 2026 (example)

- Failed visits now cost more pickups than late arrivals
- One in four failures happens at an apartment building
- An arrival alert on every booking would recover about 700 pickups a month
- Source: Example driver app and booking logs, June-September 2026; alert trial, August 2026
---

---
layout: closing-decision-box

## Arrival alert release for November

| Decision | Pickups per month | Owner | When |
|---|---|---|---|
| Arrival alert for all bookings | about 700 | Example Product Team | Ship by 23 Oct |
| Locker pilot at 12 buildings | about 600 | Example Facilities Team | Start in January |
| Door-wait monitoring by route | baseline | Example Operations Team | From 12 Oct |

- Ask: product ships the arrival alert first in October
- Next step: Example Operations Team reports the alert result at the 6 Nov scheduling review
- Source: Example booking system and driver app, September 2026 (example data)
---
