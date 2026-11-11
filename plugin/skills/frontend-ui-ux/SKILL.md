---
name: frontend-ui-ux
description: "Building or restyling a user interface. Moved to wjgoarxiv-skills (design plugin): this stub loads the installed copy, or gives the agy install line."
---

# frontend-ui-ux: moved to wjgoarxiv-skills

frontend-ui-ux built and restyled interfaces from one locked house style and design kit, checked in a browser across phone, tablet and desktop widths. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/design/skills/frontend-ui-ux/`, so a LitGravity install stays small and anyone who wants an interface installs this one plugin.

This file keeps the id. `lit frontend …`, `lit ui …`, a `lit` prompt that asks to build a page, dashboard or landing page, and `/litgravity:frontend-ui-ux` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/design
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/design`. The design plugin also brings visual-qa, the browser check that accepts a built interface. Start a new conversation, or type `/skills reload`; the skill then answers as `/design:frontend-ui-ux`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/design/skills/frontend-ui-ux/SKILL.md`, then `.agents/plugins/design/skills/frontend-ui-ux/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what frontend-ui-ux did, that it moved to the design plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not build the page another way in its place; plain code edits to an existing interface stay with lit-code or litwork.
4. **Not found, inside a workflow.** A lit workflow that edits an interface keeps going without it: make the edit through lit-code or litwork, say once that frontend-ui-ux is not installed, and claim no design review.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say an interface exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
