# Motion guide for text that sits next to frontend motion

lit-humanizer edits the words on a page. Pages with motion add a second layer of text: the brief that tells an implementer how things move. A templated brief ("a modern, sleek site with smooth animations") is the motion equivalent of templated prose, and it produces the same result: generic output that nobody chose. Use this guide when the user asks to rewrite or tighten a motion brief, a landing-page spec, or the copy of a page whose sections animate. The numbers are starting defaults; the brief's own constraints win.

## 1. Shape of a good brief

Open with one sentence that names the page, the components in scope and the areas left alone. Then write labelled sections in the order an implementer builds them:

1. Stack and pinned versions
2. Tokens: colour, spacing, type, breakpoints, layers
3. Page structure and the named components
4. Media and its fallbacks
5. Navigation
6. Content sections
7. Interactions and states
8. Dependencies and build configuration

Name real files or components (`HeroSection`, `PricingTable`, `site-header.tsx`) so the implementer extends what exists. A brief may list component families up front (hero, pricing, footer, dashboard) and then detail only the chosen one.

When you edit a brief, keep every concrete value the user gave: version pins, pixel and rem values, durations, curve names, asset names. Those are the brief's facts, and they get the same protection as numbers in a report.

## 2. Stack, tokens and layers

State the framework, styling system, animation library and icon set with tested versions. An animation API changes between majors, so an open version range makes the brief ambiguous.

```text
Stack: <framework>@<version>, <styling>@<version>, <motion library>@<version>
Scope: <named components>
Layers (z-index): background 0, content 10, navigation 30, overlay 50
Breakpoints: mobile <value>, medium <value>, wide <value>
Spacing (mobile / medium / wide): 16 / 24 / 32 px
```

Type: give display headings a `clamp()` range, a numeric weight and a line height that stays readable at the smallest size. Say how fonts load and which system font stands in until they do. Pair a large heading with a measured content width.

Colour: define tokens once and refer to them by name. Use `rgba()` or an alpha token where a translucent surface needs it. A dark canvas reads better on a tinted near-black than on pure black. A gradient that ends on the page's base colour hides the seam when the page scrolls. A blur or blend mode names the layer it affects and the contrast check it passed against the final background.

Keep one breakpoint vocabulary through the whole brief, and keep repeated values (blur radius, card padding) in the token list so components share them.

## 3. Timing

Name the curves so a later editor can retune the whole page in one place:

| Name | Curve | Default | Use |
|---|---|---:|---|
| `enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | 420 ms | An entrance that settles without overshoot |
| `ui` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 180 ms | Hover, focus, pressed and toggle feedback |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | 160 ms | Dismissal and removal |

Every duration in the brief comes with one of these names. Routine controls stay under 400 ms. Entrances and exits have different intent, so they get different curves. Hover feedback is shorter than any section reveal. Routine navigation uses `ui`; an elastic curve belongs to a playful moment the user asked for.

## 4. Viewport choreography

- Reveal a section when 15% of it is in view, with a 10% bottom root margin. Reveal once per section.
- If the observer is unavailable, the content is visible from the start. A reveal decorates content that is already readable.
- Stagger a small group at 60 ms per item, capped at 300 ms in total. Write it as `base + index × 60 ms` so every item's delay can be read off the brief.
- Scroll-linked effects state their progress interval and output range (for example, progress 0 to 0.4 maps `translateY` 0 to −40 px).
- The hero has one dominant movement. Other sections stay still while the reader is in them.
- A mobile menu has its own overlay timing and a short item sequence of its own.

## 5. Budgets

Motion budget per section: one entrance sequence and at most two elements moving at the same time. The hero gets one principal effect and one animated headline. Controls stay responsive while decoration runs. If removing a motion changes neither comprehension nor feedback, remove it.

Rendering budget: animate `transform` and `opacity`. Layout properties (`top`, `left`, `width`, `height`) per frame force layout work. Keep a frame callback under 4 ms so layout, paint and input fit in a 60 Hz frame, and test on a mid-range phone; a desktop GPU hides the cost.

Transfer budget for the first view: initial motion media at most 1 MB compressed, a video poster at most 150 KB. Lazy-load media below the fold, size images for the slot they fill, and split optional motion code out of the initial route. A CDN speeds delivery of what you send; the budget decides how much you send.

## 6. Video and media

- Every background video has a real poster frame.
- On small screens or when the browser signals data saving, show the poster or a designed still and skip the download and autoplay. The fallback carries the same message and contrast.
- A sticky background video is its own positioned layer with a separately sized overlay; state the overlay's coverage (for example, the lower 40% of the frame).
- Group the playback attributes in one place: autoplay where allowed, muted, loop, inline playback.
- Point at an existing asset by name. When none exists, ask for one or specify a designed still. A placeholder URL in a brief tends to ship.
- The video layer never sits above text or focus rings, and it passes pointer events through to the content.

## 7. Accessibility and input

Honour `prefers-reduced-motion`: show the final state at once, remove parallax and tilt, and shorten nonessential transitions.

```css
@media (prefers-reduced-motion: reduce) {
  .motion-enter,
  .motion-scroll,
  .motion-tilt {
    animation: none;
    transition-duration: 0.01ms;
    transform: none;
  }
}
```

Focus order, visible focus, keyboard operation and image text work the same with motion off. A label, a success state or a reachable control shows up without depending on an animation.

Pointer tilt runs on fine pointers only, clamps rotation to ±4°, resets when the pointer leaves, and composes with other transforms. Touch input keeps its default behaviour, and device orientation stays unrequested. Cursor-following effects get their own scope and budget. A 3D scene or carousel names its component and supported inputs first, then its movement, and gets its own frame and device budget.

## 8. Headline and pacing

Pick one headline for a restrained reveal. Its full text is in the accessibility tree and readable before the animation library loads. Split by words or lines; a short heading split into many characters turns a sentence into a wait.

Pacing for a whole page: the page opens on its main point, settles while the reader scans, uses one reveal at a meaningful section change, and lets the call to action rest. Dense copy sits on a still background. Test the full path three ways: motion on, reduced motion, media unavailable.

## 9. States and build order

Specify hover, focus, pressed, disabled and open states one by one; focus gets its own visible style alongside hover. Icon swaps have their own rotation and short duration. A mobile menu overlay has opacity and blur values distinct from the desktop navigation. Cards size to the text they carry (for example an 18–22 rem width range, height from content).

Write the brief in dependency order (section 1), state responsive spacing for all three sizes together, and treat the first render as a draft to check against scope and device targets.

## 10. Editing a motion brief with lit-humanizer

- Replace mood words with values: "smooth" becomes a curve name and a duration, "subtle" becomes a distance and an opacity range, "fast-loading" becomes a transfer budget.
- Cut the generic opener (`In today's digital landscape…`) and start with the scope sentence.
- Turn a `not just animations, an experience` line into what the motion does for the reader: which state it shows, which hierarchy it explains.
- Keep every pinned version, value and asset name byte for byte; they pass through like code.
- Run `scripts/detect.mjs` on the edited brief like any other prose.

## Review checklist

- Stack, scope, breakpoints, font loading, tokens and layer order are explicit.
- Each motion has a curve name, duration, trigger and reduced-motion result.
- Each section stays within its motion budget, and the hero has one dominant effect.
- Media has a poster, a small-screen and data-saving fallback, lazy loading and a transfer budget.
- Focus, keyboard use, contrast and text content are complete with motion off.
- Package versions are pinned, and the page reads correctly with motion or media unavailable.
