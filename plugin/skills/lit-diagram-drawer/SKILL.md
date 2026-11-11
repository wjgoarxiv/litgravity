---
name: lit-diagram-drawer
description: "Architecture, workflow, data-model and timeline diagrams. Moved to wjgoarxiv-skills (figures plugin): this stub loads the installed copy, or gives the agy install line."
---

# lit-diagram-drawer: moved to wjgoarxiv-skills

lit-diagram-drawer drew architecture, workflow, data-model and timeline diagrams as editable SVG, checked and exported to PNG. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/figures/skills/lit-diagram-drawer/`, so a LitGravity install stays small and anyone who wants a diagram installs this one plugin.

This file keeps the id. `lit diagram …`, `lit 다이어그램 …`, `lit 도식 …`, and `/litgravity:lit-diagram-drawer` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/figures
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/figures`. The figures plugin also brings lit-schematic and lit-scientific-visualization, because the three share helper files. Start a new conversation, or type `/skills reload`; the skill then answers as `/figures:lit-diagram-drawer`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/figures/skills/lit-diagram-drawer/SKILL.md`, then `.agents/plugins/figures/skills/lit-diagram-drawer/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what lit-diagram-drawer did, that it moved to the figures plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not draw the diagram another way in its place (a hand-written SVG, Mermaid, ASCII art).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-diagram-drawer not installed` once in the ledger and the reply with the install line, finish the parts that need no diagram, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a diagram exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
