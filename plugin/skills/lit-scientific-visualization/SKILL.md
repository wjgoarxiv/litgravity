---
name: lit-scientific-visualization
description: "Publication-ready figures from measured data. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-scientific-visualization: moved to wjgoarxiv-skills

lit-scientific-visualization plotted publication-ready figures from measured data: chart form, units, colour-blind-safe colour, export and a visual check. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-scientific-visualization/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a figure copies in this one folder.

This file keeps the id. `lit figure …`, `lit plot …`, and `/litgravity:lit-scientific-visualization` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then copy the skill folder into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-scientific-visualization" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-scientific-visualization" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (lit-diagram-drawer and lit-schematic) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-scientific-visualization`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-scientific-visualization`, the copy is `lit-scientific-visualization`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-scientific-visualization/SKILL.md`, then `.agents/skills/lit-scientific-visualization/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-scientific-visualization did, that it moved to wjgoarxiv-skills (`variants/litgravity/lit-scientific-visualization/`), the install line above, and that you made nothing yet. Do not plot the figure another way in its place (an ad-hoc matplotlib script with no style or check).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-scientific-visualization not installed` once in the ledger and the reply with the install line, finish the parts that need no figure, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a figure exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
