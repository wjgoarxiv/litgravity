# Parity proof and report

A port is proven by two observations: the capability fires on the surface a user touches, and the
new target behaves differently from the old one on the same prompt. Green tests and new files are
necessary and never sufficient.

## 1. Reachability

Drive the real entry point, then break the wiring and watch the probe fail.

| Target surface | Probe | Break it by |
| --- | --- | --- |
| Prompt route | Fire a `PreInvocation` payload and assert the skill is named in the injected steps | Removing the route entry |
| Skill discovery | A `lit <id>` prompt that loads the skill, with the injected text naming its path | Changing the description |
| Script or gate | Run the installed script on a fixture that should fail and one that should pass | Reverting the gate |
| Package payload | Pack the package and list the files | Removing the file from the allowlist |

A probe that cannot fail proves nothing; record the broken run beside the passing one.

## 2. An isolated baseline

The baseline is the target at the base revision, in a place where the new work cannot be read:

```text
git -C <target root> worktree add <lane folder>/parity-base <base_ref>
```

or the snapshot copied in Phase 0. The baseline folder has none of the new files, and the run
folder, spec and diff are outside any path the baseline session can reach.

## 3. Running both arms

Choose prompts the spec never used as examples. For an agy skill, run `agy -p` in a throwaway
workspace, loading the old and new plugin copies (project-scope `.agents/plugins/litgravity/`), with
any installed copy of the same plugin switched off. A headless `-p` run may deny `run_command` and
`write_file`; use `--mode accept-edits` or `--dangerously-skip-permissions` only inside the
throwaway workspace. Run each arm at least twice when output varies.

Save outputs under `parity/` and list them in `ledger.parity.baseline_outputs` and
`treatment_outputs`. The gate fails when a marker is missing from any treatment output or present in
a baseline output.

## 4. Visual outputs

When the target produces images, films or pages, put baseline and treatment side by side and show
the user. A geometry score is a geometry score; the user's eye judges quality.

## Parity gate

`hijack.mjs check --phase parity` requires per taken mechanism: `criterion`, `red`, `green`,
`surface` and `artifact`. It requires `parity.markers` (at least one), `baseline_outputs` and
`treatment_outputs` (at least one each). Every marker must appear in every treatment output and in no
baseline output.

## Report template

```markdown
# Report: <port title>

## Taken

M1 adapted: <where it now lives>. Parity: <result>.

## Left

M3 left: <reason>.

## Provenance

| Source | URL | Author | Date | Licence | Decision |
| --- | --- | --- | --- | --- | --- |
| S1 | <url> | <author> | <date> | NOASSERTION | ideas-only |

Exposure: the spec writer read the sources; the implementer worked from the spec only (or: shared
the context). The model may have met the material during training. The result is independently
re-expressed.

Credit: <attribution path, or none needed>.

Review by: <date three months out>.
```

The report gate requires the three headings (`## Taken`, `## Left`, `## Provenance`), a mention of
every mechanism id, every source's URL or path, and a credit notice for every `ideas-credit` source
used.
