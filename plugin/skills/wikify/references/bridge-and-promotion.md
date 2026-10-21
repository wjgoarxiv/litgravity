# Bridge packets and promotion

Use this when local knowledge has become useful beyond this project, or the user asks how this project relates to another wiki, repository, domain or a global knowledge base. The local wiki stays the authority for project-specific facts. The packet is the safe artifact: it sits inside the base and waits for the user.

## When a packet is warranted

Create `wiki/bridges/<slug>.md` when at least one of these holds:

- the idea appears in several local pages or sources;
- the user explicitly asks for cross-project or global synthesis;
- the knowledge would prevent rework somewhere else;
- the pattern is portable beyond this repository's structure.

A single passing remark is no reason for a packet. Mention it on the topic page instead.

## Procedure

1. **Prove local grounding.** Read `wiki/index.md`, the relevant pages and the raw anchors behind them. A packet whose claims cannot be traced locally is a draft that stays out of the bridge folder.
2. **Classify the candidate**:
   - `concept`: a reusable idea, pattern, method or failure mode;
   - `decision`: an architecture or process choice with its reasons;
   - `comparison`: a reusable side-by-side;
   - `entity`: a tool, system, organization or person worth tracking across projects;
   - `anti-pattern`: a failure mode that should warn future work.
3. **Write the packet** from the template below with `Status: candidate`.
4. **Record merge instructions**: proposed destination title, tags, outbound links, and what must stay local.
5. **Log** `## [YYYY-MM-DD] bridge | <slug> (candidate)` in `log/log.md`.
6. **Stop.** Writing into the destination happens only after the user approves a concrete destination path. Then the packet moves to `approved-to-export`, the export is done as a separate approved write, and the packet becomes `exported` with the destination and date. A declined packet becomes `rejected` with the reason and stays for the record.

## Packet template

```markdown
# Bridge: <candidate title>

Status: candidate | approved-to-export | exported | rejected
Type: concept | decision | comparison | entity | anti-pattern
Proposed destination: <destination-wiki>/<page-or-slug>.md or <unknown>
Confidence: high | medium | low

## Local grounding
- Built from: [[topics/<page>]], [[sources/<note>]], raw/<source-file>

## Portable knowledge
- What should travel beyond this wiki, stated without project-specific paths.

## What must stay local
- Repo paths, transient implementation notes, private context.

## Merge risks and contradictions
- Destination pages that may conflict; claims that need review.

## Suggested links and tags
- Related destination pages or likely tags.
```

## Privacy in packets

Portable knowledge is written with neutral placeholders (`<project-name>`, `<service>`). Customer names, personal names, internal hostnames and private paths stay in the "must stay local" section or are left out. Redact secrets as `<redacted: kind>`.

## Graph and relationship exports

A relationship lens (edges, citations) is local to the base. Exporting it to a graph database or another tool is an export like any other: it needs an approved destination and it never becomes a requirement for the local wiki to work.

## Balance

Two failure modes sit on either side. One treats a packet as permission to write elsewhere; the packet only proposes. The other refuses every cross-project question because the wiki is local; the packet is exactly how such a question is answered safely.

## Lint view

Lint checks that packet statuses match the log, that `exported` packets name their destination and date, and that no page outside `wiki/bridges/` claims to have updated another wiki.
