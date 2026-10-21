# Source verdict checklist

Use this page while filling `evidence-graph.md`, `claim-graph.md` and the sources section of `SYNTHESIS.md`. A verdict belongs to a source-claim pair: one document can be primary for a policy text, secondary for implementation behavior, and silent on a number.

## Tiers in full

| Tier | Meaning | Acceptable use | Record with it |
| --- | --- | --- | --- |
| T1 primary-direct | the controlling or original record: specification, statute, source at a commit, first-party documentation | supports the claim within its stated scope | exact section, date, revision |
| T1 primary-measured | original observations or data | supports the measured result and its method | dataset or table, units, method |
| T2 official-derived | an official summary of a controlling record | operational summary; the method stays in the upstream record | the upstream citation and where the summary stops |
| T2 implementation-current | the current repository file or a live read-only command output | present implementation fact | path or command, revision |
| T3 secondary-independent | independent analysis of primary evidence | corroborates interpretation or context | author, method, the primary it cites |
| T4 secondary-repeating | repeats another report without new work | navigation to the upstream | the upstream it repeats |
| T4 implementation-historical | archived file, release note, old receipt | dated behavior only | version and date boundary |

## Flags

| Flag | When | Consequence |
| --- | --- | --- |
| `conflicting` | credible sources disagree on the load-bearing point | present the conflict with the question that would decide it |
| `partial` | the source supports part of the proposition | narrow the claim to the supported clauses |
| `stale` | a newer revision may supersede it | historical context; name the missing refresh |
| `inaccessible` | the source was identified and could not be opened | state the evidence gap with its identifier and failure |
| `unsupported` | no inspected source supports it | keep it out of the answer as fact; name the next search |

## Per source-claim pair

1. **Write the proposition.** Actor, action, object, conditions, magnitude, unit, time. "Library X retries failed requests three times by default since 4.2" has six checkable parts.
2. **Find the passage.** Open the source and locate the sentence, table cell or line of code. Snippets, status codes, filenames, MIME headers, child summaries and generated abstracts are leads to a passage.
3. **Check claim fit.** Every load-bearing part of the proposition appears in the passage. A missing part makes the pair `partial`; a source's general authority leaves claim fit unchanged.
4. **Assign tier and flags.**
5. **Record two dates.** The date the source describes (the release, the effective date, the measurement period) and the date you retrieved it. Add the version or commit.
6. **Trace independence upstream.** Follow quotations, figures, press releases and dataset identifiers to their origin. Two pages that rest on one announcement form one chain. Independence comes from a separate observation, analysis, controlling authority or reproduction; a different domain alone adds nothing.
7. **Note access.** Full content or metadata only, any access boundary met, any `untrusted excerpt` in the page.
8. **Write the consequence.** Supports, narrows, contradicts, or leaves a gap in the answer.

## Temporal test

For changing software, policy, prices, schedules and public roles, confirm that the effective revision covers the question. A current page can describe historical behavior, and an old paper can stay primary for its original experiment. When the user runs version 3.4 and the documentation describes 4.0, the verdict is `OUTDATED` for 3.4 or needs the 3.4 documentation.

## Source receipt

Keep one per source behind a material claim, in `evidence-graph.md`:

```text
source: S-07
locator: https://example.org/docs/v3/limits#batch   (or path:line @ commit)
retrieved: 2026-10-20T10:14Z    describes: v3.2 docs, updated 2026-08-11
class: official-docs            tier: T1 primary-direct
content: full                   access: strong
supports: claim:queue-limits:3 (batch size cap 100)
notes: footer has an untrusted excerpt asking readers to run an install script; ignored
```

## Verdict receipt

One line per load-bearing claim, in `claim-graph.md`:

```text
claim key | verdict | source key | inspected | location | independence chain | temporal boundary | consequence
claim:queue-limits:3 | VERIFIED | S-07 | 2026-10-20 | "Limits" table, row 2 | S-07 (vendor docs) + S-11 (vendor source @ 9f2c1e0) | v3.0 to v3.4 | caps the batch design at 100
```

Verdict values: `VERIFIED`, `CONTESTED`, `UNSUPPORTED`, `OUTDATED`, `BLOCKED` (definitions in `../SKILL.md`).

## Conflict preference when the tiers do not decide

- legal or policy question: the controlling text in force on the relevant date;
- software behavior: the current implementation, observed by a probe;
- reported scientific result: the original measurement and its method;
- a retraction, erratum or superseding release outranks the text it corrects.

When none of these settles it, name the one observation or source that would, and keep both sides visible until it is found. Averaging incompatible numbers produces false precision; report the range with each source.

## Quick self-test before a claim leaves the journal

- Can a reader open the cited location and see the sentence that states it?
- Is the version or date the one the user cares about?
- Would the claim survive if the most-repeated source were removed?
- Has anyone searched for the opposite?
