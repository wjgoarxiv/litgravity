// Inventory rules of litfamily.design-contract/v1alpha1.
//
// The inventory is the finite surface the contract promises to design and later prove. These
// rules run in code because a JSON Schema document can describe an entry's shape but cannot
// resolve one entry against another, and cannot express the auth safety coupling at all.
import {
  ID_PREFIXES,
  isLowercaseSha256,
  isPrefixedId,
  isStableId,
} from "./design-contract-format.mjs";
import {
  collectKeyIssues,
  isBoundedInteger,
  isObject,
  isStrictBoolean,
  isText,
} from "./design-contract-surface-rules.mjs";

// Closed sets. A new value is a contract revision, not a free-text extension.
export const STATE_KINDS = Object.freeze([
  "loading", "empty", "error", "success", "disabled", "permission", "offline", "ready",
]);

export const INPUT_MODES = Object.freeze(["keyboard", "pointer", "touch", "voice", "switch"]);

export const VIEWPORT_CATEGORIES = Object.freeze(["compact", "medium", "expanded"]);

export const REFERENCE_KINDS = Object.freeze([
  "user-provided", "repo-local", "generated", "measured",
]);

// Group name -> the identifier kind its entries declare, in declaration order.
export const INVENTORY_GROUPS = Object.freeze([
  ["routes", "route"],
  ["regions", "region"],
  ["components", "component"],
  ["interactions", "interaction"],
  ["states", "state"],
  ["viewports", "viewport"],
  ["references", "reference"],
]);

const GROUP_LIMITS = Object.freeze({
  routes: [1, 128],
  regions: [1, 256],
  components: [1, 512],
  interactions: [1, 256],
  states: [0, 512],
  viewports: [0, 32],
  references: [0, 64],
  authenticated_surfaces: [0, 128],
});

const SHAPE = "DESIGN_CONTRACT_INVENTORY_SHAPE";
const CARDINALITY = "DESIGN_CONTRACT_INVENTORY_CARDINALITY";
const DANGLING = "DESIGN_CONTRACT_DANGLING_REFERENCE";
const AUTH = "DESIGN_CONTRACT_AUTH_COUPLING";

function collectIdIssues(issues, value, path, kind) {
  const prefix = ID_PREFIXES[kind];
  if (!isStableId(value)) {
    issues.push({
      code: "DESIGN_CONTRACT_ID_GRAMMAR",
      path,
      message: `${path} must match the typed lowercase identifier grammar`,
    });
    return false;
  }
  if (!isPrefixedId(value, prefix)) {
    issues.push({
      code: "DESIGN_CONTRACT_ID_PREFIX",
      path,
      message: `${path} must start with ${prefix}`,
    });
    return false;
  }
  return true;
}

function collectLinkIssues(issues, value, path, kind, declared) {
  if (!collectIdIssues(issues, value, path, kind)) return;
  if (!declared.has(value)) {
    issues.push({ code: DANGLING, path, message: `${path} does not resolve to a declared ${kind}` });
  }
}

function collectGroupShape(issues, inventory) {
  let shaped = true;
  for (const group of [...INVENTORY_GROUPS.map(([name]) => name), "authenticated_surfaces"]) {
    const [minimum, maximum] = GROUP_LIMITS[group];
    const entries = inventory[group];
    if (!Array.isArray(entries)) {
      issues.push({ code: SHAPE, path: `inventory.${group}`, message: `inventory.${group} must be an array` });
      shaped = false;
      continue;
    }
    if (entries.length < minimum || entries.length > maximum) {
      issues.push({
        code: CARDINALITY,
        path: `inventory.${group}`,
        message: `inventory.${group} needs ${minimum}..${maximum} entries`,
      });
      shaped = false;
      continue;
    }
    if (!entries.every(isObject)) {
      issues.push({ code: SHAPE, path: `inventory.${group}`, message: `inventory.${group} entries must be objects` });
      shaped = false;
    }
  }
  return shaped;
}

function collectRouteIssues(issues, routes) {
  routes.forEach((route, index) => {
    const path = `inventory.routes[${index}]`;
    if (!collectKeyIssues(issues, route, path, SHAPE, ["id", "path", "primary", "auth_required"])) return;
    collectIdIssues(issues, route.id, `${path}.id`, "route");
    if (!isText(route.path)) {
      issues.push({ code: SHAPE, path: `${path}.path`, message: `${path}.path must be one bounded line` });
    }
    for (const field of ["primary", "auth_required"]) {
      if (!isStrictBoolean(route[field])) {
        issues.push({
          code: SHAPE,
          path: `${path}.${field}`,
          message: `${path}.${field} must be true or false, not a truthy value`,
        });
      }
    }
  });
  // At least one route must be primary. A contract where everything is secondary has not
  // decided what the surface is for.
  if (!routes.some((route) => route.primary === true)) {
    issues.push({
      code: CARDINALITY,
      path: "inventory.routes",
      message: "inventory.routes needs at least one route with primary true",
    });
  }
}

function collectRegionIssues(issues, regions, routeIds) {
  regions.forEach((region, index) => {
    const path = `inventory.regions[${index}]`;
    if (!collectKeyIssues(issues, region, path, SHAPE, ["id", "route_id", "purpose"])) return;
    collectIdIssues(issues, region.id, `${path}.id`, "region");
    collectLinkIssues(issues, region.route_id, `${path}.route_id`, "route", routeIds);
    if (!isText(region.purpose)) {
      issues.push({ code: SHAPE, path: `${path}.purpose`, message: `${path}.purpose must be one bounded line` });
    }
  });
}

function collectComponentIssues(issues, components, regionIds) {
  components.forEach((component, index) => {
    const path = `inventory.components[${index}]`;
    if (!collectKeyIssues(issues, component, path, SHAPE, ["id", "region_id", "role"])) return;
    collectIdIssues(issues, component.id, `${path}.id`, "component");
    collectLinkIssues(issues, component.region_id, `${path}.region_id`, "region", regionIds);
    if (!isText(component.role)) {
      issues.push({ code: SHAPE, path: `${path}.role`, message: `${path}.role must be one bounded line` });
    }
  });
}

function collectInteractionIssues(issues, interactions, routeIds) {
  interactions.forEach((interaction, index) => {
    const path = `inventory.interactions[${index}]`;
    if (!collectKeyIssues(issues, interaction, path, SHAPE, [
      "id", "route_id", "critical", "input_modes",
    ])) return;
    collectIdIssues(issues, interaction.id, `${path}.id`, "interaction");
    collectLinkIssues(issues, interaction.route_id, `${path}.route_id`, "route", routeIds);
    if (!isStrictBoolean(interaction.critical)) {
      issues.push({
        code: SHAPE,
        path: `${path}.critical`,
        message: `${path}.critical must be true or false, not a truthy value`,
      });
    }
    const modes = interaction.input_modes;
    if (!Array.isArray(modes) || modes.length < 1 || modes.length > INPUT_MODES.length
      || modes.length !== new Set(modes).size
      || !modes.every((mode) => INPUT_MODES.includes(mode))) {
      issues.push({
        code: SHAPE,
        path: `${path}.input_modes`,
        message: `${path}.input_modes must be a non-empty unique subset of ${INPUT_MODES.join(", ")}`,
      });
    }
  });
  // Something has to be critical, otherwise the evidence lane has no priority signal.
  if (!interactions.some((interaction) => interaction.critical === true)) {
    issues.push({
      code: CARDINALITY,
      path: "inventory.interactions",
      message: "inventory.interactions needs at least one interaction with critical true",
    });
  }
}

function collectStateIssues(issues, states, routeIds) {
  states.forEach((state, index) => {
    const path = `inventory.states[${index}]`;
    if (!collectKeyIssues(issues, state, path, SHAPE, ["id", "route_id", "kind"])) return;
    collectIdIssues(issues, state.id, `${path}.id`, "state");
    collectLinkIssues(issues, state.route_id, `${path}.route_id`, "route", routeIds);
    if (!STATE_KINDS.includes(state.kind)) {
      issues.push({
        code: SHAPE,
        path: `${path}.kind`,
        message: `${path}.kind must be one of ${STATE_KINDS.join(", ")}`,
      });
    }
  });
}

function collectViewportIssues(issues, viewports) {
  viewports.forEach((viewport, index) => {
    const path = `inventory.viewports[${index}]`;
    if (!collectKeyIssues(issues, viewport, path, SHAPE, ["id", "category", "width_px", "height_px"])) return;
    collectIdIssues(issues, viewport.id, `${path}.id`, "viewport");
    if (!VIEWPORT_CATEGORIES.includes(viewport.category)) {
      issues.push({
        code: SHAPE,
        path: `${path}.category`,
        message: `${path}.category must be one of ${VIEWPORT_CATEGORIES.join(", ")}`,
      });
    }
    if (!isBoundedInteger(viewport.width_px, 240, 7680)) {
      issues.push({
        code: SHAPE,
        path: `${path}.width_px`,
        message: `${path}.width_px must be an integer from 240 through 7680`,
      });
    }
    if (!isBoundedInteger(viewport.height_px, 240, 4320)) {
      issues.push({
        code: SHAPE,
        path: `${path}.height_px`,
        message: `${path}.height_px must be an integer from 240 through 4320`,
      });
    }
  });
}

function collectReferenceIssues(issues, references) {
  references.forEach((reference, index) => {
    const path = `inventory.references[${index}]`;
    if (!collectKeyIssues(issues, reference, path, SHAPE, ["id", "kind", "sha256", "provenance"])) return;
    collectIdIssues(issues, reference.id, `${path}.id`, "reference");
    if (!REFERENCE_KINDS.includes(reference.kind)) {
      issues.push({
        code: SHAPE,
        path: `${path}.kind`,
        message: `${path}.kind must be one of ${REFERENCE_KINDS.join(", ")}`,
      });
    }
    if (!isLowercaseSha256(reference.sha256)) {
      issues.push({
        code: "DESIGN_CONTRACT_HASH_GRAMMAR",
        path: `${path}.sha256`,
        message: `${path}.sha256 must be 64 lowercase hexadecimal digits`,
      });
    }
    if (!isText(reference.provenance)) {
      issues.push({
        code: SHAPE,
        path: `${path}.provenance`,
        message: `${path}.provenance must be one bounded line`,
      });
    }
  });
}

// Auth safety coupling. Both directions are errors because both are ways to lose track of who
// can reach a surface: an authenticated route with no declared surface has no reviewable test
// path, and a declared surface on a public route claims protection that does not exist. A
// surface is only usable when its account is explicitly safe to exercise.
function collectAuthenticatedSurfaceIssues(issues, surfaces, routes) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const claimed = new Set();
  surfaces.forEach((surface, index) => {
    const path = `inventory.authenticated_surfaces[${index}]`;
    if (!collectKeyIssues(issues, surface, path, SHAPE, ["route_id", "safe_test_account"])) return;
    collectLinkIssues(issues, surface.route_id, `${path}.route_id`, "route", new Set(routeById.keys()));
    if (claimed.has(surface.route_id)) {
      issues.push({
        code: AUTH,
        path: `${path}.route_id`,
        message: `${surface.route_id} is claimed by more than one authenticated surface`,
      });
    }
    claimed.add(surface.route_id);
    if (surface.safe_test_account !== true) {
      issues.push({
        code: AUTH,
        path: `${path}.safe_test_account`,
        message: `${path}.safe_test_account must be exactly true`,
      });
    }
    const route = routeById.get(surface.route_id);
    if (route && route.auth_required !== true) {
      issues.push({
        code: AUTH,
        path: `${path}.route_id`,
        message: `${surface.route_id} is public, so it must not declare an authenticated surface`,
      });
    }
  });
  for (const route of routes) {
    if (route.auth_required === true && !claimed.has(route.id)) {
      issues.push({
        code: AUTH,
        path: "inventory.authenticated_surfaces",
        message: `${route.id} requires auth but declares no authenticated surface`,
      });
    }
  }
}

// Flat view of the inventory: one { id, kind } entry per declared surface, in group order.
// Downstream evidence accounting consumes this instead of reaching into the groups.
export function designContractInventoryEntries(contract) {
  const inventory = contract?.inventory;
  if (!isObject(inventory)) return [];
  const entries = [];
  for (const [group, kind] of INVENTORY_GROUPS) {
    if (!Array.isArray(inventory[group])) continue;
    for (const entry of inventory[group]) {
      if (isObject(entry) && typeof entry.id === "string") entries.push({ id: entry.id, kind });
    }
  }
  return entries;
}

export function collectInventoryIssues(contract, issues) {
  const inventory = contract.inventory;
  const groups = [...INVENTORY_GROUPS.map(([name]) => name), "authenticated_surfaces"];
  if (!collectKeyIssues(issues, inventory, "inventory", SHAPE, groups)) return;
  if (!collectGroupShape(issues, inventory)) return;
  const routeIds = new Set(inventory.routes.map(({ id }) => id));
  const regionIds = new Set(inventory.regions.map(({ id }) => id));
  collectRouteIssues(issues, inventory.routes);
  collectRegionIssues(issues, inventory.regions, routeIds);
  collectComponentIssues(issues, inventory.components, regionIds);
  collectInteractionIssues(issues, inventory.interactions, routeIds);
  collectStateIssues(issues, inventory.states, routeIds);
  collectViewportIssues(issues, inventory.viewports);
  collectReferenceIssues(issues, inventory.references);
  collectAuthenticatedSurfaceIssues(issues, inventory.authenticated_surfaces, inventory.routes);
}
