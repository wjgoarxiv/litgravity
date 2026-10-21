# Deliverable channels

Decide the channel before you rewrite a word. A fact that belongs in a ledger line can be clutter in a report, and a caveat that changes a decision can vanish if it is left only in the ledger. Every fact goes to exactly the places where its reader needs it.

LitGravity work has three channels.

| Channel | Who reads it | Where it lives | What it keeps |
|---|---|---|---|
| Requested artifact | The person the user is writing for | The file or text the user asked for | Every supported fact, number, name, date, quote and citation; each limit that changes how to read a claim, stated once where it applies |
| Chat reply | The user, now | The conversation | The result, one material risk if any, the action the user must take; anything they asked to hear |
| Working record | The next conversation, a reviewer, an auditor | `.litgravity/ledger/<conversation-id>.jsonl`, `.litgravity/evidence/<slug>/`, `.litgravity/drafts/`, `plans/`, handoff files | Exact paths, commands, counts, hashes, provenance, failed attempts, every uncertainty, compact keys |

## Requested artifact

Write for the artifact's reader, format and voice. Keep every supported fact and every qualifier that does work. When a summary drops detail, it keeps the source's direction and limits.

Citations follow the format the user asked for: footnotes, endnotes, a reference list or inline attributions. A plain source line directly under a table, a Markdown image, an HTML figure or a figure caption is a layout convention and may stay when it sits within one blank line of the visual. The allowance stops there; a source line in the middle of prose is read as prose. A source line that also carries a limit ("projected, not realized") stays visible to the detector, so the limit gets its own sentence.

Keep a legal, medical, scientific, financial or safety boundary when the user asked for it or the reader needs it to use the artifact safely. A proposal stays a proposal, an estimate stays an estimate, and a negative finding stays in the text. A limitation that changes a decision goes in the artifact when the claim, the format or the required context needs it; otherwise it goes once in the chat reply.

### Reader-safe rewrites of real deliverable lines

Each pair keeps the source condition and its consequence. The subjects are neutral; the shapes come from real deliverables (see `references/taxonomy.md` for all 26 lines).

> Before: Completion will deliver a 30% gain.
> After: The plan lists a 30% gain as the expected outcome after completion; the gain has not been measured yet.
>
> Before: [C003] says the 30% gain is not realized.
> After: The source gives the 30% gain as an expectation. The key that links this claim to its source stays in the ledger.
>
> Before: Source: annual report, table 4.
> After: The annual report gives the value in table 4.¹
>
> Before: Source: annual report, table 4. Not a realized outcome.
> After: The annual report lists the value in table 4 as an expected outcome.¹
>
> Before: **Evidence boundary:** site deployment not verified.
> After: The public product pages describe the product; they do not show where it is deployed.
>
> Before: Evidence: no independent reproduction.
> After: We have not reproduced the result ourselves.
>
> Before: Confidence: high, source-backed within the packet.
> After: The claim matches the supplied packet; nobody has checked it against the original pages.
>
> Before: [미검증] [증거 기반]
> After: 표 3의 추정치는 아직 확인하지 않았습니다. 근거는 보고서 각주 2에 있습니다.
>
> Before: 미확인 · 미실행 · 투자 조언 아님 · 허가 판단 결과 아님
> After: 원격 검증은 실행하지 않았습니다. 이 자료는 투자 조언이 아니며, 허가 여부는 관할 기관이 판단합니다.
>
> Before: demo synthesis and assumptions
> After: The architecture is a proposal for the pilot. Its leading indicators and baselines are assumptions.
>
> Before: Captured in the evidence lane via the claim ledger.
> After: The result comes from the March load test.
>
> Before: The image receipt confirms the single-frame figure.
> After: Figure 6 shows one checked frame at 2.885 µs.
>
> Before: I've updated the file and saved it.
> After: The report now includes the revised measurements.
>
> Before: Let me know if you'd like another version.
> After: (End after the requested artifact. If a decision remains open, name it in the reply.)

## Chat reply

Lead with the result. Summarize the change only when that helps the user act. State one material risk plainly when it affects a decision, and name any action the user must take. Leave out audit preambles, editing narration and service closers. Claim only the checks that actually ran: "I ran the detector on the revised text; no block hits" is fine when it happened, and when `run_command` was refused the reply says once that the detector did not run.

## Working record

Plans, evidence folders, the ledger, handoffs, status output and machine-readable reports may need exact paths, commands, counts, hashes, provenance, failures and repeated uncertainty. Keep them exact and structurally intact. Smoothing a record into nicer prose loses information the next conversation needs. A record may keep compact keys, status fields and lane names when its format calls for them; those fields stay in the record when the deliverable is written.

Add a ledger line when a rewrite makes a decision a reviewer would want to see, for example `{"kind":"decision","text":"kept the 3 hedges in section 2: forecast language","path":"report.md"}`.

## Keep useful caveats without stacking them

- One result may need one scope sentence. Keep every condition that changes its meaning.
- Separate risks keep separate places. Merging two safety conditions into one vague sentence is a fidelity defect.
- A legally or clinically required disclaimer stays, placed where the user or the format asks for it.
- When a test did not run, say which test and what scope. A missing check must never read as a pass.
- When the source does not support a stronger claim, keep that limit. A named source never replaces a vague one unless the draft supplies it.
- An accurate verification limit that changes the claim is stated once, in the sentence it limits, with its scope exact.

## Internal vocabulary to reader prose

Internal process names stay in the working record unless the reader needs them to reproduce or audit a result. Replace a process label with what it points to: the file, the source, the measurement, the person, the date or the action. An unknown stays unknown.

The factual relation decides the rewrite. A compact label may become:

- an attributed observation ("The March audit found …");
- a sentence naming a proposal or an assumption;
- a source note attached to a visual;
- a statement that an action did not run;
- a scoped legal or safety condition;
- a pointer to the internal record, for a reader who audits.

## Category-1 placement map

`references/taxonomy.md` gives a rewrite for each of the 26 real lines. This table says where the rewritten fact goes.

| Shape | Placement |
|---|---|
| Source plus forecast, demo status or assumptions | In the artifact when requested or needed to interpret the result, as a factual sentence with a normal citation; otherwise in the working record |
| Internal keys and routing | Working record; ordinary attribution in the artifact only when requested or needed |
| Label, bracket tag, confidence or evidence boundary | The relevant fact as a plain sentence in the artifact when the reader needs it; drop the panel |
| Non-observation or unperformed work | In the artifact when requested or required to define a claim; otherwise once in the chat reply when it changes a decision |
| Disclaimer chain | Each relevant condition as a concise sentence; irrelevant boilerplate removed |
| Source line under a visual | Plain attribution when requested or required by the format; a template field is no reason to add one |
| Demo or self-description | Say whether each part is proposed, assumed, simulated or measured when that affects interpretation; a self-label is never evidence |
| Standalone "limitations" sentence | Requested or required content stays; a generic limitations section goes, and a decision-changing risk goes once in chat |

## Detector boundary in LitGravity

`scripts/detect.mjs` scans whatever text it is given and cannot tell which part of a file you wrote. Give it only text you generated or changed:

- pipe a pasted passage on standard input through `run_command`;
- or write the revision to `.litgravity/drafts/<slug>.md` in the workspace and scan that file.

Existing file text, exact user quotations, source quotations, the working record, fenced code and inline code stay outside the scan. Exit 0 means no findings. A non-zero exit means warnings or blocks were printed (or the input could not be read), and the summary line counts each tier; read the printed lines either way, since a warning-only run is often finished work.

The plugin's write guard reports stacked negations and stacked hedges in Markdown that other routes write. It stands down on the `lit-humanizer` route, so that a user's own wording survives an edit. On this route, then, the detector run by hand is the only check: run it on every revision and treat each block-tier hit as unfinished work. When `run_command` is refused, read the revision against `references/taxonomy.md` by hand and say once in the reply that the detector did not run.
