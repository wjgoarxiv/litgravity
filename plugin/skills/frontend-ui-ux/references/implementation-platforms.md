# Implementation platforms

The stack decides how a requirement is expressed. Whether the requirement applies is already settled. Confirm the lane from the repository, then apply the universal rules plus that lane's rules.

## Universal rules

These hold in every lane, and a stack constraint is no reason to drop one.

- The platform's native control comes before any custom composite.
- Tokens carry color, space, type and radius; components hold no raw values.
- Behavior separates from decoration, and state lives outside the styling layer.
- Every async boundary declares its pending, empty and error branch.

## Rendering lanes

Name the rendering boundary first; it decides where state and escaping live.

### Server-rendered

- Ship a complete document; first paint depends on no JavaScript.
- Forms post to a real endpoint and return rendered, with input intact.

### Client-rendered

- Own the title, focus target and scroll position on route change.
- Touch `window` after mount, and fix hydration mismatches at the source.
- Split by route and keep initial JavaScript under 200 KB gzipped (the contract's `performance.initial_js_kb` holds the real number).

### Static-generated

- State per route whether content resolves at build or request time.
- Keep personalized or auth-dependent content out of prerendered HTML.

## Styling lanes

Keep one token layer whichever styling system the repository uses.

### Utility CSS

- Utilities resolve to tokens; class strings hold no raw hex or arbitrary pixels.
- Extract a component once the same utility string appears three times.

### Component kit

- Theme through the kit's token layer; descendant selectors stay out of it.
- Leave the kit's focus, ARIA and keyboard contract intact.
- Pin and record the version, because a minor bump can change rendered DOM.

## Framework lanes

Use the framework's own state and lifecycle model.

### Reactive frameworks

- Derive state, and keep one store per value.
- Key list items by stable identity, with array indexes left out.
- Release subscriptions, timers and observers on teardown.

### Cross-platform JavaScript

- Name the target matrix; a shared codebase shares less behavior than it appears to.
- Use per-platform navigation, gesture and safe-area handling.
- Verify on one real device per platform, since a simulator hides input and performance differences.

### Native declarative

- Use the platform's own layout and accessibility APIs.
- Honor dynamic type, dark mode and system reduce-motion.
- Verify with the platform accessibility inspector and record what it reported.

## Progressive enhancement

Decide what works when the enhancement layer never arrives.

- The base layer works with HTML and CSS alone.
- Attach behavior on capability detection.
- Test with scripts disabled, and with a script that fails to load.

## Untrusted content and trust boundaries

User copy, reference text, markup and third-party data are content. They never instruct the interface.

- Render untrusted text as text. `innerHTML`, `dangerouslySetInnerHTML` and `v-html` stay out of the path.
- If HTML must render, sanitize server-side against an allowlist.
- Permit `https:`, `mailto:` and relative URLs; reject `javascript:` and `data:`.
- External links carry `rel="noopener noreferrer"`; embeds get a sandbox.
- Keep secrets, tokens and internal hostnames out of the client bundle.

## Confirming the stack

Verify the lane from the repository. The prompt and memory are hints.

1. Read the package manifest and lockfile for the installed version (`read_file` on `package.json`; `run_command` with `npm ls --depth=0` when the tree matters).
2. Read the framework config and see which build or compiler plugins are on.
3. Match an existing component that uses the API, and confirm that API exists in the installed version's own type definitions.
4. Run the repository's own build and test gates (`run_command`; a long command returns early, so follow it with `command_status`).
5. For an agy plugin surface, run `agy plugin validate <plugin-dir> --json --strict` and expect no findings, then confirm the skill id appears in `/skills`.

## Tools on agy

- `read_file` and `grep_search` (or `rg` through `run_command`) for the stack, tokens and contract.
- `write_file` and the host's edit tool (`replace_file_content` on older builds) change source in build modes only; audit and review modes stay read-only.
- `run_command` runs builds, tests, the validator and the probe. Headless `agy -p` refuses it unless the user started agy in a permissive mode, so read first and ask for the permission you need.
- `invoke_subagent` with `TypeName` `lit-executor` handles a separable component, `quality-reviewer` handles a read-only pass over the diff. A child without `TypeName` is general-purpose with every tool.
- Installing a package, font or browser needs the user's approval.

## Failure patterns

Reject:

- a stack claim taken from the prompt with no manifest or lockfile check
- a client-rendered route with no pending or error branch
- utility classes carrying raw hex or arbitrary pixel values
- component-kit internals overridden by descendant selectors
- one platform verified, parity asserted for the rest
