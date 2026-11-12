---
name: lit-schematic
description: "P&ID, PFD, equipment layout, apparatus figure and isometric cutaway drawings. A LitFamily extension in wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-schematic: a LitFamily extension in wjgoarxiv-skills

lit-schematic drew physical schematics of real hardware: P&IDs with ISA-5.1 tags, PFDs, equipment layouts, journal apparatus figures and isometric cutaways, as editable SVG with a QA gate and a 600 dpi render. It no longer ships inside LitGravity. It is a LitFamily extension now, and the whole skill folder lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-schematic/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a schematic copies in this one folder.

This file keeps the id. `lit schematic …`, `lit pid …`, `lit pfd …`, `lit cutaway …`, `lit` prompts with 공정도, 계장도, 모식도 or 장치도, and `/litgravity:lit-schematic` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then copy the skill folder into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-schematic" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-schematic" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (lit-diagram-drawer and lit-scientific-visualization) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-schematic`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-schematic`, the copy is `lit-schematic`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-schematic/SKILL.md`, then `.agents/skills/lit-schematic/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-schematic did, that it is a LitFamily extension now, kept in wjgoarxiv-skills (`variants/litgravity/lit-schematic/`), the install line above, and that you made nothing yet. Do not draw the schematic another way in its place (a hand-written SVG, a box-and-arrow diagram).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-schematic not installed` once in the ledger and the reply with the install line, finish the parts that need no schematic, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a schematic exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
