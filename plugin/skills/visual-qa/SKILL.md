---
name: visual-qa
description: "Checking a built interface in a real browser at several widths. Moved to wjgoarxiv-skills (design plugin): this stub loads the installed copy, or gives the agy install line."
---

# visual-qa: moved to wjgoarxiv-skills

visual-qa checked a built interface the way a user sees it: its states at several widths in a real browser, screenshots, and visible breakage reported with that evidence or a named blocker. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/design/skills/visual-qa/`, so a LitGravity install stays small and anyone who wants a visual check installs this one plugin.

This file keeps the id. `lit visual-qa …`, `/litgravity:visual-qa`, review-work lane 5 and a litwork surface check that reach a user interface still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/design
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/design`. The design plugin also brings frontend-ui-ux, the builder this check accepts work from. Start a new conversation, or type `/skills reload`; the skill then answers as `/design:visual-qa`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/design/skills/visual-qa/SKILL.md`, then `.agents/plugins/design/skills/visual-qa/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what visual-qa did, that it moved to the design plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not describe the page from its source and call that a visual check.
4. **Not found, inside a workflow.** Inside review-work or litwork, record `visual-qa not installed` in the lane and give no visual verdict: the surface stays unchecked, not passed.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a visual check exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
