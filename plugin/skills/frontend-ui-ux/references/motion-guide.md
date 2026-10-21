# Motion guide for frontend work

Use this guide with the active Design Contract and `references/interaction-motion.md`. Motion decisions attach to named components and states, and they carry no implementation scope of their own. Start with the target page, the components and the exclusions. Specify the stack, visual tokens, layers, timing, viewport behavior, reduced-motion path, assets and performance limits before implementation, and name exact files or components so the work stays inside its brief.

Every value below is a starting default. A page stays calm when motion explains hierarchy, state or cause and effect, and goes still where it explains nothing. The contract's `motion.policy` (`none`, `functional` or `expressive`) comes first, and the `taste.motion` dial (`references/taste-direction.md`) sets how much meaning animation carries within that policy.

## 1. Stack, tokens and composition

**Do.** Name the framework, styling system, animation package, icon set and their tested version pins. Define colors, spacing, font family, numeric weights and breakpoints as reusable tokens. Use a distinct mobile navigation component when the desktop layout stops fitting. Assign a short z-index map before adding overlays.

**Avoid.** A brief that asks for a "modern animated site" while leaving the stack, scope and interaction unstated. Open-ended package versions when the work leans on an animation API.

```text
Stack: [framework + pinned version], [styling + pinned version], [motion + pinned version].
Scope: [named components only].
Layers: background 0; page content 10; navigation 30; modal 50.
Breakpoints: mobile [value], medium [value], wide [value].
```

**Do.** Give fluid display type a `clamp()` range, a numeric weight and a tight but readable line-height. State how fonts load and name a system fallback. Pair a large heading with a restrained content width. Set colors with tokens; use `rgba()` where alpha matters on a translucent surface; pick a tinted near-black base when the design calls for a dark canvas. A blend mode may shape a heading or a light treatment once its contrast is checked against the final background.

**Avoid.** "Large", "glass" and "dark" as the whole specification. A blur, gradient or blend mode added without deciding which layer it affects and how the text stays legible.

**Do.** Keep reusable visual primitives in one place and refer to them by name. Let a background gradient end at the page's base color so a scroll reveals no hard seam. State spacing at mobile, medium and wide breakpoints in one vocabulary, for example `16 / 24 / 32 px` in the order mobile, medium, wide.

**Avoid.** Slightly different blur or spacing values duplicated across components, and a fixed media layer that covers focus rings and text.

## 2. Timing and viewport choreography

Name the curves so a later editor can change the motion family in one place:

| Name | Curve | Default duration | Use |
|---|---|---:|---|
| `enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | 420 ms | A short entrance that settles cleanly |
| `ui` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | 180 ms | Hover, focus and state feedback |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | 160 ms | Dismissal or removal |

These three are the CF-501 tokens. Press feedback (CF-502) scales to 0.95 to 0.96 inside 150 ms, repeated controls (CF-506) stay at 150 ms or less, and exits (CF-504) run shorter than the matching entrance.

**Do.** Pair every duration with one named curve. Keep ordinary controls under 400 ms. Give an entrance and an exit different intent. Keep hover feedback shorter than the compositional reveal.

**Avoid.** A duration paired with the browser's unspecified default curve, and an elastic bounce on routine navigation (CF-505 flags `bounce`, `elastic`, `wobble`, `jiggle`, `spring` and any cubic-bezier control point outside −0.1 to 1.1).

**Do.** Trigger a reveal when at least 15 % of its section enters view, with a bottom root margin of 10 %. Trigger once per section, and make the content visible when observation is unavailable. For a scroll-linked effect, define a progress interval and its output range, then use one dominant movement in the hero.

**Avoid.** Continuous animation on every section, several parallax layers competing, and content hidden until an observer fires.

**Do.** Stagger a small group by 60 ms per item and cap the sequence at 300 ms. Express it as a base delay plus `itemIndex × 60 ms`, so every item's timing can be inspected. Keep each group short enough that the first item is still relevant when the last one appears. A menu may use a separate overlay with a brief item sequence.

**Avoid.** A large fixed pause between items, a long article staggered line by line, and any delay that keeps the page unreadable.

## 3. Motion and resource budgets

**Do.** Give each section one entrance sequence and at most two simultaneously moving elements. Give the hero one principal scroll or entrance effect and one animated headline. Keep controls responsive while decorative motion runs.

**Avoid.** Animating the headline, background, cards, icons and navigation together. Any motion whose removal leaves comprehension and feedback unchanged is a candidate for deletion.

**Do.** Animate `transform` and `opacity` for routine movement (CF-508 flags width, height, padding, margin and offsets). Target a frame callback under 4 ms so the page keeps room for layout, paint and input work inside a 60 Hz frame, and check for dropped frames on a mid-range device. Add `will-change` only for `transform`, `opacity` or `filter`, and only while the animation runs (CF-507).

**Avoid.** `top`, `left`, `width` or `height` animated on every frame, and a desktop GPU treated as a stand-in for a phone.

**Do.** Keep the first view inside a stated transfer budget. As a default, limit initial motion media to 1 MB compressed and a video poster to 150 KB. Lazy-load below-the-fold media, size images for their rendered slot, and split optional motion code from the initial route.

**Avoid.** A large background video fetched before the user sees the page, several full-resolution images for a small card, and a CDN offered as the performance plan.

**Do.** Provide a real poster frame for every background video. On small screens, or when the browser signals data saving, use the poster or a still image and skip the video download and autoplay. Keep the same message and contrast in the fallback.

**Avoid.** A video that carries information nowhere else, and a large media request on a metered connection.

**Do.** Treat a sticky background video as its own positioned layer with a separately sized overlay, and state the overlay's coverage, such as the lower 40 % of the frame. Group its playback requirements: autoplay where allowed, muted, looping, inline. Point to an approved project asset by its existing name. When none exists, ask for a real asset or specify a designed still.

**Avoid.** A fake URL left in the brief, a media source buried in an arbitrary CSS background, and a video layer that intercepts text selection and focus.

## 4. Accessibility and input modes

**Do.** Honor `prefers-reduced-motion`. Show the final content state immediately, remove parallax and tilt, and reduce nonessential transitions. Keep focus movement, visible focus, keyboard operation and meaningful image text independent of animation. RS-003 measures this at 390 px: no motion-property transition or animation over 250 ms per iteration, videos paused.

**Avoid.** Motion as the only way to reveal a label, indicate success or make a control reachable.

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

**Do.** Restrict pointer tilt to fine-pointer devices. Clamp rotation to ±4 degrees, reset on pointer exit, and leave touch input alone. Compose the tilt with other transforms and keep every transform in the composition.

**Avoid.** Device-orientation requests, content that needs a hover to appear, and a pointer effect that moves text away from its focus target.

Cursor tracking gets its own interaction scope and budget. For a 3D scene or carousel, name the component and the supported input before specifying its movement, and check it under a separate frame and device budget since it can cost more than a small CSS transition.

## 5. One headline and a deliberate pace

**Do.** Choose one headline for a restrained reveal. Keep its full text in the accessibility tree and readable before an animation library loads. Give the rest of the page stable text and a clear reading order.

**Avoid.** Animating every character, repeating the same reveal on every section title, and splitting a short heading into a long sequence.

**Do.** Let the page open with its primary point, settle while the reader scans, use one reveal for a meaningful section change, then let the call to action rest. Test the complete path with motion enabled, with reduced motion, and with media unavailable.

**Avoid.** A continuous moving background behind dense copy, a final action that competes with a transition, and a repeated animation used to fill an empty section.

## 6. Interaction details and implementation order

**Do.** Specify hover, focus, pressed, disabled and open states independently. Give icon swaps their own rotation angle and short duration. Keep a mobile menu's overlay opacity and blur distinct from the desktop navigation. Size proof cards and other evidence blocks for the amount of text they carry, for example an 18 to 22 rem width range with height following content.

**Avoid.** A hover state standing in for keyboard feedback, and the same opacity and blur values reused on every surface.

**Do.** Organize labeled sections in dependency order: stack and tokens, page structure, media and fallbacks, navigation, content, interactions, dependencies, then build configuration. State responsive spacing and padding at mobile, medium and wide sizes together. Treat an early render as a draft, and refine it against the scope and device targets.

**Avoid.** Letting the visual scroll order dictate dependency order, adding unrelated sections, and leaving library versions open after the design leans on a particular API.

## 7. Writing a motion brief

A motion brief for one component fits on a card. Fill each line with a value, and the reviewer can accept or reject from the card alone:

| Line | Example |
|---|---|
| Component and state | `component:toast`, entering on `state:save.success` |
| Trigger | A resolved save request |
| Property and range | `transform: translateY(8px) → 0`, `opacity 0 → 1` |
| Token | `enter` (420 ms), exit uses `exit` (160 ms) |
| Reduced-motion result | Opacity only, 0.01 ms |
| Budget | One moving element; no layout property |
| Evidence | Probe row `390-reduced-motion` shows no motion-property transition over 250 ms; a slow replay (CF-510) shows no overshoot |

Put the same facts into the contract's `motion.transitions` entries (`id`, `interaction_id`, `duration_ms`, `easing`), and keep `motion.reduced_motion_behavior` as one sentence a tester can check.

## 8. Testing motion

1. Replay each entrance and each piece of feedback at quarter speed once (CF-510) and watch for overshoot, scale from zero and layout jumps.
2. Toggle reduced motion in the browser rendering panel (or through the probe's reduced-motion row) and operate every control.
3. Throttle CPU 4x and replay the hero. A dropped frame there is a finding to record with the profile used.
4. Disable media and scripts one at a time. The page keeps its message and reading order with the animation layer missing.
5. Save before and after captures for the states you changed: the state before the trigger, the settled state, an interrupted mid-flight state, and the reduced-motion version. `visual-qa` consumes these for acceptance.

## Review checklist

- Are the stack, scope, breakpoints, font loading, tokens and layer order explicit?
- Does each motion have a named curve, duration, trigger and reduced-motion result?
- Does each section stay within its motion budget, with one dominant hero effect?
- Are the media poster, mobile and data-saving fallback, lazy loading and transfer budget specified?
- Are focus, keyboard use, contrast and non-animated content complete?
- Are package versions pinned, and does the page stay readable when motion or media is unavailable?

## README before and after slot

Add examples after the README motion runs exist. Store each case at `examples/phase-3-readme-ab/<case>/` inside this skill with `before.md`, `after.md`, `before.png` and `after.png`. The Markdown files hold the README excerpts; the PNGs show the matching rendered states and viewport size. The slot's own `README.md` states the case-notes rule.
