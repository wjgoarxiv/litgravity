---
name: lit-docx
description: "Word documents (.docx) and DOCX/PDF to Markdown. A LitFamily extension in wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-docx: a LitFamily extension in wjgoarxiv-skills

lit-docx built finished Word documents (reports, proposals, manuals, memos, manuscripts) in a tonality chosen for the content, DOCX or PDF converted to Markdown, in-place edits and a gate with rendered pages. It no longer ships inside LitGravity. It is a LitFamily extension now, and the whole skill folder lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-docx/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a document copies in this one folder.

This file keeps the id. `lit docx …`, `lit lit-docx …`, and `/litgravity:lit-docx` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is public at https://github.com/wjgoarxiv/wjgoarxiv-skills. Clone it (`git clone https://github.com/wjgoarxiv/wjgoarxiv-skills`), then copy the skill folder into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-docx" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-docx" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-docx`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-docx`, the copy is `lit-docx`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-docx/SKILL.md`, then `.agents/skills/lit-docx/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-docx did, that it is a LitFamily extension now, kept in wjgoarxiv-skills (`variants/litgravity/lit-docx/`), the install line above, and that you made nothing yet. Do not produce the .docx another way in its place (python-docx, pandoc, soffice).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-docx not installed` once in the ledger and the reply with the install line, finish the parts that need no document, and mark the part that needs it BLOCKED, not done.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a document exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
