# Motion for diagrams

Static output is the default. Motion is added when it clarifies origin, order or a meaningful state change. A diagram that loses no information without motion ships without it.

## Motion contract

Record these for every transition: trigger, property, duration, easing, interruption behavior and the reduced-motion result. Favor transform and opacity. Layout geometry stays still, and the final state is reachable without delay.

- Direct feedback: 100 to 150ms.
- Entry or exit: 200 to 300ms.
- Layout transition: 300 to 400ms.
- Stagger: 20 to 40ms, up to five items.
- At most two elements move at once.
- A user-controlled sequence offers replay, pause and keyboard operation.
- A looping autoplay that competes with reading is out.

Named curves when a curve is needed: enter `cubic-bezier(0.16, 1, 0.3, 1)`, UI `cubic-bezier(0.2, 0.8, 0.2, 1)`, exit `cubic-bezier(0.4, 0, 1, 1)`. Existence of these values is no reason to animate.

A viewport reveal triggers near 15% visibility with about a 10% bottom root margin, plays once, and leaves the final content visible when observation is unavailable.

## Reduced motion and exports

Under `prefers-reduced-motion: reduce`, show the complete final state at once. Travel, parallax, tilt, flashing and looping are removed. An instant state change or a brief opacity change is fine.

The initial HTML is complete without JavaScript. Print, screenshots, PNG exports and Office SVG exports capture the final static state, and every label, relationship and result is present without the animation.

## Proof

Run the motion verifier and test with reduced motion switched on. Check keyboard focus and control labels. Export at least one frame after fonts load and confirm that the export forces the static final state.
