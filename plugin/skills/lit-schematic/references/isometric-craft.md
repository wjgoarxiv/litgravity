# Isometric and cutaway craft

An isometric illustration explains equipment by showing it as the real, well-made object: a reader recognises a shell-and-tube exchanger, a stirred autoclave or a packed column at a glance and then finds the part the text is about. The rules below are what separates such a figure from a 3D-looking diagram; each one comes from a fault that makes a figure read as fake.

## Contents
1. What a good figure has
2. Size it, then write the parts list
3. Camera and composition
4. Solids, tones and light
5. Painter's order
6. Window cutaways
7. Turned parts, flanges, nozzles and pipes
8. Detail that belongs to parts
9. Callouts
10. Groups for pages and films
11. Anti-patterns

## 1. What a good figure has

1. **A real object.** Model the actual equipment from its real proportions (shell diameter to length, nozzle sizes, flange thickness). Take mood and finish from references; never trace one.
2. **Many small, precise parts.** A single-machine figure has 40–80 parts; a dense one 80–150. Density comes from structure (saddles, flanges, bolts, nozzles, brackets, baffles), never from texture.
3. **Volume.** Every part has thickness, shaded faces and a lighter top; a soft halo sits under the base.
4. **Material colour.** Thin outlines (0.2 mm) over the full-colour material palette, the default of `createIsoView`: every part wears the finish it really has (painted steel, stainless, copper tubes, brass fittings, cast iron, concrete, glass, insulation cladding), so the reader tells parts apart by what they are made of. Signal red (`tone: "accent"`) marks the one part the text is about when its own material would not stand out. The grey palette (`createIsoView({ palette: "grey" })`) is opt-in, for a request that asks for a quiet, monochrome or print-grey figure.
5. **Truth.** Dimensions and counts that the caption states are the ones drawn (12 tubes, 4 baffles, 26 mm ID).

## 2. Size it, then write the parts list

Name the size before drawing: **Figure** (one machine, 40–80 parts) or **Hero** (a machine with its piping and skid, 80–150). A whole plant in 3D is a package: propose one unit.

Write the parts list in the build script header before any geometry, grouped:

- **Ground**: pad or skid (`box`, `layer: -1`), halo, feet.
- **Structure**: saddles, legs, skirt, frame, brackets, stand and clamp.
- **Body**: shell, heads, channel, bonnet, flanges.
- **Internals** (inside a cutaway): tubes, baffles, tubesheets, impeller and shaft, coil, packing, liquid, frits, wool plugs.
- **Connections**: nozzles with flanges and bolt circles, pipes with bends, valves, fittings.
- **Instruments**: gauges, thermowells, transmitters, cable glands.

Every part sits on another part: a nozzle on the shell, a flange on the nozzle, bolts on the flange, the shell on saddles, saddles on the pad.

## 3. Camera and composition

- `createIsoView({ azimuth, elevation })`: azimuth 45° shows two faces equally; turn it (30–65°) so the face that carries the mechanism, or the long side of a horizontal vessel, faces the viewer (the exchanger example uses 62°). Elevation 25–30° for most equipment; 35–45° to look into an open vessel or down onto a skid.
- World units are the object's millimetres: x and y on the floor, z up. Build everything at its real position and let `fit` scale it into the panel.
- The art fills most of its panel; callouts take side columns only as wide as their longest label, and `fit` chooses the sides that leave the art largest.
- A set of figures keeps one azimuth, elevation and scale so parts compare.

## 4. Solids, tones and light

- **Solids, never wireframes.** Every part is filled, so what is in front hides what is behind. No dashed hidden edges, no see-through boxes.
- **One fixed light** from the upper left in front; faces turned toward it are lighter. Flat parts (`box`, `prism`) shade each side face by its facing and lighten the top; turned parts (`lathe`) shade continuously around their axis, so a cylinder or head never steps in tone.
- **Tones are materials.** Name each part's finish: `steel` (painted carbon steel), `stainless`, `frame` (painted structural steel), `copper`, `brass`, `cast` (cast iron, motors, dark machinery), `concrete`, `insulation` (aluminium cladding), `rubber` (gaskets, hoses), `glass`. The generic roles still work and follow the palette: ground `lo` (concrete), structure and heads `mid` (painted steel), the body `hi` (stainless), the subject `accent`, the inside of a cut vessel `cavity`, cut wall faces `section`, a liquid `liquid`, a granular solid `warm`, a soft plug `cool`. A figure usually shows four to six materials; a single grey body with one accent is the opt-in quiet look, not the default.
- **Halo.** `halo({ plan, z })` under the base grounds the object.

## 5. Painter's order

Items are painted far to near by the depth of their centre, after their layer: halo (−2), ground (−1), everything else (0). Two rules fix almost every ordering fault:

1. **Ground first.** A large pad has its centre far behind the parts that stand on its front; give it `layer: -1`.
2. **Split anything that wraps or interleaves.** Tubes that pass through baffles are split at every baffle into segments, each its own item; a pipe is drawn as chunks that sort separately; a long body cut by a ring is two bodies and the ring. An item that is both in front of and behind another cannot be ordered by any key.

When something behind shows through something in front, the item in front is painted too early: lower the far item's `bias`, raise the near one's, or split one of them.

## 6. Window cutaways

`lathe({ cut: { from, to, span }, wall })` removes a window from the side facing the viewer between `s = from` and `s = to`, `span` degrees wide. Through it the reader sees the inner wall (`cavity` tones), the internals passed with `into: shell`, and the cut wall faces (`section` tone) along both edges and on the window sill. Everything outside the window stays closed and hides what is behind it.

- Keep the rims closed: start the window a little after a flange or head and end it before the next.
- **Never put a nozzle, bracket or gauge on shell the window removes.** With a wide span the window reaches the top and bottom of the shell; move the nozzle along the axis past the window, or narrow the span (80–100°).
- Internals sit fully inside the inner radius (`R - wall`), so nothing pokes through the wall.
- A liquid is a lathe of `liquid` tone up to its level, inside the vessel; an interface is a seam ring.

## 7. Turned parts, flanges, nozzles and pipes

- **Think in half-sections.** A turned part is its profile `[[s, r], …]` along an axis: a flat cap is a jump in `r` at one `s`; a head is `ellipsoidalHead(R)` with smooth knots. One lathe is one convex body; a flange is its own lathe (a disc), a nozzle its own lathe, so each sorts by its own depth.
- **Flanges sit flush.** A flange's back face lands on the end of its nozzle or pipe; two flanges meet face to face at a joint; add a `boltCircle` on the face that points at the viewer.
- **Nozzles leave along the surface normal**: radially from a shell (`axis: "z"` for a top nozzle), axially from a head.
- **Pipes bend; they do not kink.** `pipe({ points, r })` fillets every corner with a bend of about 2.6 r. Start on the port's normal, follow the structure (parallel to the body, along racks), cross other pipes only on straights and clearly apart in depth, and end on a flange or fitting.
- **Few pipe sizes**, all distinguishable: main lines, feed lines, tubing for instruments.

## 8. Detail that belongs to parts

At 1× the figure reads as one machine; at 4× every region still has something true on it. Before finishing, render the close-up sweep (`render.mjs --sheet`) and look for bare faces, then add the real part that belongs there: bolts on every flange, a nameplate with rule lines, seams where a head meets the shell (`seams`), a drain plug, earthing lug, feet under a skid, a thermowell with its head. Never add decoration that belongs to no part. A texture (pellets, a weave) stops at a real edge or thins toward a limb; it never stops on a straight cut in mid-face.

## 9. Callouts

Words stay out of the art. `callout({ part, text })` puts each label in a column beside the art with a hairline leader that ends on a dot on the named part; labels are ordered so no two leaders cross or run within 1.4 mm of each other, and QA fails a leader whose dot is off its named part (`LEADER.LOOSE`), that crosses another (`LEADER.CROSSING`) or that crowds another or its dot (`LEADER.SPACING`). Two dots a few millimetres apart on the page (a baffle and the tube in front of it) crowd whatever the order: spread them before you build, on faces far enough apart. Choose the anchor on a face the viewer can see (`handle.anchor(f, sideDegrees)`): QA reads outlines, not visibility, so a dot on a hidden face passes the gate and fails the eye. One label per part, a noun phrase, sentence case, no full stop; numbers with units (`Column, 26 mm ID`). For a journal figure the caption names the parts in the same words.

## 10. Groups for pages and films

Give every part its assembly with `group` (shell, internals, drive, heads, supports) even for a static figure: it costs nothing, it is written as `data-group`, and it is what an interactive page hides and explodes and a motion loop moves. Write the cutaway as a scene function of the camera, the explode amount and a flow phase when the user may want a page or a film; `references/cutaway-outputs.md` has the pattern.

## 11. Anti-patterns

- Abstract stacks: floating slabs or boxes standing for units read as nothing; draw the real equipment.
- One big plain body: a shell with nothing on it is unfinished; add flanges, nozzles, supports, seams.
- Labels or leader balloons over the object.
- Colour that names no material: a hue on a part must be its real finish, a fluid, or the one accent; never paint parts in rainbow categories.
- A part sunk into another, or floating off it: every contact is flush or seated.
- A curved surface in visible tone steps: use `lathe`, never stacked boxes.
- A cutaway that shows internals the real equipment does not have, or hides the one the text is about.
