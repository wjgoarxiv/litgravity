# Prose, prompts and docs in scope

Generated-looking residue in non-code files is slop of the same kind as in code: grandiose or unverifiable claims ("seamless", "robust", "handles various cases"), self-referential assistant chatter and apology filler, repeated caveats with no local detail, stale paths, invented benchmarks, and instructions that cannot be verified on the surface they describe.

## Rules for these files

- Preserve facts, names, numbers, command ids, config keys, package names, security and release warnings, the author's voice and honest uncertainty. "Unknown" stays "unknown", and it stays specific: neither confident filler nor a flattened generic failure line replaces it.
- Replace generic prose with the concrete mechanism (which hook fires, which command routes, which ledger path is local state, which script verifies the claim) where that mechanism exists in the repository. A shorter sentence that drops a safety boundary is worse than the original.
- Keep Korean and English register as the author wrote it. Strip stiff translation patterns and duplicated hedges, keep technical terms and nuance, and introduce no new claim, citation or example.
- Contradictions between sections (planning-only text next to implementation text, a command described but absent) get fixed or reported. Confident wording does not paper over a missing surface.
- A clean scanner is a vocabulary gate and says nothing about style. Run it, then reread against the original meaning.
- Prose whose job is voice (a README opening, a blog paragraph, a message the user wrote) belongs to `lit-humanizer`. Burnoff removes residue from technical text and leaves voice work to that route.

## Checks that fit prose

| Check | How |
| --- | --- |
| Every path, command and flag the text names exists | search the repository for each one |
| Every number has a source | find the command or file that produces it, or drop the number |
| Every "always" or "never" has a mechanism that enforces it | find the test, hook or type; otherwise soften to what the code does |
| Scanner for legacy or forbidden tokens | the repository's own command, run after the edit |
| Reference closure for skill text | every relative path a skill document names exists |
| Machine-read fields untouched | frontmatter keys, JSON samples and tokens a hook reads are byte-identical unless the change is the point |

## Information question

For each removed sentence ask what it carried and where that information lives now. A removed warning, a removed path or a removed limit has to reappear in a place the reader will see, or the removal is suspect.

## Skill and agent text specifically

Agent prompts, skill bodies and rules shape behavior, so a cut changes what a future model does. Keep every hard rule, tool boundary, stop condition and evidence requirement. Remove repetition across sections, filler transitions and restated headings. When a skill file has a size limit (agy loads the first 24,000 bytes of a `SKILL.md` body), trimming moves detail into `references/` and leaves the spine in place.
