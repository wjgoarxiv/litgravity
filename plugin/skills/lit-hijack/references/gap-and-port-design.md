# Gap analysis and port design

The gap analysis decides which mechanisms the target needs; the port design decides what each one
becomes inside the target. Both are written against the target as it was at the base revision.

## Read the target first

Before judging any gap, read:

- the target's instructions, README and rules;
- every file of the skill or module being changed;
- every test that names the target, and the guards that pin its files;
- for a plugin, how a neighbouring skill of similar weight is enrolled.

For a new target (`init --new`), read the neighbouring skills instead and treat every mechanism as
`lacks` with `gap.searched`.

## Gap fields

```json
"gap": {
  "status": "weak",
  "refs": ["skills/motion/SKILL.md:120-134", "skills/motion/scripts/render.mjs:88"],
  "note": "The skill asks for a treatment in prose; the render script starts without one."
}
```

- `status` is `has`, `weak` or `lacks`.
- `refs` are `path:line` or `path:start-end`, relative to the target root. The gate resolves each
  one at the base revision and fails when the file or line is missing.
- A `lacks` claim with empty refs needs `searched`: the terms and places you searched.
- `note` is one sentence a reviewer can check against the refs.

How to judge the status:

| Status | Means | Refs |
| --- | --- | --- |
| `has` | The target already does it, mechanically | At least one `path:line` where the check fires |
| `weak` | The target says it but nothing enforces it | At least one `path:line` of the prose |
| `lacks` | The target does not do it at all | None, with `searched` |

"The skill says it" and "the skill does it" are different claims. A prose instruction with no script
or gate behind it is usually `weak`.

## Port fields

```json
"port": {
  "decision": "adapt",
  "reason": "The skill already writes a brief; it lacks the two required fields."
}
```

- `take`: new to the target.
- `adapt`: strengthen what is weak.
- `leave`: do not port, with a reason.

Leave what the target already has, what the base model already does, what the licence gate forbids,
what conflicts with the target's design, and what costs more than its evidence is worth.

A taken mechanism that rests only on no-go sources fails the gate.

## Writing SPEC.md

The spec is the only artifact that crosses from the spec writer to the implementer.

Template:

```markdown
# Spec: <port title>

## M1 <title>

The target gains <behaviour>. It lives in <file(s)>. Acceptance: <check>.

Parity marker: <what the new behaviour leaves in its output>.
```

Rules:

- Re-express in the target's vocabulary: its naming, file layout, test framework and tone.
- Prefer a mechanism a script can check over a paragraph the model may skip.
- One section per taken mechanism, headed `## M<n> <title>`.
- The spec is source-free: no quotations, no source URLs, no paths into `sources/`, no examples
  lifted from a source, no source headings. The gate checks paths, URLs and 12-word runs.
- Name the enrollment surfaces: route, listing, README, pack payload, tests.

Fill `mechanism.parity` while writing the spec:

```json
"parity": {
  "criterion": "A brief names the takeaway and the rejection condition.",
  "red": "baseline brief has neither field",
  "green": "treatment brief has both fields",
  "surface": "agy -p in a throwaway workspace",
  "artifact": "parity/treatment.md"
}
```

And fill `ledger.parity.markers` with a short string the new behaviour leaves in its output.
