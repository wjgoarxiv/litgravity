// Second implementation of the litfamily.design-contract shape, owned by the evidence lane.
//
// The evidence lane reads a Design Contract as untrusted bytes that arrive with a hash. It must
// decide one thing about them -- does this document satisfy the published shape -- before it
// accounts a manifest against the surfaces the document declares. That decision is made here,
// against the schema copies in ../schemas, and nowhere else.
//
// This module is deliberately a *separate* implementation of the same published shape rather
// than a shared import. Two independent readings of one contract is the property worth having:
// a rule that only one of them enforces is a rule the shape never actually pinned down, and a
// disagreement is a real signal instead of a silent common-mode assumption. The evidence lane
// also must not acquire a load-time dependency on another skill's runtime, because a manifest
// has to be checkable from whatever subset of the package the caller installed.
//
// Written in this lane's own idiom: closed predicates that answer true or false, the same shape
// as evidenceShapeValid and reviewShapeValid beside it. It reports no issue list, because the
// only question the evidence lane asks is admissible or not.

export const DESIGN_CONTRACT_SCHEMA = "litfamily.design-contract/v1alpha1";
export const DESIGN_CONTRACT_BETA_SCHEMA = "litfamily.design-contract/v1beta1";
export const DESIGN_CONTRACT_BETA2_SCHEMA = "litfamily.design-contract/v1beta2";

const ROOT_KEYS = [
  "schema_id", "contract_id", "source_hash", "intent", "direction", "inventory",
  "accessibility", "localization", "performance", "evidence_policy", "omissions",
  "accepted_exceptions",
];
const BETA_KEYS = [
  ...ROOT_KEYS, "lane", "tokens", "component_behaviors", "responsive_transformations",
  "motion", "acceptance_criteria",
];
const BETA2_OPTIONAL_KEYS = ["taste"];

// Contract identifiers permit `.` and `_` in the tail, which the evidence and receipt grammars
// beside this file do not. Keeping a private copy is the point: the contract grammar is the
// contract's, not the manifest's, and the two must be free to diverge.
const CONTRACT_ID = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._/-]*$/u;
const LOWER_SHA256 = /^[0-9a-f]{64}$/u;
const LOCALE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/u;

// One bounded line: no leading or trailing whitespace, no line or tab breaks anywhere inside.
const ONE_LINE = /^\S(?:[^\n\r\t]*\S)?$/u;
const LINE_MAX = 512;
const PHRASE_MAX = 32;
const SCOPE_MAX = 64;

// Exactly the millisecond-precision UTC form. Numeric offsets, a lowercase `z`, and
// microsecond precision are other strings and are rejected rather than folded.
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;

const ACCESSIBILITY_TARGET = "WCAG 2.2 AA";
const TOKEN_STRATEGIES = ["reuse", "extend", "create"];
const EVIDENCE_CHANNELS = [
  "tests", "browser", "keyboard", "accessibility-tree", "screen-reader", "performance",
  "localization",
];
const STATE_KINDS = [
  "loading", "empty", "error", "success", "disabled", "permission", "offline", "ready",
];
const INPUT_MODES = ["keyboard", "pointer", "touch", "voice", "switch"];
const VIEWPORT_CATEGORIES = ["compact", "medium", "expanded"];
const REFERENCE_KINDS = ["user-provided", "repo-local", "generated", "measured"];
const TASTE_DIALS = ["variance", "motion", "density"];

// Group name, the identifier prefix its entries carry, and the inclusive entry bounds. Order is
// the reading order the contract publishes, and it is the order surfaces are flattened in.
const GROUPS = [
  ["routes", "route", 1, 128],
  ["regions", "region", 1, 256],
  ["components", "component", 1, 512],
  ["interactions", "interaction", 1, 256],
  ["states", "state", 0, 512],
  ["viewports", "viewport", 0, 32],
  ["references", "reference", 0, 64],
];
const AUTHENTICATED_SURFACES_MAX = 128;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Closed object: every required key present, no key outside required plus optional.
function closed(value, required, optional = []) {
  if (!object(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function line(value) {
  return typeof value === "string" && Array.from(value).length <= LINE_MAX && ONE_LINE.test(value);
}

function phrases(value, minimum, maximum = PHRASE_MAX) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
    && value.length === new Set(value).size && value.every(line);
}

function flag(value) {
  return typeof value === "boolean";
}

function counted(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function measured(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value)
    && value >= minimum && value <= maximum;
}

// Closed vocabulary drawn without repetition, and never empty.
function subset(value, vocabulary, minimum = 1) {
  return Array.isArray(value) && value.length >= minimum && value.length <= vocabulary.length
    && value.length === new Set(value).size
    && value.every((entry) => vocabulary.includes(entry));
}

function identifier(value, prefix) {
  return typeof value === "string" && CONTRACT_ID.test(value) && value.startsWith(prefix);
}

function digest(value) {
  return typeof value === "string" && LOWER_SHA256.test(value);
}

// A calendar value that a clock would renormalise is not the instant it spells. Comparing every
// field back against the parsed instant rejects 2026-02-30 and 2026-13-01 without relying on
// how any particular serialiser prints a date.
function instant(value) {
  const parts = typeof value === "string" ? UTC_INSTANT.exec(value) : null;
  if (parts === null) return false;
  const [year, month, day, hour, minute, second, millisecond] = parts.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  return Number.isFinite(parsed.getTime())
    && parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month
    && parsed.getUTCDate() === day && parsed.getUTCHours() === hour
    && parsed.getUTCMinutes() === minute && parsed.getUTCSeconds() === second
    && parsed.getUTCMilliseconds() === millisecond;
}

function identityValid(contract, schema = DESIGN_CONTRACT_SCHEMA) {
  return contract.schema_id === schema
    && identifier(contract.contract_id, "contract:")
    && digest(contract.source_hash);
}

function intentValid(intent) {
  return closed(intent, ["audiences", "tasks", "qualities", "constraints", "non_goals"])
    && ["audiences", "tasks", "qualities"].every((key) => phrases(intent[key], 1))
    && ["constraints", "non_goals"].every((key) => phrases(intent[key], 0));
}

function directionValid(direction) {
  return closed(direction, ["name", "principles", "token_strategy", "voice"])
    && line(direction.name) && line(direction.voice)
    && phrases(direction.principles, 3, 7)
    && TOKEN_STRATEGIES.includes(direction.token_strategy);
}

function accessibilityValid(accessibility) {
  const flags = ["keyboard", "screen_reader", "reduced_motion", "forced_colors"];
  return closed(accessibility, ["target", ...flags, "zoom_percent"])
    && accessibility.target === ACCESSIBILITY_TARGET
    && flags.every((key) => flag(accessibility[key]))
    && counted(accessibility.zoom_percent, 200, 400);
}

function localizationValid(localization) {
  const flags = [
    "cjk_line_break_review", "font_fallback_review", "ime_review", "rtl_review",
  ];
  return closed(localization, ["locales", "text_expansion_percent", ...flags])
    && phrases(localization.locales, 1)
    && localization.locales.every((locale) => LOCALE.test(locale))
    && counted(localization.text_expansion_percent, 0, 300)
    && flags.every((key) => flag(localization[key]));
}

// Every budget is bounded on both sides. An open-ended ceiling is how a regression is later
// reported as still inside contract.
function performanceValid(performance) {
  return closed(performance, ["lcp_ms", "cls", "inp_ms", "initial_js_kb", "initial_css_kb"])
    && ["lcp_ms", "inp_ms"].every((key) => counted(performance[key], 1, 60000))
    && measured(performance.cls, 0, 1)
    && ["initial_js_kb", "initial_css_kb"].every((key) => counted(performance[key], 0, 1048576));
}

function evidencePolicyValid(policy) {
  return closed(policy, [
    "independent_review_required", "required_channels", "cleanup_required",
  ])
    && flag(policy.independent_review_required) && flag(policy.cleanup_required)
    && subset(policy.required_channels, EVIDENCE_CHANNELS);
}

// Omissions and accepted exceptions are the only two places a contract may leave something
// undone, so both carry an owner. An absent `expires_at` is a standing decision; a present one
// must be a real instant.
function scopeRecordsValid(records) {
  return Array.isArray(records) && records.length <= SCOPE_MAX
    && records.every((record) =>
      closed(record, ["id", "reason", "owner"], ["expires_at"])
      && typeof record.id === "string" && CONTRACT_ID.test(record.id)
      && line(record.reason) && line(record.owner)
      && (!Object.hasOwn(record, "expires_at") || instant(record.expires_at)));
}

function groupsShaped(inventory) {
  return closed(inventory, [...GROUPS.map(([group]) => group), "authenticated_surfaces"])
    && GROUPS.every(([group, , minimum, maximum]) => {
      const entries = inventory[group];
      return Array.isArray(entries) && entries.length >= minimum && entries.length <= maximum
        && entries.every(object);
    })
    && Array.isArray(inventory.authenticated_surfaces)
    && inventory.authenticated_surfaces.length <= AUTHENTICATED_SURFACES_MAX
    && inventory.authenticated_surfaces.every(object);
}

function routesValid(routes) {
  return routes.every((route) =>
    closed(route, ["id", "path", "primary", "auth_required"])
    && identifier(route.id, "route:") && line(route.path)
    && flag(route.primary) && flag(route.auth_required))
    // A contract in which nothing is primary has not decided what the surface is for.
    && routes.some((route) => route.primary === true);
}

function regionsValid(regions, routeIds) {
  return regions.every((region) =>
    closed(region, ["id", "route_id", "purpose"])
    && identifier(region.id, "region:")
    && identifier(region.route_id, "route:") && routeIds.has(region.route_id)
    && line(region.purpose));
}

function componentsValid(components, regionIds) {
  return components.every((component) =>
    closed(component, ["id", "region_id", "role"])
    && identifier(component.id, "component:")
    && identifier(component.region_id, "region:") && regionIds.has(component.region_id)
    && line(component.role));
}

function interactionsValid(interactions, routeIds) {
  return interactions.every((interaction) =>
    closed(interaction, ["id", "route_id", "critical", "input_modes"])
    && identifier(interaction.id, "interaction:")
    && identifier(interaction.route_id, "route:") && routeIds.has(interaction.route_id)
    && flag(interaction.critical)
    && subset(interaction.input_modes, INPUT_MODES))
    // Without one critical interaction the evidence lane has no priority signal to account.
    && interactions.some((interaction) => interaction.critical === true);
}

function statesValid(states, routeIds) {
  return states.every((state) =>
    closed(state, ["id", "route_id", "kind"])
    && identifier(state.id, "state:")
    && identifier(state.route_id, "route:") && routeIds.has(state.route_id)
    && STATE_KINDS.includes(state.kind));
}

function viewportsValid(viewports) {
  return viewports.every((viewport) =>
    closed(viewport, ["id", "category", "width_px", "height_px"])
    && identifier(viewport.id, "viewport:")
    && VIEWPORT_CATEGORIES.includes(viewport.category)
    && counted(viewport.width_px, 240, 7680)
    && counted(viewport.height_px, 240, 4320));
}

function referencesValid(references) {
  return references.every((reference) =>
    closed(reference, ["id", "kind", "sha256", "provenance"])
    && identifier(reference.id, "reference:")
    && REFERENCE_KINDS.includes(reference.kind)
    && digest(reference.sha256)
    && line(reference.provenance));
}

// Auth safety is a two-way coupling, and both directions are ways to lose track of who can
// reach a surface. A protected route with no declared surface has no reviewable test path; a
// declared surface on a public route claims a protection that is not there.
function authenticatedSurfacesValid(surfaces, routes) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const claimed = surfaces.map(({ route_id: routeId }) => routeId);
  return claimed.length === new Set(claimed).size
    && surfaces.every((surface) =>
      closed(surface, ["route_id", "safe_test_account"])
      && identifier(surface.route_id, "route:") && routeById.has(surface.route_id)
      && surface.safe_test_account === true
      && routeById.get(surface.route_id).auth_required === true)
    && routes.every((route) =>
      route.auth_required !== true || claimed.includes(route.id));
}

function inventoryValid(inventory) {
  if (!groupsShaped(inventory)) return false;
  const routeIds = new Set(inventory.routes.map(({ id }) => id));
  const regionIds = new Set(inventory.regions.map(({ id }) => id));
  return routesValid(inventory.routes)
    && regionsValid(inventory.regions, routeIds)
    && componentsValid(inventory.components, regionIds)
    && interactionsValid(inventory.interactions, routeIds)
    && statesValid(inventory.states, routeIds)
    && viewportsValid(inventory.viewports)
    && referencesValid(inventory.references)
    && authenticatedSurfacesValid(inventory.authenticated_surfaces, inventory.routes);
}

// Flat view of the declared surface: one { id, kind } per entry, in published group order.
// Evidence accounting consumes this instead of reaching into the groups itself.
export function designContractSurfaces(contract) {
  const inventory = object(contract) ? contract.inventory : undefined;
  if (!object(inventory)) return [];
  const surfaces = [];
  for (const [group, kind] of GROUPS) {
    if (!Array.isArray(inventory[group])) continue;
    for (const entry of inventory[group]) {
      if (object(entry) && typeof entry.id === "string") surfaces.push({ id: entry.id, kind });
    }
  }
  return surfaces;
}

// Identifiers are unique across the whole document, not merely inside one group. Two surfaces
// sharing an identifier cannot be told apart in a manifest or a review receipt.
function identifiersUnique(contract) {
  const declared = [contract.contract_id, ...designContractSurfaces(contract).map(({ id }) => id)];
  for (const field of ["omissions", "accepted_exceptions"]) {
    for (const record of contract[field]) declared.push(record.id);
  }
  return declared.length === new Set(declared).size;
}

function baseContractValid(contract, schema = DESIGN_CONTRACT_SCHEMA, keys = ROOT_KEYS, optionalKeys = []) {
  return closed(contract, keys, optionalKeys)
    && identityValid(contract, schema)
    && intentValid(contract.intent)
    && directionValid(contract.direction)
    && accessibilityValid(contract.accessibility)
    && localizationValid(contract.localization)
    && performanceValid(contract.performance)
    && evidencePolicyValid(contract.evidence_policy)
    && scopeRecordsValid(contract.omissions)
    && scopeRecordsValid(contract.accepted_exceptions)
    && inventoryValid(contract.inventory)
    && identifiersUnique(contract);
}

function references(value, prefix, declared) {
  return Array.isArray(value) && value.length >= 1 && value.length <= 64
    && value.length === new Set(value).size
    && value.every((id) => identifier(id, `${prefix}:`) && declared.has(id));
}

function betaExtensionValid(contract) {
  const inventory = contract.inventory;
  if (inventory.viewports.length < 2) return false;
  const ids = (group) => new Set(inventory[group].map(({ id }) => id));
  const routes = ids("routes");
  const components = ids("components");
  const interactions = ids("interactions");
  const states = ids("states");
  const viewports = ids("viewports");
  const allInventory = new Set(GROUPS.flatMap(([group]) => [...ids(group)]));
  const declared = [];
  if (!["new-build", "brownfield", "redesign", "reference-fidelity", "design-system"].includes(contract.lane)) {
    return false;
  }
  if (!Array.isArray(contract.tokens) || contract.tokens.length < 1 || contract.tokens.length > 256
    || !contract.tokens.every((token) => {
      if (!closed(token, ["id", "category", "value", "usage"])
        || !identifier(token.id, "token:")
        || !["color", "typography", "spacing", "radius", "shadow", "motion", "other"].includes(token.category)
        || !line(token.value) || !line(token.usage)) return false;
      declared.push(token.id);
      return true;
    })) return false;
  if (!Array.isArray(contract.component_behaviors) || contract.component_behaviors.length < 1
    || contract.component_behaviors.length > 512
    || !contract.component_behaviors.every((behavior) =>
      closed(behavior, ["component_id", "state_ids", "interaction_ids", "keyboard_behavior"])
      && identifier(behavior.component_id, "component:") && components.has(behavior.component_id)
      && references(behavior.state_ids, "state", states)
      && references(behavior.interaction_ids, "interaction", interactions)
      && line(behavior.keyboard_behavior))) return false;
  if (!Array.isArray(contract.responsive_transformations)
    || contract.responsive_transformations.length < 1
    || contract.responsive_transformations.length > 256
    || !contract.responsive_transformations.every((item) =>
      closed(item, ["route_id", "viewport_id", "behavior"])
      && identifier(item.route_id, "route:") && routes.has(item.route_id)
      && identifier(item.viewport_id, "viewport:") && viewports.has(item.viewport_id)
      && line(item.behavior))) return false;
  if (!closed(contract.motion, ["policy", "reduced_motion_behavior", "transitions"])
    || !["none", "functional", "expressive"].includes(contract.motion.policy)
    || !line(contract.motion.reduced_motion_behavior)
    || !Array.isArray(contract.motion.transitions) || contract.motion.transitions.length > 256
    || (contract.motion.policy === "none" && contract.motion.transitions.length !== 0)
    || (contract.motion.policy !== "none" && contract.motion.transitions.length === 0)
    || !contract.motion.transitions.every((transition) => {
      if (!closed(transition, ["id", "interaction_id", "duration_ms", "easing"])
        || !identifier(transition.id, "transition:")
        || !identifier(transition.interaction_id, "interaction:")
        || !interactions.has(transition.interaction_id)
        || !counted(transition.duration_ms, 0, 10000) || !line(transition.easing)) return false;
      declared.push(transition.id);
      return true;
    })) return false;
  if (!Array.isArray(contract.acceptance_criteria) || contract.acceptance_criteria.length < 1
    || contract.acceptance_criteria.length > 256
    || !contract.acceptance_criteria.every((criterion) => {
      if (!closed(criterion, ["id", "observable", "verification", "required", "inventory_ids"])
        || !identifier(criterion.id, "criterion:") || !line(criterion.observable)
        || ![...EVIDENCE_CHANNELS, "manual"].includes(criterion.verification)
        || criterion.required !== true
        || !Array.isArray(criterion.inventory_ids) || criterion.inventory_ids.length < 1
        || criterion.inventory_ids.length > 64
        || criterion.inventory_ids.length !== new Set(criterion.inventory_ids).size
        || criterion.inventory_ids.some((id) => !allInventory.has(id))) return false;
      declared.push(criterion.id);
      return true;
    })) return false;
  const baseIds = [contract.contract_id, ...designContractSurfaces(contract).map(({ id }) => id),
    ...contract.omissions.map(({ id }) => id), ...contract.accepted_exceptions.map(({ id }) => id)];
  return [...baseIds, ...declared].length === new Set([...baseIds, ...declared]).size;
}

function tasteValid(taste) {
  return closed(taste, TASTE_DIALS)
    && TASTE_DIALS.every((dial) => Number.isInteger(taste[dial]) && taste[dial] >= 1 && taste[dial] <= 10);
}

export function designContractShapeValid(contract) {
  if (baseContractValid(contract)) return true;
  if (!object(contract)) return false;
  if (contract.schema_id === DESIGN_CONTRACT_BETA2_SCHEMA) {
    return baseContractValid(contract, DESIGN_CONTRACT_BETA2_SCHEMA, BETA_KEYS, BETA2_OPTIONAL_KEYS)
      && betaExtensionValid(contract)
      && (!Object.hasOwn(contract, "taste") || tasteValid(contract.taste));
  }
  return contract.schema_id === DESIGN_CONTRACT_BETA_SCHEMA
    && baseContractValid(contract, DESIGN_CONTRACT_BETA_SCHEMA, BETA_KEYS)
    && betaExtensionValid(contract);
}
