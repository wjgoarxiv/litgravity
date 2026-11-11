---
name: lit-pptx
description: "Slide decks (.pptx). Moved to wjgoarxiv-skills (decks plugin): this stub loads the installed copy, or gives the agy install line."
---

# lit-pptx: moved to wjgoarxiv-skills

lit-pptx built finished PowerPoint decks: a design direction picked for the audience, Markdown slide source compiled with native charts, a mechanical gate and a look at every rendered page. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/decks/skills/lit-pptx/`, so a LitGravity install stays small and anyone who wants a deck installs this one plugin.

This file keeps the id. `lit deck …`, `lit slides …`, `lit pptx …`, a `lit` prompt that asks for a presentation, and `/litgravity:lit-pptx` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/decks
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/decks`. The decks plugin holds lit-pptx and the office helpers its scripts import. Start a new conversation, or type `/skills reload`; the skill then answers as `/decks:lit-pptx`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/decks/skills/lit-pptx/SKILL.md`, then `.agents/plugins/decks/skills/lit-pptx/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what lit-pptx did, that it moved to the decks plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not write the deck another way in its place (python-pptx, soffice, an HTML page called slides).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-pptx not installed` once in the ledger and the reply with the install line, finish the parts that need no deck, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a deck exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
