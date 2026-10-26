---
tonality: night
title: Checkout funnel review, September 2026
date: 2026-10-02
department: Example Analytics Team
presenter: Example Analyst
notice: Example data — replace with real figures
---

---
layout: cover-numeral

# Checkout funnel review, September 2026
---

---
layout: kpi-row

## Sessions, conversion and orders, September

| Sessions | Conversion | Orders | Average order | Revenue |
|---|---|---|---|---|
| 2.14m | 3.8% | 81,300 | $46.20 | $3.76m |
| August 2.13m | August 3.3% | August 70,700 (+15%) | August $45.80 | August $3.24m (+16%) |

> Web and app checkout, 1-30 September 2026, bots removed (example)

- Conversion rose from 3.3% to 3.8% while traffic stayed flat (+0.5%)
- Orders grew 15% with no change in paid traffic or discounts
- Average order value moved by less than 1%, so revenue tracked orders
- Source: Example analytics warehouse and order ledger, August-September 2026
---

---
layout: full-chart

## Drop-off by checkout step, August vs September

::: chart type=column unit="% of entrants"
| Step | Drop-off in August (%) | Drop-off in September (%) |
|---|---|---|
| Cart | 31 | 30 |
| Sign-in | 8 | 8 |
| Address | 24 | 14 |
| Shipping | 9 | 9 |
| Payment | 12 | 11 |
| Review | 4 | 4 |
> Share of entrants who left at each step, August and September 2026 (example data)
:::

- Address drop-off fell by ten points after the new form shipped on 2 September
- Every other step moved by one point or less
- Cart remains the largest step loss, but most of it is browsing, not friction
- Source: Example analytics warehouse, step events, August-September 2026
- Note: drop-off is measured per step against that step's entrants, as defined on the method slide
---

---
layout: chart-insight

## Conversion by device, August vs September

::: chart type=bar unit="%"
| Device | Conversion in August (%) | Conversion in September (%) |
|---|---|---|
| Mobile web | 2.6 | 3.4 |
| Tablet web | 3.1 | 3.6 |
| Desktop web | 4.9 | 5.2 |
| App, iOS | 5.9 | 6.1 |
| App, Android | 5.6 | 5.8 |
> Conversion by device, September vs August 2026 (example data)
:::

- Mobile buyers gained the most from the new form: +0.8 points
- Autofill on small screens saves about 40 seconds per order
- Desktop gained 0.3 points; both apps already had autofill
- Mobile web is 58% of sessions, so it carries most of the gain
- Source: Example analytics warehouse, sessions by first-page device, August-September 2026
---

---
layout: dashboard-grid

## Card decline rate and payment page load, W36-W39

::: chart type=line unit="%"
| Week | Card declines (%) |
|---|---|
| W36 | 6.1 |
| W37 | 6.4 |
| W38 | 6.9 |
| W39 | 7.2 |
> Weekly card decline rate, September 2026 (example data)
:::

::: chart type=line unit="s"
| Week | Payment page load (s) |
|---|---|
| W36 | 2.1 |
| W37 | 2.3 |
| W38 | 2.6 |
| W39 | 2.8 |
> Weekly payment page load time, median (example data)
:::

- Payment failures are now the largest fixable loss in the funnel
- Declines and load time rose together in all four weeks of September
- The June baseline was 5.0% declines and 1.9 s load time
- Source: Example payment logs and page timing beacons, weeks 36-39 of 2026
---

---
layout: method

## Funnel definitions and data window

Drop-off = 1 − (entrants to the next step ÷ entrants to this step)

- **Entrant** a session that loaded the step at least once; reloads of the same step count once
- **Session** visits from one browser or app install, closed after 30 minutes without activity
- **Conversion** sessions with a confirmed order divided by all sessions in the window
- **Window** sessions from 1 to 30 September, bots removed (about 3% of traffic), compared with 1-31 August
- **Device** taken from the first page view of the session, so a switch mid-session is not counted twice
- **Decline** a payment attempt the card issuer refused, counted once per order attempt
- **Soft decline** a refusal the issuer marks as retryable, such as a timeout or a velocity limit
- **Page load** median time until the payment form accepts input, measured in the browser
- **Weeks** W36 is 31 August-6 September; W39 is 21-27 September
- Source: Example analytics warehouse and payment logs, data pulled 1 October 2026
---

---
layout: section-field

# October sprint options
---

---
layout: comparison

## Card retry vs faster payment page

:::: columns 1fr 1fr
::: col
- **Retry declined cards**
  (1) Orders: recovers about 1,200 a month, 41% of 2,950 soft declines
  (2) Dependency: needs the payment partner's retry service, already in contract
  (3) Effort: ships in three weeks with two engineers
  (4) Risk: issuer fees of about $0.05 per repeated attempt
:::
::: col
- **Faster payment page**
  (1) Orders: recovers about 900 a month if load returns to the June 1.9 s
  (2) Dependency: needs only front-end work, no partner change
  (3) Effort: ships in two weeks with one engineer
  (4) Risk: the gain depends on third-party scripts we do not control
:::
::::

- Source: Example Payments Team and Web Team estimates, September 2026; retry trial May 2026
---

---
layout: big-number

## Card-decline order loss, June-September

| Lost to declines | Share of orders | Soft declines | Retry recovery |
|---|---|---|---|
| 5,900 | 7% | 50% | 41% |
| September orders | June 5% | of all declines | May trial, one retry |

> Payment logs, June-September 2026; retry trial May 2026 (example)

- Declines cost more orders than any other step in September
- Half of the declines were soft declines that a retry often clears
- One retry on soft declines would recover about 1,200 orders a month
- Source: Example payment logs, June-September 2026; retry trial, May 2026
---

---
layout: closing-decision-box

## Card retry release for October

| Decision | Orders per month | Owner | When |
|---|---|---|---|
| Card retry with the payment partner | about 1,200 | Example Payments Team | Ship by 24 Oct |
| Faster payment page | about 900 | Example Web Team | Start in November |
| Decline monitoring by issuer | baseline | Example Analytics Team | From 14 Oct |

- Ask: product ships card retry first in October
- Next step: Example Analytics Team reports the retry result at the 7 Nov funnel review
- Source: Example analytics warehouse and payment logs, September 2026 (example data)
---
