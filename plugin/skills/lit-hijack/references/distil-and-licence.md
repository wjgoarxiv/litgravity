# Distil and licence

Distilling turns sources into mechanism cards: what a technique does, why it works, and how sure
anyone can be. The licence gate then decides, per source, what the port may take.

## Mechanism, evidence, opinion

A source usually mixes three things. Keep them apart on every card.

| Part | What it looks like | Where it goes |
| --- | --- | --- |
| Mechanism | A step, rule, structure, check or default that produces an effect | `what` and `why` |
| Evidence | A measurement, a before/after, a reproducible example, a failure story with a cause | `evidence` and `evidence_note` |
| Opinion | Taste, prediction, preference, a claim without support | a card marked `opinion`, or nowhere |

Evidence classes:

- `evidenced`: someone measured it, showed comparable outputs, or the mechanism can be reproduced.
- `anecdotal`: a practitioner reports it worked, with enough detail to understand why.
- `opinion`: a stance or a style choice. Still worth porting when it fits the target.

## Writing a card

```json
{
  "id": "M1",
  "title": "Production brief before any render",
  "sources": ["S1", "S3"],
  "locator": "S1 section 1; S3 pages 4-6",
  "what": "A production note fixes the takeaway and the rejection condition before the first frame.",
  "why": "Unfilled decisions are filled by model defaults, which is where look-alike output comes from.",
  "evidence": "anecdotal",
  "evidence_note": "Two practitioners report it; neither measured it."
}
```

Rules for cards:

- Write each card as if explaining the technique to a colleague who will never read the source.
- Separate the claim from the evidence.
- When several sources describe the same technique, merge them into one card that names every source.
- A mechanism the base model already follows unaided adds nothing; note it and leave it at the gap
  step.
- Keep the provenance, drop the prose. A card cites a locator, never a quotation.

## Licence table

`hijack.mjs licence` reads each source's licence evidence and writes a decision:

| Licence class | Examples | Script decision | Reason |
| --- | --- | --- | --- |
| Permissive | MIT, ISC, BSD, Apache-2.0, Zlib, Unlicense, CC0, BSL-1.0, Python-2.0 | `ideas-credit` | Permits reuse; take mechanisms only and ship a credit line |
| Attribution | CC BY-4.0 | `ideas-credit` | Asks for credit; take mechanisms and credit |
| Copyleft | GPL, LGPL, AGPL, MPL, CC BY-SA | `ideas-only` | Take mechanisms only; keep the implementer away from the source |
| Restricted | CC BY-NC, CC BY-ND | `ideas-only` | Bars commercial use or sharing adaptations |
| Unlicensed | No licence stated (most posts, articles, gists) | `ideas-only` | All rights reserved; take mechanisms only and credit in the report |
| Restricted terms | "Do not copy", "source-available", "proprietary" | `needs-review` | A person decides `ideas-only` or `no-go` |
| No access | Login, paywall, leaked, private | `no-go` | Nothing |

The script reads reuse terms only on lines about rights, not inside the subject matter. An article
that tells its readers "DO NOT COPY the reference layout" is giving advice, not setting terms.

Every decision limits the port to mechanisms. Ideas and methods are free to learn from; expression is
protected; attribution leaves a copy exactly as risky as it was. This is risk-reduction, not legal
advice.

Override a decision with `hijack.mjs licence <run> --set S<n>=<decision> --reason "..."`.
