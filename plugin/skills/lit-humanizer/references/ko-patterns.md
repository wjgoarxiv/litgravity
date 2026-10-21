# Korean patterns: index

The Korean catalog has 85 entries in ten groups. This page tells you which shard to open, what the evidence labels mean, and which entries need extra care. Open only the shard that fits the draft; each one is self-contained.

| Shard | Groups | Open it when |
|---|---|---|
| `references/ko-patterns-a-d.md` | A translation-shaped syntax (A-1 to A-24), B English terms inside Korean (B-1 to B-4), C layout and paragraph rhythm (C-1 to C-12), D recurring phrases and endings (D-1 to D-14) | The sentence reads like a translation, the layout feels templated, or the endings and conclusions repeat. |
| `references/ko-patterns-e-j.md` | E rhythm (E-1 to E-7), F repetition and modifiers (F-1 to F-5, F-7), G hedging (G-1 to G-3), H connectives (H-1 to H-4), I noun-heavy forms (I-1 to I-7), J visual punctuation (J-1 to J-4) | The rhythm is flat, the hedges stack, connectives open every sentence, or bold and quotes decorate the page. |
| `references/ko-metrics.md` | Counts for D-1, D-8, H-1, C-11 and descriptive rhythm numbers | You want repeatable numbers before or after an edit. |
| `references/litgravity-style-patterns.md` | Compact texture notes | You are the `korean-style-analyzer` pass and need a fast first read. |
| `references/litgravity-rewrite-rules.md` | Meaning-safe rewrite moves | You are making the bounded Korean rewrite. |
| `references/litgravity-fidelity-checklist.md` | Before/after gate | You are checking meaning after the rewrite. |

Detector cues and their tiers are in `rules.json` (Korean rule ids start with `ko-`). `references/taxonomy.md` maps each rule to its catalog entries, and `references/deliverable-channels.md` says where a rewritten fact belongs.

## ID inventory

A: A-1 to A-24. B: B-1 to B-4. C: C-1 to C-12. D: D-1 to D-14. E: E-1 to E-7. F: F-1 to F-5 and F-7 (the source retired F-6). G: G-1 to G-3. H: H-1 to H-4. I: I-1 to I-7. J: J-1 to J-4. Total: 85.

Every entry has the same parts: what the pattern looks like, why it weakens a sentence, how to detect it, two Korean before-and-after pairs on neutral subjects, when to leave it alone, and the evidence label.

## Evidence labels

- **validated**: the source taxonomy reports a comparative corpus result, a task-matched comparison or a measured review set for the cue. The entry keeps the source's genre, model and sample caveats.
- **weak**: a linguistic or editorial hypothesis without a direct comparison for that exact cue, or a result the source says depends on model or genre.
- **hold**: the source says the cue is not yet a basis for rewriting.

Validated describes the measured sample. Several validated findings (A-1, A-2, A-11, I-1) show people using the form more often than models, so the evidence supports keeping the form and editing only a dense cluster.

## Entries that need extra care

Read these with their "Leave it" line in front of you; each carries a preservation condition, a dataset caveat, a hold status or a genre limit:

A-1, A-2, A-10, A-11, A-16, A-17, A-20, A-21, A-23, A-24, C-1, C-8, E-5, E-6, E-7, G-1, G-2, G-3, H-1, H-3, I-1, I-4, I-5, I-7, J-2, J-3.

For these, a count or a phrase match alone never justifies an edit. Read the sentence, check the modality and the source, and change it only when the reader gains something.

## Sources

The IDs and evidence labels follow a pinned Korean machine-prose taxonomy and a local research synthesis; `NOTICE` beside `SKILL.md` records the provenance. Explanations and examples here are written fresh for this skill.
