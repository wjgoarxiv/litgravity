---
name: lit-schematic
description: "P&ID, PFD, equipment layout, apparatus figure and isometric cutaway drawings. Moved to wjgoarxiv-skills (figures plugin): this stub loads the installed copy, or gives the agy install line."
---

# lit-schematic: moved to wjgoarxiv-skills

lit-schematic drew physical schematics of real hardware: P&IDs with ISA-5.1 tags, PFDs, equipment layouts, journal apparatus figures and isometric cutaways, as editable SVG with a QA gate and a 600 dpi render. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/figures/skills/lit-schematic/`, so a LitGravity install stays small and anyone who wants a schematic installs this one plugin.

This file keeps the id. `lit schematic …`, `lit pid …`, `lit pfd …`, `lit cutaway …`, `lit` prompts with 공정도, 계장도, 모식도 or 장치도, and `/litgravity:lit-schematic` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/figures
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/figures`. The figures plugin also brings lit-diagram-drawer and lit-scientific-visualization, because the three share helper files. Start a new conversation, or type `/skills reload`; the skill then answers as `/figures:lit-schematic`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/figures/skills/lit-schematic/SKILL.md`, then `.agents/plugins/figures/skills/lit-schematic/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what lit-schematic did, that it moved to the figures plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not draw the schematic another way in its place (a hand-written SVG, a box-and-arrow diagram).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-schematic not installed` once in the ledger and the reply with the install line, finish the parts that need no schematic, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a schematic exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
