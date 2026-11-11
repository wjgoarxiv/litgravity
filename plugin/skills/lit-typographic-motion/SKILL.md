---
name: lit-typographic-motion
description: "Short films, kinetic type, lyric videos and seamless README cover loops. Moved to wjgoarxiv-skills (video-covers plugin): this stub loads the installed copy, or gives the agy install line."
---

# lit-typographic-motion: moved to wjgoarxiv-skills

lit-typographic-motion made finished short films and silent README cover loops: a treatment, a storyboard round, a render through its own engine, an original score and a QA gate. It no longer ships inside LitGravity. The whole skill folder now lives in the separate wjgoarxiv-skills repository at `plugins/video-covers/skills/lit-typographic-motion/`, so a LitGravity install stays small and anyone who wants a film installs this one plugin.

This file keeps the id. `lit motion …`, `lit film …`, `lit video …`, `lit 영상 …`, a `lit` prompt that asks for a lyric video, title sequence or kinetic type, and `/litgravity:lit-typographic-motion` still land here, and the steps below take it from there.

## Install it in agy

wjgoarxiv-skills is not published yet, so install it from a local clone:

```bash
agy plugin install <path to your wjgoarxiv-skills clone>/plugins/video-covers
```

agy converts the plugin while installing it and copies it to `~/.gemini/config/plugins/video-covers`. The video-covers plugin also brings readme-studio, which places a motion cover in a README. Start a new conversation, or type `/skills reload`; the skill then answers as `/video-covers:lit-typographic-motion`, and `lit` prompts that reach this stub hand over to it.

## When this stub is read

1. Look for the installed copy with `read_file`: first `~/.gemini/config/plugins/video-covers/skills/lit-typographic-motion/SKILL.md`, then `.agents/plugins/video-covers/skills/lit-typographic-motion/SKILL.md` in the workspace.
2. **Found.** Read it and follow it for this task; its folder is the root for every relative path it names. That copy was written for another agent host, so map its tools onto agy's: its question tool is `ask_question`, its shell tool is `run_command`, file reads and writes are `read_file` and `write_file`, and loading another skill by name means reading that skill's SKILL.md. A check it says a hook of that host runs for you does not run here; run the command yourself.
3. **Not found, asked directly.** Reply in a few lines: what lit-typographic-motion did, that it moved to the video-covers plugin of wjgoarxiv-skills, the install line above, and that you made nothing yet. Do not make the film another way in its place (an ffmpeg slideshow, a CSS animation recorded by hand).
4. **Not found, inside a workflow.** Inside a lit workflow (lit-loop, litwork, start-work, review-work) that reached this skill, write `lit-typographic-motion not installed` once in the ledger and the reply with the install line, finish the parts that need no film, and mark the part that needs it BLOCKED, not done.

LitGravity no longer holds a motion turn open until a render passes: that check left with the engine. When the installed copy says a hook checks its done list, run its own gate command and read the result yourself. Its engine installs with `node <plugin folder>/skills/lit-typographic-motion/scripts/motion-runtime.mjs install`.

## Hard stops

- Give the install line with the placeholder; never a path from this machine.
- Never say a film exists unless the installed copy made it and you looked at the result.
- A headless run (`agy -p`) cannot install plugins: give the install line and stop.
