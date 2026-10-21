# Lane 3: quality

The standard is: would the maintainer approve this pull request without comments? The default agent is `quality-reviewer` (read-only), so the parent hands it the diff, each changed file in full and the neighbors that show the established pattern.

## Inspection areas

1. **Correctness.** Logic errors, off-by-one, null and undefined handling, races, resource leaks, unhandled failures, wrong defaults, time and locale assumptions.
2. **Pattern consistency.** Compare with the neighboring files: naming, layout, error style, imports, test style. Matching the surrounding code beats a private preference.
3. **Naming and readability.** Names say what a thing is. Functions fit on a screen. Comments explain why and avoid restating the code.
4. **Error handling at boundaries.** Swallowed errors and empty catch blocks are findings. Input is parsed once at the boundary and trusted inside.
5. **Type safety.** Casts, ignore directives and `any`-style escapes need a stated reason. New public shapes are typed.
6. **Performance traps** on hot paths: repeated reads, quadratic loops over user data, synchronous work in a request path.
7. **Abstraction level.** An abstraction with one caller is a finding. Duplicated logic across three places is a finding too.
8. **Test quality.** A test has to fail for the regression it names. Mock-call assertions, pinned constants, a fixture equal to the default it overrides, and expected values derived from the output under test prove nothing. New behavior without a test is a MAJOR finding.
9. **API design and compatibility.** Breaking changes to flags, formats, exports and file layouts, with a migration note when they exist.
10. **Tech debt.** TODO markers added without an owner or issue, dead code left behind, copy-paste blocks.

## Package and payload

When the repository ships a package, read the pack listing (`npm pack --dry-run --json --ignore-scripts`, field `[0].files`) or the ecosystem equivalent and check that new files are included, working state (`.litgravity/`, evidence, plans, handoffs) is excluded, manifests and lockfiles agree, version fields moved in lockstep or stayed put as approved, and generated hashes were refreshed by their documented command.

## Skill and documentation diffs

Verify discoverability and hygiene along with grammar: the skill's `name` equals its folder, the description is a quoted single line within its byte cap, the body fits the host's 24,000-byte limit, every relative path the document names exists, and the skill is listed wherever the repository lists skills (route table, manifest, help output, tests). When prose volume or naming changed, run the repository's legacy-token or forbidden-word scanner and recompute any word or byte count with the rule the guard uses. Added words teach a future agent how to act: commands, ledger fields, stale-state probes, injection boundaries, cleanup receipts. Padding, repeated philosophy and generic encouragement are quality findings even when a count passes.

## Severity mapping

A child that uses CRITICAL, WARNING and NITPICK maps them to BLOCKER, MAJOR (or MINOR) and NOTE. The lane is FAIL with at least one BLOCKER or MAJOR.

| Situation | Severity |
| --- | --- |
| Wrong behavior, data loss, broken install or route, failing gate | BLOCKER |
| Missing test for new behavior, a swallowed error on a boundary, docs contradicting code | MAJOR |
| Naming, small duplication, unclear message | MINOR |
| Observations and accepted limitations | NOTE |

## Output

The fixed lane schema with each finding in the form `[SEVERITY] category - path:line - expected vs actual - fix direction`, plus a short paragraph on package and payload when the repository ships one.
