# From a design request to a working screen

This reference sets how the skill decides between asking and building, and how a request becomes a screen. It covers output mode, the interview, retained answers, the default profile, and the checks that close a build.

## Choose the output mode from the request

- A critique, audit or plan is read-only.
- A build with a clear target proceeds to source changes and an inspected render.
- A bare skill name with several frontends in the repository needs a target choice. Naming a skill settles the skill and leaves the scope open.
- The activation note and any post-edit reminder are prompts to inspect the changed UI. They grant no permission to redesign unrelated screens.

## Direction and inventory first

Before implementation, record a short direction and the finite routes, controls and states that matter. Read current components, brand tokens and dirty files (`git status --short` through `run_command`). Preserve established identity in brownfield work.

For new work with no visual direction in the brief, apply the authored default profile (`references/default-editorial-pixel.json`) without asking. Missing direction is a settled default and needs no question. The profile never recolors an existing product.

## The interview rules

There is no mandatory interview. Ask when two plausible answers would materially change scope, architecture, permissions, accessibility or visual direction. Otherwise build.

1. Resolve a known conflict before installing tooling or producing a baseline capture. A capture is unnecessary for asking the question.
2. Ask one high-impact question at a time through `ask_question`: `questions:[{question, options}]`, with concrete alternatives and their consequences, and a recommended default marked in the first option.
3. Wait for the answer before choosing the next unresolved material decision. Continue for as many rounds as the decisions need; the interview has no fixed question count.
4. If the brief names competing directions and calls both acceptable, that acceptance leaves the visual axis unresolved. Ask about the directions as their own round after higher-impact questions. A recommendation inside the question leaves the axis open until the user selects or delegates it, and work on that direction waits.
5. Give each remaining open axis its own round. A default is valid when the brief settles the axis, when the user expressly delegates it ("your call", "pick one"), or when the alternatives would not change the result.

## Headless runs

`ask_question` can be unanswerable under `agy -p`. In that case write the recommended default, record it as a `decision` line in `.litgravity/ledger/<conversation-id>.jsonl` (`{"kind":"decision","text":"default: <choice> because <reason>"}`), continue, and state the assumption once in the reply. A decision that touches permissions, credentials, publication or brand marks stops the run as BLOCKED, since a default cannot grant those.

## Retain answers

Keep earlier answers in the conversation and in `.litgravity/interview/<slug>-direction.md`. On resume, read the confirmed choices and inspect partial work before asking anything new, and leave a resolved question closed. When all material choices are answered or delegated, state the default and proceed on the remaining details that do not change the result.

A skill name or keyword-only request authorizes no build: review, plan and keyword-only requests stay read-only. An answer resolves the design choice it asked about. It grants no broader file, host, permission, credential or publication authority.

## The contract and the screen

The beta2 contract records the real inventory, tokens, responsive transformations and acceptance criteria as they develop, and it evolves with the code. Validate it before acceptance with `scripts/validate-design-contract.mjs` from the skill directory. A valid result proves schema consistency and says nothing about whether the interface is attractive or works. When the user asked for a screen, the work continues past the contract to a rendered page.

## Defaults for the pixel profile

When the profile applies: deliberate type hierarchy, one coherent palette, and an original crisp pixel illustration tied to the product's purpose (a smooth generic icon fails the direction). Compose separate mobile line breaks, and set Korean display leading above Latin display leading. Keep readable body text and comfortable controls. Effects stay behind content. Prefer an asymmetric layout that still gives the primary task an obvious reading order. For a screen people work in repeatedly, the profile's `work_surfaces` block wins: working content and controls first, pixel art as a small accent.

## Exercise the actual page

Initial empty state, successful primary action, validation error and recovery, keyboard focus, responsive layout and reduced motion. Check 320, 390 and 1440 CSS pixels. A class that sets `display` can override the `hidden` attribute, so include a targeted `[hidden] { display: none }` rule and verify the transition in the browser. Record an unavailable browser separately from implementation completion. Source inspection is a different kind of evidence from rendered evidence, and the reply says which one it has.

## Question bank

Use these as starting points, one per round:

| Axis | Question shape | Recommended default |
|---|---|---|
| Target | "Which frontend should this change land in: `apps/web` or `apps/admin`?" | The one the request's nouns match |
| Direction | "The brief names a dense console and a friendly onboarding feel. Which leads?" | The one tied to the most frequent task |
| Dependency | "This needs a date picker. Use the existing `@acme/ui` one or add a package?" | The existing one |
| Dark mode | "Add a dark theme now or keep light only?" | Light only unless the repository already has theme tokens |
| Locale | "Is Korean copy in scope for this screen?" | Yes when the repository ships `ko` strings |
| Data | "Use the live endpoint or a fixture for the empty and error states?" | Fixture, noted in the contract |

## Failure patterns

Reject:

- a build started while an unresolved material axis waits for the user
- a question that repeats an answer already retained
- a default applied to an axis the brief left undecided between named directions
- a contract handed over in place of the screen the user asked for
- source inspection reported as rendered evidence
