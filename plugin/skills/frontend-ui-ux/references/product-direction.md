# Product direction

Run this pass before any grid, token or component decision. Its output fills the Design Contract `intent` group and seeds `omissions`.

## Describe each user by the decision they own

Two groups making the same decision are one group. Merge them, or name what separates them.

- Operator: the decision they make, return frequency, device class, viewport band, network.
- Secondary readers: approver, auditor, on-call responder, support agent.
- Cost of a wrong decision: recoverable in session, expensive to reverse, or permanent.
- Groups this surface turns away, written into `intent.non_goals`.

## Reduce each surface to one completion condition

One surface, one task the user must be able to finish. Everything else is subordinate.

- Phrase it as verb, object, end state: "cancel the shipment and see the refund posted".
- Name the two next-most-frequent tasks, and push the rest behind disclosure.
- Require the first viewport to answer: what happened, what matters now, what next.

## Convert quality words into measured signals

"Fast" and "intuitive" are directions. Each becomes a number you can read.

- Completion time at p50 and p90, with the ceiling you will defend.
- Error rate on the primary form, and the share of errors preserving entered input.
- Interaction cost on the frequent path, as a keystroke or tap ceiling.
- Regression consequence: what the product loses when a signal moves the wrong way.

## Register what is not yet known

Every unknown gets an owner in writing, or it returns later as an invented assumption.

- Question phrased so one answer closes it.
- Blocked decision: which layout, density or token waits on it.
- Route: user answer, repository inspection, instrumentation or a prototype.
- Working assumption meanwhile, recorded in `intent.constraints`.
- Revisit date; past it, the gap becomes an `omissions` entry with an owner.

## Walk five journeys to the same end state

Each journey ends at the completion condition above. One that stops earlier is a defect.

- Low vision: 200 % zoom and 400 % text. What reflows, stays reachable or clips.
- Keyboard only: entry point, tab count to the primary action, escape from every container.
- Screen reader: reading order, programmatic names, the announcement confirming success.
- Low bandwidth: what paints before data arrives, and what the surface says at 3 s and 10 s.
- Unfamiliar language: copy at the declared `text_expansion_percent`, mixed-script wrapping, locale dates.

## Keep more than one answer alive

Hand the next stage a bounded set. One inevitable option is a decision nobody reviewed.

- Produce two or three directions separated by structure or density, with accent hue left out of the difference.
- Give each the task it accelerates, the task it slows and its migration cost.
- Mark one recommendation with a one-sentence reason, and keep the rejected ones legible.

## Halt at named checkpoints

A checkpoint is a stop. Work resumes when the answer exists. Each checkpoint becomes an `ask_question` with a recommended default, or a `decision` ledger line when nobody can answer.

1. Users, critical task and success signals accepted. This blocks all visual work.
2. One direction selected from the bounded set. This blocks token and layout commitment.
3. Brand marks, legal copy and identity approved. Report `BLOCKED` until the user answers.
4. Contract validates and its hash is recorded. This blocks the independent review pass.

## Hand over the research package

The next stage reads this package. What is missing does not exist for it.

- Users with decisions, one critical task per surface, ranked information, non-goals.
- Signals with thresholds, plus the regression consequence.
- Knowledge-gap register with owners and revisit dates.
- Five journeys with pass conditions; bounded directions with costs and a recommendation.
- Finite surface list: routes, states, viewport bands, auth requirements.
- The design contract hash that the independent review pass binds its receipt to.

Write it to `.litgravity/design/<slug>-direction.md` (the contract's `intent` and `direction` groups repeat the decided parts).

## Worked example

Surface: invoice list for a small accounting team. Operator: bookkeeper, daily, 1440 px desktop, decides which open invoices to chase. Secondary: owner, weekly, phone. Completion condition: "find this month's open invoices and open one ledger entry". Signals: first open invoice found in 15 s at p90, zero lost filter state after opening an entry. Unknown: whether invoices export to CSV (owner: user; blocks the toolbar layout; working assumption: no export). Directions: dense table (A) versus card list with a summary band (B); recommendation A for the bookkeeper, B on phones through `responsive_transformations`.

## Failure patterns

Reject:

- a persona described by demographics instead of by a decision
- "improve the experience" accepted as an outcome with no observable task
- one direction presented with no alternative and no stated cost
- a success claim resting on a single happy-path capture
