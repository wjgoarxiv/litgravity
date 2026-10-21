# README decoration and navigation

## Inspection notes

The public repositories below were inspected on 2026-09-21. Star totals and other live counters drift, so treat every number as transient: none of them is a product claim, and none justifies a popularity badge. Study each README's source and its repository page. Examples and asset files from those projects stay out of scope.

| Repository inspected | What was visible in its README on the inspection date |
| --- | --- |
| [react/react](https://github.com/react/react) | The opening stayed plain. A one-sentence purpose came first, then short capability bullets, a quick documentation link and a runnable example, with the longer contributor material after all of that. The repository page showed a large, shifting star total. |
| [fastapi/fastapi](https://github.com/fastapi/fastapi) | The project mark and a one-line description sat centered. Workflow, coverage and package badges formed one centered row, and explanatory prose with linked examples followed. An alternate code path and a command explanation were folded into `<details>`. |
| [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | A centered logo block with light and dark variants led, followed by a short centered descriptor and a compact badge row ahead of the quickstart. The body then relied on named sections and direct documentation links. The repository page also showed a large, shifting star total. |
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | A centered banner and several labeled badges (release, platform, package, community, license) preceded a brief description. One bounded section in the README source is excluded by a separate manpage process, which shows that decorative blocks can meet renderer-specific limits. |
| [cli/cli](https://github.com/cli/cli) | A short product explanation and a real interface screenshot opened the page, and installation, usage and contribution guidance were linked afterwards. The screenshot carried descriptive alt text, and the quick description remained next to it. |

These notes record structure only. The section includes no repository copy, wording, logo, screenshot or badge asset. Keep star totals from repository pages out of README prose. Each pattern below stays tied to repository-backed facts and verified endpoints.

## Assembly rules

Begin with repository facts and useful navigation. Decoration shapes hierarchy and scanning speed. It must stay silent about features, releases, quality levels, community size, passing checks and support promises that the authorized source set fails to establish. The facts checker validates structure and paths. Reopen each source yourself and compare every claim against it.

### Hero and badge/logo row composition

- A centered hero combines one locally verified cover, the exact repository name, a short source-backed purpose line and a small navigation row. Body prose stays left-aligned for reading.
- When the renderer supports responsive HTML, build the hero with `<picture>` and inspected dark/light, mobile and reduced-motion variants. Keep a plain Markdown image line ready for renderers that strip HTML, with meaningful alt text and a working asset path.
- Pair a project-owned logo with a few useful badges. Choose badges for real package, license or workflow endpoints that belong to this repository. Verify the image URL and the linked destination; drop the badge whenever either endpoint is absent, unrelated, stale or unverifiable.
- Live values such as star counts, download counts, versions, build states, benchmarks and endorsements belong only behind a live, repository-specific endpoint. Static text or a static image carries none of them.

### Section iconography and emoji section headers

Open selected section headings with one small, consistent emoji when it speeds up scanning in a long document: for example a cue for setup, one for capabilities and one for community. Every heading keeps its words, so the meaning survives when emoji are unavailable or read aloud. Limit icons to headings and avoid decorating paragraphs; each icon sits beside a text label.

Icons in a feature list separate categories. Keep text labels and meaningful alt text beside them. A decorative image takes empty alt text only when the same meaning is already written nearby.

### Feature grids and collapsible detail

A Markdown table suits a small, comparable feature set: short columns, one capability per row, and every link aimed at the real implementation or documentation. Narrow screens read a short bullet list more easily, so switch to bullets once table cells grow into prose blocks.

Use `<details><summary>…</summary>` for optional depth such as advanced setup, full examples, contributor recognition or a long compatibility list. Install requirements, primary usage and important limitations stay outside the collapsed region. Give every summary a clear label. When the target strips HTML, convert the same material into ordinary headings and lists and keep it visible.

### Contributors, history and showcase

- Link a contributor image to this repository's verified `graphs/contributors` page. Include it once the image endpoint returns a real image for the exact public repository, give it useful alt text, and keep a text link to the contributor page beside it.
- A star-history chart is optional. Prefer a checked-in chart generated for this repository, or a live endpoint that currently resolves for it. Third-party services change access rules, caching and response shape, so fetch or preview the exact URL first and remove a broken chart. Such a chart records observed history and says nothing about future growth or project quality.
- A showcase links to an actual public demo, or to a locally checked-in screenshot or movie that belongs to this project. Describe what the viewer will see. A remote embed offers no proof that the program works or that a deployment is current.
- Embed blocks supplement the page. Keep the underlying destination as selectable text so a registry that strips HTML still offers a useful route.

### Footer navigation and plain-Markdown fallback

Close with a short row of links to headings that exist in this README and to inspected project resources such as documentation, discussions, contributing guidance and license. Check case-sensitive fragment targets once the headings are final, and omit every target that is missing.

Some registry renderers remove raw HTML. For that branch, use a standard Markdown heading, a local Markdown image for the static cover, ordinary links in place of badge-only navigation, and normal headings and lists instead of `<details>`. Keep the quickstart, core facts, limitations and license in Markdown, so stripping decoration leaves all essential information intact.

## Final checks

Before producing the README, verify each claim against its repository source, each badge against its exact endpoint and destination, each local image against the selected package or repository root, and each anchor against a real heading. Delete empty optional sections and unresolved placeholders. This decoration reference proves no claim and no endpoint.
