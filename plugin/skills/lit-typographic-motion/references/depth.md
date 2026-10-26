# Depth: the 3D route

Read this when the treatment's subject is a `depth3d` device (`depth: "3d"`), or when a cover takes
the `hero-3d` recipe. A drawn 3D object is the right subject when the film is about a thing that has
a back and an inside: a product that turns, opens, unfolds or is assembled. A flat diagram, a chart or
type does not need it; keep those on the 2D page.

## What the renderer gives you

- **A pinned three.js.** The skill ships three.js r170 (npm `three@0.170.0`, MIT) in
  `engine/vendor/three/`: the unminified `three.module.js` plus two addons,
  `environments/RoomEnvironment.js` and `geometries/RoundedBoxGeometry.js`. The renderer serves them at
  `/lit/three/`; a page imports them through an import map:

  ```html
  <script type="importmap">{ "imports": { "three": "/lit/three/three.module.js", "three/addons/": "/lit/three/addons/" } }</script>
  <script type="module">
    import * as THREE from "three";
    import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
  </script>
  ```

  Any other path under `/lit/three/` is refused as a missing file, and the network rules still hold:
  never load three.js, a model or a texture from a CDN. The file hashes and the licence are in
  `engine/THIRD_PARTY_NOTICES`.
- **The GPU rung.** A `depth: 3d` film and a `hero-3d` cover start Chrome on the platform's GPU rung
  (ANGLE on Metal on macOS, GL on Linux, D3D11 on Windows), with GPU rasterization of the page
  itself still off. The renderer records the WebGL renderer string, and the gate's WebGL line names
  the rung and the renderer. The same determinism replay runs as on the software rung: a fresh
  browser on the same rung must reproduce the sampled frames pixel for pixel, or the render stops with
  exit 18. On an Apple M-series Mac the 3D test page and the `hero-3d` cover replayed identically.
- **A labelled fallback.** When the GPU rung cannot start, or starts without WebGL, the render
  reopens on the software rung (SwiftShader), adds a warning to the report and the manifest naming
  the reason, and records `rung: "software"`. The film still renders, more slowly. Say in the reply
  that it rendered without the GPU. Only when neither rung has WebGL is it exit 11.

The rung is chosen from the treatment (`depth`) or the cover recipe, never by the page.

## The scaffold's world

`motion.mjs scaffold` on a `depth: 3d` treatment adds, on top of the 2D shots:

- `<canvas id="world">` behind every shot's section, so the type stays DOM text the QA can read;
- one renderer for the whole film (alpha, `preserveDrawingBuffer`, pixel ratio 1, ACES tone mapping,
  soft shadows), a `RoomEnvironment` for reflections, a key light with a biased shadow, a hemisphere
  light in the style's colours and a shadow-only floor;
- `HERO`, a group that holds the protagonist from the first frame to the last;
- `aim(layout)`, which offsets the camera so the world origin lands on the centre of the shot's subject
  zone; a `hero` layout shot therefore fills the frame and a `split` shot keeps the object on its side;
- `WORLD[i](s, hero, cam, t)`, one function per shot that poses the hero, the camera and anything else
  as a function of the shot (`s.p`, `s.local`, `s.enter(...)`).

Build the protagonist once, in `HERO`, and only pose it per shot: that is what makes it the same
object across the film. For a named product, start from its real logo and screens: a fetched logo or
screenshot goes on a plane or a face of the object as a texture (`TextureLoader` on the file under
`stage/assets/`); a simple logo shape can be traced into a `THREE.Shape` and given depth with
`ExtrudeGeometry`.

## Craft and the gate

- **Turn slowly.** A full turn takes the loop (a cover) or a whole shot (a film). Fast spins, a flicker
  of specular highlights and shadow acne all read as flashes and fail MO-C-03.
- **Bias the shadow.** On a turning object set `shadow.bias` about -0.0004 and `shadow.normalBias`
  about 0.03; without them the self-shadow flickers frame to frame.
- **Ease every open and close.** A lid, a drawer or an exploded view eases in and out (`ease.smooth`),
  holds, and returns; the move is the beat, so it happens once, where the treatment's story puts it.
- **Keep the type in the DOM.** Copy stays in the shot's type zone as HTML text over the canvas;
  text drawn inside the 3D scene is invisible to the QA unless registered with `LitStage.text`.
- **Mind the dead air.** A small object on a large empty ground is `DEAD-AIR`; frame it with the
  `hero` layout or move the camera in.
- **Covers at 20 fps.** The cover gate measures on a 50 ms grid; at 25 fps a smooth turn lands two
  frames on one step at the seam (FLOOR), at 20 fps every step is one frame (TARGET). Encode at q94:
  smooth light surfaces blotch at the default q86.

## Camera moves and the flash audit

A rich film moves its camera in at least half its shots, and the flash audit stays exactly as it is.
When a move fails MO-C-03, keep the move and change what it passes over: slow the light change (a
highlight that sweeps over 0.5 s or more, not a frame), lower the contrast of the detail behind the
move, add motion blur (the Blender rung renders it; on the GPU rung average 4-8 sub-frame poses), or cut
instead of whipping. Removing the camera move is a downgrade.

## The Blender rung (`render3d: "blender"`)

For path-traced light (bevels that catch it, soft global illumination, depth of field, motion blur) a
3D film can render its world in Blender with Cycles. The page then shows the rendered plate and keeps
its type, labels and 2D layers in the DOM over it.

Take this rung when the request asks for high-quality, cinematic or photoreal 3D (고퀄리티, 고품질,
시네마틱, 실사, cinematic, photoreal, high-quality, Blender) and Blender is installed: `scaffold` prints
`BLENDER:` with the path when both hold. On an Apple M-series GPU a full hero scene rendered at 8-10 s
per 1080p frame at 160 samples, so a 13 s plate (390 frames) takes about an hour. Settle the scene on
the preview stills first, since a fix after the final means rendering the plate again, and build the
page's panels while it renders.

1. Set `depth: 3d`, a `depth3d` subject and `render3d: "blender"`.
2. Write `stage/scene.py`, a Blender Python scene. It runs inside the bundled runner with `bpy`,
   `math`, `Vector` and `lit` in scope; times are film seconds and the plate starts at frame 1:
   `lit.camera(location, target, lens, dof=(distance, fstop))`, `lit.area_light(name, location, target,
   power, size, color)`, `lit.world(color, strength)`, `lit.material(name, color, roughness, metallic,
   emission, strength)`, `lit.rounded_box(name, size, radius, segments, material, location)`,
   `lit.image_card(name, path, width, location)` (a fetched product image as a card) and
   `lit.key(obj, prop, t, value)`. The scene must set a camera. The command line sets size, samples,
   device, fps and frames; the scene sets everything else.
3. `motion.mjs blender --out <dir>` renders preview stills at the beat midpoints (50 %, 40 samples) into
   `stage/plate-preview/`. Open them, compare them with any reference frames the user gave, and fix
   `scene.py` before the final.
4. `motion.mjs blender --out <dir> --final` renders the plate (full size, 160 samples, motion blur,
   30 fps, `stage/plate/000001.png ...`) detached with a progress file; it can take most of an hour.
   It writes `plate.json`, which lists every frame by name and size with the Blender version, device and
   samples. Listed plate frames are not counted as page rasters; any other frame sequence is still a
   flipbook (exit 17).
5. On the page, `const show = LitStage.plate({ parent, count, fps: 30 })` returns `show(t)`; call it from
   `render(t)`. The page renders on the software rung, and the stage refuses to start (exit 17) when the
   plate is missing or does not cover the film.

Blender is found from `LITGRAVITY_BLENDER` (used only if it exists), the macOS app
(`/Applications/Blender.app/Contents/MacOS/Blender`) or `blender` on PATH, and runs as `blender -b
--factory-startup -P runner.py -- ...`, on Metal on Apple silicon, another GPU backend next, the CPU
last; the receipt says which. Without Blender the command renders nothing and prints `FALLBACK`: set
`render3d` to `three`, build the world in three.js on the GPU rung, and say so in the reply. The report
and manifest name the plate (Blender version, Cycles device, samples).
