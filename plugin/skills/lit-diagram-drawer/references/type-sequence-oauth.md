# OAuth refresh sequence

**Catalog ID:** `sequence-oauth`  
**Parent grammar:** [Sequence](type-sequence.md)

## Purpose and selection

Select this focused sequence variant when a client sends a bearer-authenticated resource request and the story centers on the invalid-token response, the refresh, and the retry. It keeps the usual request/response chronology and makes the token-valid and refresh branches easy to read. The general sequence guide covers other protocols, and a state machine fits cases where the subject's legal states outweigh messages between actors.

The drawing documents one exchange. It makes no claim to be an OAuth threat model, a complete authorization-code grant, or proof that an implementation follows a security profile; link a separate security review when those claims matter.

## Content schema

Prepare a small ordered record before drawing:

- **Participants:** stable id, display name, role, and an optional short system qualifier. The usual roles are client, resource API, and authorization service.
- **Messages:** order, sender, receiver, kind (`call`, `return`, or `async`), short protocol label, and optional outcome or status. Include the bearer request, the resource result, the token refresh exchange, and one retry when the brief requires it.
- **Branch:** one `alt` fragment with two guards, the valid-token success region and the expired/invalid-token region. Record the condition and the resulting message in each region.
- **Security note:** state whether credentials are illustrative or redacted. Visible text, metadata, examples, and screenshot filenames hold placeholders in place of any real access token, refresh token, client secret, or personal data.

Message labels carry the method or path, the status, and a short payload noun. Detailed claims belong in a caption or companion prose.

## Deterministic layout recipe

1. Order participants left to right by first interaction: client at left, resource API in the middle, and authorization service at right when those are the actors. Draw participant boxes once, with dashed lifelines straight down.
2. Give each message one vertical slot in chronological order. Reserve enough height for the `alt` tab, guard labels, divider, and both branch messages before placing arrows. Align each message to the 4 px layout grid and hold at least 24 px between message baselines.
3. Put the bearer request and its first response above the branch. Frame only the lifelines that participate. Inside `alt`, the first region carries `[token valid]` and the second carries an explicit expired/invalid-token guard, separated by a dashed rule. Leave at least 16 px between the divider and nearby messages.
4. In the failure region, show the unauthorized return, the refresh call and response, then one resource retry and its return. The auth participant handles the refresh exchange, and its activation bar stays open only while it processes that exchange.
5. Place any audit or event notification after the user-facing result. It is a dashed line with an open head; returns are dashed with filled heads, and synchronous calls are solid with filled heads.
6. Route labels into clear space while message y-values stay put. When the 5-lifeline, 12-message, 1-fragment, or 2-region budget is exceeded, split the refresh detail into a second figure.

## Visual encoding

The parent sequence grammar sets line types, activation bars, branch frames, and arrowheads. Request calls are solid, synchronous responses are dashed with filled heads, and one-way events are dashed with open heads. The accent marks at most one headline success message, while guard text and status labels distinguish the success and error branches without help from color. Operator tags (`ALT`, `OPT`, `LOOP`) use the mono role.

The figure shows the protocol action only, such as `POST /token · refresh`, with the resulting status, and the refresh token itself stays out of the picture. Refresh may fail, so when failure handling is in scope, add a clearly bounded second figure or use a complete branch with a labeled failure result.

## Korean text

Pretendard sets participant names and Hangul phrases, while the bundled mono role sets method names, paths, statuses, guards, and identifiers. Break long labels at phrase boundaries and keep `GET /resource`, status codes, and token-related protocol terms intact. Guard wording stays short enough to fit inside the frame. Follow [Korean typography](korean-typography.md) for mixed Hangul/Latin spacing, baseline, and number treatment.

## Light, dark, and full variants

All three variants share participant order, message order, branch guards, and geometry. Light and dark swap only semantic surface and ink tokens. The full editorial variant adds a concise title, one explanatory caption, and a legend for call/return/async/fragment when needed; its frame adds no branches and suggests no security guarantee. Keep arrowhead contrast in both skins.

## Accessibility

Provide an SVG title and a description that narrates, in order, the happy path, the invalid-token branch, and the retry outcome. Visible guard and status labels back up the line style. Keep text outside lifelines where possible, hold label contrast at a readable level, and keep open and filled arrowheads visually distinct at export size. Success and failure each have a text cue in addition to accent color.

## Verifier gates

Run `scripts/verify-diagram.mjs` for bounds, overlap, clipping, contrast, skin polarity, visible text, and accessibility checks. Run `scripts/verify-type.mjs --type=sequence-oauth` for the two-region refresh contract and message/arrow semantics. Review the rendered light, dark, and full captures at the intended slide size, since a green structural check leaves guard-label readability unconfirmed.

## Anti-patterns

- Showing real credentials or a token value.
- Omitting the invalid-token status before refresh, or drawing refresh as a user-facing resource response.
- Combining both outcomes into an unlabeled arrow cluster.
- Drawing returns in the solid call grammar or async events with filled heads.
- Adding multiple retries with the retry policy unspecified.
- Treating this focused exchange as a complete OAuth security analysis.
- Moving an arrow to fit its label, or using color alone to separate branch outcomes.

## Related references

[Sequence](type-sequence.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
