---
name: lit-typographic-motion
description: "Short films, kinetic type, lyric videos and seamless README cover loops. Moved to wjgoarxiv-skills: this stub loads the installed copy, or gives the agy install line."
---

# lit-typographic-motion: moved to wjgoarxiv-skills

lit-typographic-motion made finished short films and silent README cover loops: a treatment, a storyboard round, a render through its own engine, an original score and a QA gate. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `variants/litgravity/lit-typographic-motion/`, a copy written for agy, so a LitGravity install stays small and anyone who wants a film copies in this one folder.

This file keeps the id. `lit motion …`, `lit film …`, `lit video …`, `lit 영상 …`, a `lit` prompt that asks for a lyric video, title sequence or kinetic type, and `/litgravity:lit-typographic-motion` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so copy the skill folder from a local clone into agy's user skills, which every workspace sees:

```bash
mkdir -p ~/.gemini/config/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-typographic-motion" ~/.gemini/config/skills/
```

For one workspace only, run this in its root instead: `mkdir -p .agents/skills && cp -R "<path to your wjgoarxiv-skills clone>/variants/litgravity/lit-typographic-motion" .agents/skills/`.

The folder is the whole skill, with its own scripts, references and engine locks. Its neighbours (readme-studio, which places a motion cover in a README) install the same way, one folder each. Start a new conversation, or type `/skills reload`; the skill then answers as `/lit-typographic-motion`, and `lit` prompts that reach this stub hand over to it. To update it, delete the copied folder and copy it again. The LitGravity installer writes only its own plugin folder, so upgrading or removing LitGravity leaves the copy alone, and the names never clash: this stub is `litgravity:lit-typographic-motion`, the copy is `lit-typographic-motion`.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/skills/lit-typographic-motion/SKILL.md`, then `.agents/skills/lit-typographic-motion/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. It was written for agy and needs no LitGravity hook: every check it names is a command it tells you to run.
3. **Not found, asked directly.** Reply in a few lines: what lit-typographic-motion did, that it moved to wjgoarxiv-skills (`variants/litgravity/lit-typographic-motion/`), the install line above, and that you made nothing yet. Do not make the film another way in its place (an ffmpeg slideshow, a CSS animation recorded by hand).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-typographic-motion not installed` once in the ledger and the reply with the install line, finish the parts that need no film, and mark the part that needs it BLOCKED, not done.

LitGravity no longer holds a motion turn open until a render passes: that check left with the engine. The installed copy runs that check itself: `node <its folder>/scripts/motion.mjs done <output folder>` before it calls a film finished. Its engine installs with `node <its folder>/scripts/motion-runtime.mjs install`.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a film exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) never copies the skill in itself: give the install line and stop.
