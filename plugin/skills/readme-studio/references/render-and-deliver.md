# Local motion production

Pick the engine before the first render. Read the pinned package's CLI help and license, and confirm the Chrome and encoding prerequisites. Global installs and mid-task engine swaps after a failure are off the table. Dependencies and outputs live inside the authorized project. When the sandbox cannot launch Chrome, keep the source intact and report the exact boundary; an authorized outer process can then render that same source with the boundary recorded, and the sandbox itself stays as strict as before.

## Remotion

`templates/remotion-cover/` pins Remotion and its CLI at 4.0.526, with React and React DOM at 19.3.0. Prefer it whenever it fits the user's license situation. Its license carries eligibility conditions and is a separate document from this package's own license. Check https://www.remotion.dev/license against the actual use case before choosing it. With eligibility unknown, leave the choice pending and take the Apache-2.0 alternative as an explicit initial decision.

Copy the whole template into a new project directory and run `npm ci`. Put the inspected `background.png`, the title and subtitle SVG ink variants and the label variants under public/. Compose from the editable cover-source.json records. Run the project-local commands below, giving each a fresh output path:

```bash
npm run compositions
npm run render -- src/index.tsx CoverWideLight out/wide-light-v01.mp4
npm run still -- src/index.tsx CoverWideLight out/wide-light-v01.png --frame 90
```

The remaining composition ids are CoverWideDark, CoverMobileLight and CoverMobileDark. Every one runs at 60fps for 300 frames (5 seconds); mobile is 800x1000 and wide is 1600x800. Drive all motion from the frame number. The template exposes blur, grain and expressive treatment props, and you tune them while keeping the text sharp. Static grain and a deterministic eased cycle give flicker-free output. Read https://www.remotion.dev/docs/animating-properties for the frame-driven requirement.

## HyperFrames

`templates/hyperframes-cover/` pins the published `hyperframes@0.8.51` package (Apache-2.0, Node >=22). Copy it into a fresh workspace, run `npm ci`, then read the output of `./node_modules/.bin/hyperframes render --help`. Export HYPERFRAMES_NO_TELEMETRY=1 for task-local rendering. Keep the root composition timing and the data-no-timeline marker: this template uses finite CSS animations on purpose and has no GSAP timeline to find. Retain index.motion.json and test that timeline before rendering.

```bash
./node_modules/.bin/hyperframes check . --samples 60 --no-contrast --json
./node_modules/.bin/hyperframes render . -c index.html --fps 60 --workers 1 --output wide-light-v01.mp4
```

The positional argument is the project directory and `-c` names the composition. Run a single worker for this recipe, and inspect the bottom edge of decoded frames for clipping. Give each light/dark and wide/mobile variant its own project directory with exactly one root index.html, since several root compositions fail the native lint check. Configure the theme ink paths and dimensions before rendering. Each composition keeps its own dimensions, duration and matching sidecar. The HTML data attributes form the editable source and prove nothing about a produced movie. Primary package and source: https://registry.npmjs.org/hyperframes/0.8.51 and https://github.com/heygen-com/hyperframes . Use the pinned published CLI name and version only.

## Delivery and inspection

Frame zero shows recognizable type. A brief eased typographic movement follows, then a readable hold, then a return whose endpoints match the start. Inspect frames 0/150/299 along with playback, and check the full-height output, the dark/light ink pairing, the original pixel motif, contrast, crops and the loop seam. Confirm master dimensions, fps and duration with ffprobe. A missing movie or a failed encoder stays MOTION_RENDER_BLOCKED even when the tool printed a success-like message.

Produce posters and inline GIFs of at most 2.5 MiB. A sound starting encoder profile is 6fps, wide 560x280 or mobile 384x480, 64 colors, and 30 frames for five seconds. The lower preview fps is separate from the 60fps master. The example below uses local FFmpeg and refuses to overwrite existing outputs:

```bash
ffmpeg -n -i out/wide-light-v01.mp4 -filter_complex '[0:v]fps=6,scale=560:280:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer' out/wide-light-v01.gif
```

For an over-budget file, optimize and inspect readability once more. If it still exceeds the budget, record INLINE_PREVIEW_SIZE_BLOCKED and obtain an explicit delivery choice. A required animation that was skipped gets named in the report, so the set is never described as complete. The static fallback ships in every case, including when playback works.

Static posters are still frames taken from the layered composition. Each poster keeps the sharp foreground plane, the depth-staged background blur and the directional rim-light band visible. The picture holds still while depth and light both remain, and reduced-motion output keeps those effects too.

Record the actual tool version and license choice, the commands, exit statuses, dimensions, frame count, fps, byte sizes, source paths and inspection judgments. Test local picture selection at 320/390/1440px in both color schemes, reduced motion included. This evidence is local. GitHub, npm/CDN and their actual accessibility settings remain POST_PUBLICATION_UNVERIFIED, and remote publication lies outside this skill.
