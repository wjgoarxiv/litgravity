# Operating lanes

Every interface request runs in exactly one lane. The lane fixes the evidence you gather, what you may edit, what stays frozen, and what closes the work.

| Lane | Use it when | Starting move |
| --- | --- | --- |
| `new-build` | Nothing exists yet | Direction, inventory, then the smallest working version of every feature |
| `brownfield` | A product exists and the change must fit it | Read repo rules, tokens, primitives and gates; preserve local convention |
| `redesign` | The existing interface is being replaced on purpose | `references/redesign-playbook.md`; name the migration cost |
| `reference-fidelity` | A screenshot, mockup or reference must be matched | `references/visual-reconstruction.md`; capture comparable halves |
| `design-system` | Tokens, primitives and rules are the deliverable | `references/system-foundations.md`; the contract is the product |

## Selecting a lane

Pick from observable repository facts. The user's phrasing is a hint. Name the lane before the first edit.

1. No production UI exists for the surface: `new-build`.
2. UI exists and the request repairs or extends it: `brownfield`.
3. UI exists and the request replaces its visual language: `redesign`.
4. A screenshot, mockup or live product is the acceptance target: `reference-fidelity`.
5. The deliverable is primitives that other surfaces consume: `design-system`.

Evidence that settles the choice: `git log --oneline -- <surface path>` (history means UI exists), `rg -l <component name>` (call sites), a read of the route table, and the user's attachments. Record the lane as the contract's `lane` field and repeat it in the first line of the work receipt.

## Lane: new-build

Settle the system before drawing screens. Your first component becomes the convention.

- Evidence: package boundaries, routing, data layer, global styles, locales, device classes.
- Permitted: every file in the new surface, plus new tokens and primitives.
- Frozen: file layout, naming, import boundaries, test placement, data-fetching pattern.
- Failure mode: a second styling system grows beside the one already in the repository.
- Exit: inventory finite, every declared state renders, and no raw value sits where a token already exists.

## Lane: brownfield

Audit before editing. The existing system is the specification until the user says otherwise.

- Evidence: covering primitives, their variants and call sites, untouched captures at two widths.
- Permitted: the named defect and its direct call sites.
- Frozen: exported props, imported token and class names, keyboard model, test assertions.
- Failure mode: a local fix mutates a shared primitive and breaks surfaces nobody opened.
- Exit: the defect is gone, and every other consumer of the touched code has parity evidence.

## Lane: redesign

Current behavior is the specification. Only the visual language is negotiable.

- Evidence: baseline capture of every affected route and state, the debt map, keyboard paths.
- Permitted: tokens, spacing, typography, density, motion, component internals.
- Frozen: task paths and step counts, URLs and parameters, data meaning, permissions, copy.
- Failure mode: old and new surfaces coexist and nobody owns the remainder.
- Exit: parity holds at every stage boundary and no route stays on the superseded system.

## Lane: reference-fidelity

Separate what the reference proves from what you supplied. Only observed claims become criteria.

- Evidence: provenance and permission, pixel dimensions, device scale, the exact state depicted.
- Permitted: the depicted surface, to the agreed fidelity level.
- Frozen: the repository stack, the accessibility floor, licensing of every mark and asset.
- Failure mode: one width matches while responsive and interaction behavior is invented.
- Exit: every observed claim is checked, and every inference is recorded as an assumption with an owner.

## Lane: design-system

The consumers are the deliverable, and the gallery serves them. Specify the contract first.

- Evidence: duplicated implementations across consumers, variants in use, call sites.
- Permitted: primitive internals, token definitions, documented variants, migration paths.
- Frozen: published prop contracts until a migration exists; the keyboard model of replaced controls.
- Failure mode: a gallery ships and no production route adopts it.
- Exit: two representative consumers migrated and passing, with a dated removal plan.

## Requests spanning two lanes

Split the request and keep each half in its own lane.

1. Name both lanes and assign each surface to exactly one.
2. Write one contract per lane, each with its own inventory, budgets and exit.
3. Sequence them: repairs before a redesign of the same surface, primitives before consumers.
4. If the split is refused, apply the stricter lane's frozen list to the whole scope.
5. Re-declare the lane as soon as discovery changes it, then revalidate the contract.

## Where the lane is recorded

The lane is a required, machine-checkable `lane` field of the authoritative `litfamily.design-contract/v1beta2` artifact. A valid `litfamily.design-contract/v1beta1` artifact stays a compatibility input for existing implementation paths. The validator rejects a missing lane, an unknown lane and a prose synonym. The review package repeats the value beside the contract hash, and the field itself stays the record. A v1alpha1 contract has no lane and is migration-only, so its report carries `LEGACY_SCHEMA_V1ALPHA1` and `evidence_eligible: false`.

## Degraded overlay

When a required visual input or environment is missing (no browser, no design reference, no repository access to the running app), `degraded` applies on top of the lane. Produce the strongest finite contract available, mark the affected rows Not verified, and name the capability that restores them. Degraded work ends BLOCKED for the visual claims and may still deliver code.

## Failure patterns

Reject:

- a change whose review package names no lane
- a `brownfield` or `redesign` lane opened with no baseline capture
- a lane switch first visible in the diff
- a `reference-fidelity` verdict claimed from a general visual review
- an unlaned change entering the independent review pass, which leaves the reviewer to guess which frozen list the contract hash covers
