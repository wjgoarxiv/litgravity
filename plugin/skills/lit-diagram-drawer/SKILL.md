---
name: lit-diagram-drawer
description: "Architecture, workflow, data-model and timeline diagrams. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-diagram-drawer: moved to wjgoarxiv-skills

lit-diagram-drawer drew architecture, workflow, data-model and timeline diagrams as editable SVG, checked and exported to PNG. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-diagram-drawer/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a diagram copies in this one folder.

This file keeps the id. `lit diagram …`, `lit 다이어그램 …`, `lit 도식 …`, and `/litgravity:lit-diagram-drawer` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so copy the skill folder from a local clone into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-diagram-drawer" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-diagram-drawer" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (lit-schematic and lit-scientific-visualization) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-diagram-drawer`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-diagram-drawer`, the copy is `lit-diagram-drawer`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-diagram-drawer/SKILL.md`, then `.agents/skills/lit-diagram-drawer/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-diagram-drawer did, that it moved to wjgoarxiv-skills (`variants/litgravity/lit-diagram-drawer/`), the install line above, and that you made nothing yet. Do not draw the diagram another way in its place (a hand-written SVG, Mermaid, ASCII art).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-diagram-drawer not installed` once in the ledger and the reply with the install line, finish the parts that need no diagram, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a diagram exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
