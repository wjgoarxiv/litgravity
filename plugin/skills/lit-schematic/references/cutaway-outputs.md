# Cutaway outputs: static, interactive page, motion loop

An isometric cutaway can leave the skill in three forms. The **static** figure (SVG with PDF and 600 dpi PNG) is the default and the only form a paper, a report or a P&ID set takes. An **interactive page** (one HTML file) lets a reader take the machine apart, switch views and find a part by its name. A **motion loop** (MP4 with an animated WebP and GIF) shows something happening: an assembly coming together, coolant running through a coil, an impeller turning. All three come from one scene function, so they always show the same machine.

## Contents
1. Choosing the output
2. One scene, three outputs
3. The interactive page
4. Designing the explode
5. The motion loop
6. Checking each output
7. When a film needs more than a loop

## 1. Choosing the output

| The request says | Output |
| --- | --- |
| nothing about the medium, or "figure", "그림", "논문", "보고서", "slide", "PNG", "PDF" | static (default) |
| "HTML", "interactive", "web page", "웹", "인터랙티브", "explorable", "hover", "분해해서 볼 수 있게" | interactive page, plus the static figure |
| "animation", "motion", "video", "MP4", "GIF", "loop", "애니메이션", "모션", "영상", "동영상", "움직이는" | motion loop, plus the static figure |
| both kinds of words | both, plus the static figure |

A bare request keeps the static default and asks nothing. Ask **one short question** only when the user is present (an interactive session, not a headless run) and the request names a use that a moving or explorable output would serve without naming the form, for example "for our lab website" or "for the open-day screen": "A static figure, an interactive web page, or a short looping video?" Take the answer and do not ask again. In a headless run, choose from the words alone and say in the reply which form you made and that the others are available.

The static figure is always delivered with the others: it is the reference the page and the loop are checked against, and the form a journal or a print can use.

## 2. One scene, three outputs

Write the cutaway as `scene({ azimuth, elevation, explode, flow, callouts, reach })` returning `{ svg, view, warnings }`, following `examples/iso-heat-exchanger/scene.mjs`:

- **Groups.** Give every part the assembly it belongs to with `group`: the shell and its flanges, the internals, the drive, the front and rear heads, the supports. A group is what a reader can hide or pull out; parts that bolt together and move together share one.
- **Moves.** Keep the world move of each group that comes apart in one table (`MOVES`), the order they leave in (`ORDER`, outside parts first), and the layers a reader can hide (`LAYERS`). The scene shifts each group's origins by `MOVES[g] × explode[g]`, so a film frame is real geometry with a correct painter's order.
- **Extents.** With `reach: true` the scene calls `view.extent(points)` with where the moved groups end up, so every frame of a film and every state of a page share one scale and nothing leaves the frame.
- **Flow.** A `flow` phase in mm drives dashed stripes along pipes (`pipe({ flow })`) or along tube crowns (`polyline({ flow })`); give collinear pieces of one run the same offset and their own start.
- **Callouts** stay on for the figure and the page and go off for the film, where moving leaders would distract.

`build.mjs` writes the static figure from `scene()` and, with `--html`, the page from one `scene({ reach: true })` per preset view.

## 3. The interactive page

`renderInteractive` turns those views into one HTML file with no external file, font or script, so it opens offline, from a USB stick or from an email. It gives the reader:

- **Preset views** as buttons (keys `1` to `n`): two or three useful camera positions, such as the default front-left, a higher view into the cut, and the opposite side. Draw each with its own callouts; anchors that use `side` offsets relative to the facing angle stay on visible faces when the camera turns.
- **Exploded view** (button or `E`): each group slides by its screen vector, one after another in `ORDER`, and comes home in reverse; the leader dots ride with their parts. At zero the transform is removed, so the assembled page is exactly the static art.
- **Layers** as checkboxes: hiding the shell leaves the internals drawn inside it.
- **Callouts as controls**: each label is a focusable button; hover or focus lights its part's outline and its leader, `Enter` or `Space` toggles the selection, `Esc` clears it. Hovering a part lights its callout.
- **Access**: visible focus rings, `aria-pressed` on toggles, an `aria-live` line that says what changed ("Exploded view", "Hiding Shell"), and `prefers-reduced-motion` honoured by moving parts straight to their end positions.
- **State in the URL**: `#view=front-high&explode=1&hide=shell&select=C3` opens the page in that state, which is how screenshots for a report or a check are taken.

## 4. Designing the explode

Take the machine apart the way a fitter would. Outside parts leave first and come back last: a head comes off before the bundle slides out; a drive comes off before the cover lifts; a cover lifts before the internals rise. Move each group along a real path: along the axis it is bolted on, straight up for a lid, outward along a radius for side parts. Keep the moves short enough that the exploded machine still fits the page at a readable scale, usually less than the part's own length. Parts that join two assemblies belong to the one they stay with. A part nested inside another (a bundle inside its shell) can move on its own; the page and the film both treat it as its own group.

On the page the explode is a 2D slide of the static art, so painter's order is that of the assembled view: check the exploded state for a part that should now be in front and is drawn behind. The film rebuilds every frame from the scene, so its order is always right.

## 5. The motion loop

`node "$SKILL_ROOT"/scripts/motion.mjs scene.mjs --out <dir> --name <name>` draws `frame(t)` for 4 s at 24 fps by default (`--seconds`, `--fps`, `--width 1280`, `--small 720`) and writes `name.mp4` (H.264, yuv420p, faststart, plays in slides and browsers), `name.webp` and `name.gif` (720 px wide, for a README or a chat). Design the loop so its last frame leads into its first: start in the state you end in (both exploded, or both assembled), ease every move (smoothstep), and make a flow phase advance a whole number of dash periods over the loop. Keep it calm: one thing happening at a time, nothing faster than a reader can follow, no flashes. A 4–8 s loop of about 100–200 frames renders in one to three minutes; run it under `nice`.

The encoder needs ffmpeg (and img2webp for WebP). Nothing is installed: a missing tool stops the run with `ENCODER_REQUIRED` and the install line for the user; report the loop as `BLOCKED` for that format and deliver the others.

## 6. Checking each output

- **Static**: as for every drawing: `qa.mjs`, render, look (`references/verification.md`).
- **Page**: open it in a real browser (headless Chrome with the mock keychain flags, or a browser-automation session) and exercise it: focus the first callout and Tab to the next (the part outline lights), toggle the explode (groups move, then return to exactly the static art), hide a layer (nested groups stay), switch each view, and open it once with reduced motion forced (moves are immediate). Screenshot the states through the URL hash and read them. Confirm the page has no `http` reference other than the SVG namespace and no console errors.
- **Loop**: tile a dozen frames from the MP4 (`ffmpeg … -vf "select='not(mod(n\,12))',scale=640:-1,tile=4x3"`) and read the sheet: the start and end states match, parts move along their paths without passing through each other, nothing leaves the frame, flow stripes stay on their pipes. Check the MP4 stream is H.264 yuv420p at the frame count you asked for.

## 7. When a film needs more than a loop

A silent loop of the machine is this skill's job. A film with a treatment, titles, narration beats or a sound bed (an explainer for a launch, a conference opener) belongs to `lit-typographic-motion`: hand it the interactive page or the scene as the stage it captures, and let it own the treatment, timing, sound and its own QA. Keep the machine's geometry here; never redraw the equipment in the film skill.
