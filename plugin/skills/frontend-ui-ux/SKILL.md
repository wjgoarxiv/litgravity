---
name: frontend-ui-ux
description: "Building or restyling a user interface. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# frontend-ui-ux: moved to wjgoarxiv-skills

frontend-ui-ux built and restyled interfaces from one locked house style and design kit, checked in a browser across phone, tablet and desktop widths. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/frontend-ui-ux/`, a copy written for agy, so a LitGravity install stays small and anyone who wants an interface copies in this one folder.

This file keeps the id. `lit frontend …`, `lit ui …`, a `lit` prompt that asks to build a page, dashboard or landing page, and `/litgravity:frontend-ui-ux` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then copy the skill folder into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/frontend-ui-ux" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (visual-qa, the browser check that accepts a built interface) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/frontend-ui-ux`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:frontend-ui-ux`, the copy is `frontend-ui-ux`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/frontend-ui-ux/SKILL.md`, then `.agents/skills/frontend-ui-ux/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what frontend-ui-ux did, that it moved to wjgoarxiv-skills (`variants/litgravity/frontend-ui-ux/`), the install line above, and that you made nothing yet. Do not build the page another way in its place; plain code edits to an existing interface stay with lit-code or litwork.
4. **Not found, inside a workflow.** A lit workflow that edits an interface keeps going without it: make the edit through lit-code or litwork, say once that frontend-ui-ux is not installed, and claim no design review.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say an interface exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
