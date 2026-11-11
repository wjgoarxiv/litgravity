---
name: visual-qa
description: "Checking a built interface in a real browser at several widths. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# visual-qa: moved to wjgoarxiv-skills

visual-qa checked a built interface the way a user sees it: its states at several widths in a real browser, screenshots, and visible breakage reported with that evidence or a named blocker. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/visual-qa/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a visual check copies in this one folder.

This file keeps the id. `lit visual-qa …`, `/litgravity:visual-qa`, review-work lane 5 and a litwork surface check that reach a user interface still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so copy the skill folder from a local clone into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/visual-qa" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/visual-qa" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (frontend-ui-ux, the builder this check accepts work from) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/visual-qa`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:visual-qa`, the copy is `visual-qa`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/visual-qa/SKILL.md`, then `.agents/skills/visual-qa/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what visual-qa did, that it moved to wjgoarxiv-skills (`variants/litgravity/visual-qa/`), the install line above, and that you made nothing yet. Do not describe the page from its source and call that a visual check.
4. **Not found, inside a workflow.** Inside review-work or litwork, record `visual-qa not installed` in the lane and give no visual verdict: the surface stays unchecked, not passed.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a visual check exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
