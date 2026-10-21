# Playbooks, evidence layout and reply shape

Four playbooks, one per mode in `SKILL.md`. Each lists the commands in order, the evidence it leaves under `.litgravity/evidence/<slug>/` and the line that goes into the ledger. `<skill-dir>` is the folder that holds `SKILL.md`.

## Create

1. Write the content brief to `.litgravity/evidence/<slug>/brief.md`: audience, purpose, type id, theme, canvas preset, language, required facts, labeled relationships, trust-boundary lists when a boundary exists, destination and requested formats.
2. `node "<skill-dir>/scripts/doctor.mjs"` and `node "<skill-dir>/scripts/diagram-runtime.mjs" status --json`, saved together as `runtime.txt`.
3. Write `inventory.md`: one row per node and per labeled edge with its source path or quote, plus the one question the diagram answers.
4. Copy the closest template from `assets/examples/` into `docs/diagrams/<slug>/`, rename it `<slug>.html`, and replace the facts. Keep the structural grammar of the type guide.
5. Run `verify-diagram.mjs`, `verify-type.mjs --type=<id>` and `check-visible-text.mjs` on the file. Repair findings using `failure-codes.md`; two failed rounds on one defect end in a report.
6. Export (`export.mjs`) when the checks are clean and a PNG or Office SVG was requested. Open the result at its use size.
7. Write `checklist.md`, append the ledger lines, and reply in the shape below.

## Import

1. Run the importer that matches the source (`import-drawio.mjs`, `import-mermaid.mjs` or `import-excalidraw.mjs`) and save its JSON as `import-model.json` beside the evidence. A multi-block or multi-page source needs the user's choice of block or page first; take the recommended default when headless and record it as a `decision`.
2. Read the model against the source. List dropped, merged and unsupported items in `fidelity.md`.
3. Continue with Create from step 3 using the model as the fact source. Source coordinates, fills, fonts and styles stay behind.
4. The reply names what was dropped. A relationship the brief needs and the importer could not read becomes a question for the user.

## Verify only

1. Run `verify-diagram.mjs`, `verify-type.mjs` and `check-visible-text.mjs` against the file as given. Edit nothing unless the user authorized edits.
2. Open the rendered file in a browser-capable path when one exists, or report visual acceptance UNVERIFIED.
3. Report findings first, grouped by block, advisory and unverified, each with the file and the code. Offer the repair; applying it is a separate step.

## Export only

1. Confirm the source passes `verify-diagram.mjs` and `verify-type.mjs`. A failing source is reported back and stays unexported.
2. `node "<skill-dir>/scripts/diagram-runtime.mjs" status --json`. On `ready: false`, follow the headless rules in `SKILL.md` (install once when allowed, otherwise `BLOCKED:` with the pre-warm command).
3. `export.mjs` with the requested scale or `--all-scales`, plus `--office-safe` when asked. Report real paths and byte sizes.
4. Inspect each file. Report source validation, export success and image inspection separately.

## checklist.md layout

```text
# <slug> checklist
- source verifies: PASS | FAIL | BLOCKED (verify-diagram, verify-type, check-visible-text)
- inventory matches nodes and edges: PASS | FAIL
- boundary lists match geometry: PASS | FAIL | not applicable
- export written: PASS | FAIL | BLOCKED | not requested (paths and bytes)
- image inspected at use size: PASS | FAIL | UNVERIFIED (width inspected)
- Korean glyphs real: PASS | FAIL | not applicable
- both themes inspected: PASS | FAIL | not requested
- Office render proof: PASS | UNVERIFIED | not requested
- advisories kept and why: <list>
```

## Ledger lines

One line per artifact in `.litgravity/ledger/<conversation-id>.jsonl`:

```json
{"ts":"2026-10-20T09:14:00Z","kind":"evidence","text":"verify-diagram clean for docs/diagrams/billing-flow/billing-flow.html","path":".litgravity/evidence/billing-flow/verify-diagram.txt"}
{"ts":"2026-10-20T09:20:00Z","kind":"decision","text":"headless: kept type=flowchart as the recommended default","path":""}
```

When a goal record exists, the criterion that depends on the diagram points at the checklist and the verifier outputs.

## Reply shape

Lead with the verdict (PASS, FAIL or BLOCKED). Then the editable source path and the exports, the type id, variant and canvas, material simplifications, and any risk such as a font fallback or an UNVERIFIED render. Keep logs, inventory and previews in the evidence folder and say where they are. A blocked first-use install quotes the error line and the pre-warm command `npx @litfamily/litgravity runtime install diagram`.

## Reviewer child

For a diagram with more than about 12 nodes, ask a read-only reviewer to compare the preview with the inventory: `invoke_subagent` with `TypeName` `quality-reviewer`, a prompt that names the preview PNG, `inventory.md` and the question "which inventory items are missing or mislabeled in the image". The child replies by message. Its findings are data for you to verify, and the verdict stays with the parent conversation.
