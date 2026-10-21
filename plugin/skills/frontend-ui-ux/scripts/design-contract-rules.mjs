// Front door for litfamily.design-contract/v1alpha1.
//
// A contract binds exactly two kinds of immutable identity: one `source_hash` for the
// revision under design, and one `sha256` for each reference it declares. It owes nothing to
// any other packaged artifact and requires no retrieval step before it can be validated.
//
// Rules are collected rather than thrown so a single run reports every defect. Callers that
// only need a yes/no answer use validateDesignContractValue.
import { UiuxContractError } from "./errors.mjs";
import {
  canonicalDesignContract,
  ID_PREFIXES,
  isLowercaseSha256,
  isPrefixedId,
  readDesignContract,
} from "./design-contract-format.mjs";
import {
  collectInventoryIssues,
  designContractInventoryEntries,
} from "./design-contract-inventory-rules.mjs";
import { collectSurfaceIssues, isObject } from "./design-contract-surface-rules.mjs";

export const DESIGN_SCHEMA = "litfamily.design-contract/v1alpha1";
export const DESIGN_SCHEMA_BETA = "litfamily.design-contract/v1beta1";
export const DESIGN_SCHEMA_BETA2 = "litfamily.design-contract/v1beta2";

// Exactly twelve root keys, in the order a reviewer reads them: identity, intent, direction,
// the finite surface, the four quality budgets, the evidence policy, and the two places where
// something is knowingly left undone.
const DESIGN_CONTRACT_ROOT_KEYS = Object.freeze([
  "schema_id", "contract_id", "source_hash", "intent", "direction", "inventory",
  "accessibility", "localization", "performance", "evidence_policy", "omissions",
  "accepted_exceptions",
]);
const DESIGN_CONTRACT_BETA_ROOT_KEYS = Object.freeze([
  ...DESIGN_CONTRACT_ROOT_KEYS,
  "lane",
  "tokens",
  "component_behaviors",
  "responsive_transformations",
  "motion",
  "acceptance_criteria",
]);
// v1beta2 adds one optional root key. Optional is the whole point: a contract that says nothing
// about taste is complete, and a v1beta1 document keeps validating byte-for-byte.
const DESIGN_CONTRACT_BETA2_OPTIONAL_KEYS = Object.freeze(["taste"]);

// Direction expressed as numbers a reviewer can argue with, rather than adjectives they cannot.
const TASTE_DIALS = Object.freeze(["variance", "motion", "density"]);

const LANES = new Set(["new-build", "brownfield", "redesign", "reference-fidelity", "design-system"]);
const TOKEN_CATEGORIES = new Set(["color", "typography", "spacing", "radius", "shadow", "motion", "other"]);
const MOTION_POLICIES = new Set(["none", "functional", "expressive"]);
const VERIFICATION_METHODS = new Set([
  "tests", "browser", "keyboard", "accessibility-tree", "screen-reader", "performance",
  "localization", "manual",
]);

export {
  canonicalDesignContract,
  designContractInventoryEntries,
  readDesignContract,
};

function collectIdentityIssues(contract, issues) {
  if (![DESIGN_SCHEMA, DESIGN_SCHEMA_BETA, DESIGN_SCHEMA_BETA2].includes(contract.schema_id)) {
    issues.push({
      code: "DESIGN_CONTRACT_SCHEMA_ID",
      path: "schema_id",
      message: `schema_id must equal one of ${[DESIGN_SCHEMA, DESIGN_SCHEMA_BETA, DESIGN_SCHEMA_BETA2].join(", ")}`,
    });
  }
  if (!isPrefixedId(contract.contract_id, ID_PREFIXES.contract)) {
    issues.push({
      code: "DESIGN_CONTRACT_ID_PREFIX",
      path: "contract_id",
      message: `contract_id must be a typed identifier starting with ${ID_PREFIXES.contract}`,
    });
  }
  if (!isLowercaseSha256(contract.source_hash)) {
    issues.push({
      code: "DESIGN_CONTRACT_HASH_GRAMMAR",
      path: "source_hash",
      message: "source_hash must be 64 lowercase hexadecimal digits",
    });
  }
}

function addIssue(issues, code, path, message) {
  issues.push({ code, path, message });
}

function exactObject(value, allowed, path, issues) {
  if (!isObject(value)) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} must be an object`);
    return false;
  }
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (missing.length > 0) addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} is missing ${missing.join(", ")}`);
  if (unknown.length > 0) addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} declares unknown keys ${unknown.join(", ")}`);
  return missing.length === 0;
}

function records(value, path, issues, { minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(value)) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} must be an array`);
    return [];
  }
  if (value.length < minimum) addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} must list at least ${minimum} entries`);
  if (value.length > maximum) addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", path, `${path} must list at most ${maximum} entries`);
  return value.filter((item, index) => {
    if (isObject(item)) return true;
    addIssue(issues, "DESIGN_CONTRACT_BETA_SHAPE", `${path}[${index}]`, `${path}[${index}] must be an object`);
    return false;
  });
}

function requiredText(value, path, issues) {
  if (typeof value !== "string" || Array.from(value).length > 512
    || !/^\S(?:[^\n\r\t]*\S)?$/u.test(value)) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_TEXT", path, `${path} must be bounded one-line text`);
    return false;
  }
  return true;
}

function declaredIds(contract, category) {
  const values = contract.inventory?.[category];
  if (!Array.isArray(values)) return new Set();
  return new Set(values.filter(isObject).map((item) => item.id).filter((id) => typeof id === "string"));
}

function references(value, path, prefix, declared, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_REFERENCE", path, `${path} must list at least one ${prefix}`);
    return;
  }
  if (value.length > 64) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_REFERENCE", path, `${path} must list at most 64 ${prefix} references`);
  }
  if (new Set(value).size !== value.length) addIssue(issues, "DESIGN_CONTRACT_BETA_REFERENCE", path, `${path} must be unique`);
  for (const id of value) {
    if (!isPrefixedId(id, `${prefix}:`)) addIssue(issues, "DESIGN_CONTRACT_BETA_REFERENCE", path, `${String(id)} must use the ${prefix}: prefix`);
    else if (!declared.has(id)) addIssue(issues, "DESIGN_CONTRACT_BETA_REFERENCE", path, `${id} is not a declared ${prefix}`);
  }
}

function collectBetaIssues(contract, issues) {
  const ids = [];
  if (!LANES.has(contract.lane)) addIssue(issues, "DESIGN_CONTRACT_BETA_LANE", "lane", "lane must name a supported operating lane");
  const routes = declaredIds(contract, "routes");
  const components = declaredIds(contract, "components");
  const interactions = declaredIds(contract, "interactions");
  const states = declaredIds(contract, "states");
  const viewports = declaredIds(contract, "viewports");
  const inventoryIds = new Set([
    ...routes, ...declaredIds(contract, "regions"), ...components, ...interactions, ...states,
    ...viewports, ...declaredIds(contract, "references"),
  ]);
  if (!Array.isArray(contract.inventory?.viewports) || contract.inventory.viewports.length < 2) {
    addIssue(issues, "DESIGN_CONTRACT_BETA_VIEWPORTS", "inventory.viewports", "beta contracts must declare at least two viewport bounds");
  }

  for (const [index, token] of records(contract.tokens, "tokens", issues, { minimum: 1, maximum: 256 }).entries()) {
    const path = `tokens[${index}]`;
    exactObject(token, ["id", "category", "value", "usage"], path, issues);
    if (!isPrefixedId(token.id, "token:")) addIssue(issues, "DESIGN_CONTRACT_BETA_TOKEN", `${path}.id`, "token id must use the token: prefix");
    else ids.push(token.id);
    if (!TOKEN_CATEGORIES.has(token.category)) addIssue(issues, "DESIGN_CONTRACT_BETA_TOKEN", `${path}.category`, "token category is unsupported");
    requiredText(token.value, `${path}.value`, issues);
    requiredText(token.usage, `${path}.usage`, issues);
  }

  for (const [index, behavior] of records(contract.component_behaviors, "component_behaviors", issues, { minimum: 1, maximum: 512 }).entries()) {
    const path = `component_behaviors[${index}]`;
    exactObject(behavior, ["component_id", "state_ids", "interaction_ids", "keyboard_behavior"], path, issues);
    if (!isPrefixedId(behavior.component_id, "component:")) addIssue(issues, "DESIGN_CONTRACT_BETA_COMPONENT", `${path}.component_id`, "component_id must use the component: prefix");
    else if (!components.has(behavior.component_id)) addIssue(issues, "DESIGN_CONTRACT_BETA_COMPONENT", `${path}.component_id`, `${behavior.component_id} is not a declared component`);
    references(behavior.state_ids, `${path}.state_ids`, "state", states, issues);
    references(behavior.interaction_ids, `${path}.interaction_ids`, "interaction", interactions, issues);
    requiredText(behavior.keyboard_behavior, `${path}.keyboard_behavior`, issues);
  }

  for (const [index, transformation] of records(contract.responsive_transformations, "responsive_transformations", issues, { minimum: 1, maximum: 256 }).entries()) {
    const path = `responsive_transformations[${index}]`;
    exactObject(transformation, ["route_id", "viewport_id", "behavior"], path, issues);
    if (!isPrefixedId(transformation.route_id, "route:") || !routes.has(transformation.route_id)) addIssue(issues, "DESIGN_CONTRACT_BETA_RESPONSIVE", `${path}.route_id`, `${String(transformation.route_id)} is not a declared route`);
    if (!isPrefixedId(transformation.viewport_id, "viewport:") || !viewports.has(transformation.viewport_id)) addIssue(issues, "DESIGN_CONTRACT_BETA_RESPONSIVE", `${path}.viewport_id`, `${String(transformation.viewport_id)} is not a declared viewport`);
    requiredText(transformation.behavior, `${path}.behavior`, issues);
  }

  if (exactObject(contract.motion, ["policy", "reduced_motion_behavior", "transitions"], "motion", issues)) {
    if (!MOTION_POLICIES.has(contract.motion.policy)) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", "motion.policy", "motion.policy is unsupported");
    requiredText(contract.motion.reduced_motion_behavior, "motion.reduced_motion_behavior", issues);
    const transitions = records(contract.motion.transitions, "motion.transitions", issues, { maximum: 256 });
    if (contract.motion.policy !== "none" && transitions.length === 0) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", "motion.transitions", "active motion policy requires a transition");
    if (contract.motion.policy === "none" && transitions.length > 0) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", "motion.transitions", "motion policy none forbids transitions");
    for (const [index, transition] of transitions.entries()) {
      const path = `motion.transitions[${index}]`;
      exactObject(transition, ["id", "interaction_id", "duration_ms", "easing"], path, issues);
      if (!isPrefixedId(transition.id, "transition:")) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", `${path}.id`, "transition id must use the transition: prefix");
      else ids.push(transition.id);
      if (!isPrefixedId(transition.interaction_id, "interaction:") || !interactions.has(transition.interaction_id)) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", `${path}.interaction_id`, `${String(transition.interaction_id)} is not a declared interaction`);
      if (!Number.isInteger(transition.duration_ms) || transition.duration_ms < 0 || transition.duration_ms > 10_000) addIssue(issues, "DESIGN_CONTRACT_BETA_MOTION", `${path}.duration_ms`, "duration_ms must be an integer from 0 through 10000");
      requiredText(transition.easing, `${path}.easing`, issues);
    }
  }

  for (const [index, criterion] of records(contract.acceptance_criteria, "acceptance_criteria", issues, { minimum: 1, maximum: 256 }).entries()) {
    const path = `acceptance_criteria[${index}]`;
    exactObject(criterion, ["id", "observable", "verification", "required", "inventory_ids"], path, issues);
    if (!isPrefixedId(criterion.id, "criterion:")) addIssue(issues, "DESIGN_CONTRACT_BETA_CRITERION", `${path}.id`, "criterion id must use the criterion: prefix");
    else ids.push(criterion.id);
    requiredText(criterion.observable, `${path}.observable`, issues);
    if (!VERIFICATION_METHODS.has(criterion.verification)) addIssue(issues, "DESIGN_CONTRACT_BETA_CRITERION", `${path}.verification`, "criterion verification is unsupported");
    if (criterion.required !== true) addIssue(issues, "DESIGN_CONTRACT_BETA_CRITERION", `${path}.required`, "criterion required must be true");
    if (!Array.isArray(criterion.inventory_ids) || criterion.inventory_ids.length === 0
      || criterion.inventory_ids.length > 64
      || criterion.inventory_ids.length !== new Set(criterion.inventory_ids).size) {
      addIssue(issues, "DESIGN_CONTRACT_BETA_CRITERION", `${path}.inventory_ids`, "criterion must name 1 through 64 unique covered inventory ids");
    } else for (const id of criterion.inventory_ids) if (!inventoryIds.has(id)) addIssue(issues, "DESIGN_CONTRACT_BETA_CRITERION", `${path}.inventory_ids`, `${String(id)} is not declared in contract inventory`);
  }
  return ids;
}

// Taste is reported one defect at a time. A reviewer fixing a dial wants the dial named, not a
// list of every consequence of the same mistake.
function collectTasteIssues(contract, issues) {
  if (!Object.hasOwn(contract, "taste")) return;
  const taste = contract.taste;
  if (!isObject(taste)) {
    addIssue(issues, "DESIGN_CONTRACT_TASTE", "taste", "taste must be an object");
    return;
  }
  const unknown = Object.keys(taste).filter((key) => !TASTE_DIALS.includes(key));
  if (unknown.length > 0) {
    addIssue(issues, "DESIGN_CONTRACT_TASTE", "taste", `taste declares unknown dials ${unknown.join(", ")}`);
    return;
  }
  for (const dial of TASTE_DIALS) {
    const path = `taste.${dial}`;
    if (!Object.hasOwn(taste, dial)) {
      addIssue(issues, "DESIGN_CONTRACT_TASTE", path, `${path} is required whenever taste is declared`);
      return;
    }
    if (!Number.isInteger(taste[dial]) || taste[dial] < 1 || taste[dial] > 10) {
      addIssue(issues, "DESIGN_CONTRACT_TASTE", path, `${path} must be an integer from 1 through 10`);
      return;
    }
  }
}

// Identifiers are unique across the whole document, not merely within a group. Two surfaces
// that share an identifier cannot be told apart in an evidence record or a review receipt.
function collectIdCollisionIssues(contract, issues) {
  const declared = [
    { path: "contract_id", id: contract.contract_id },
    ...designContractInventoryEntries(contract).map(({ id, kind }) => ({ path: `inventory.${kind}`, id })),
  ];
  for (const field of ["omissions", "accepted_exceptions"]) {
    if (!Array.isArray(contract[field])) continue;
    contract[field].forEach((record, index) => {
      if (isObject(record)) declared.push({ path: `${field}[${index}].id`, id: record.id });
    });
  }
  const seen = new Set();
  for (const { path, id } of declared) {
    if (typeof id !== "string") continue;
    if (seen.has(id)) {
      issues.push({
        code: "DESIGN_CONTRACT_ID_COLLISION",
        path,
        message: `${id} is declared more than once in this contract`,
      });
      continue;
    }
    seen.add(id);
  }
}

export function collectDesignContractIssues(contract) {
  const issues = [];
  if (!isObject(contract)) {
    return [{
      code: "DESIGN_CONTRACT_NOT_OBJECT",
      path: "",
      message: "a Design Contract must be a JSON object",
    }];
  }
  const beta2 = contract.schema_id === DESIGN_SCHEMA_BETA2;
  const beta = beta2 || contract.schema_id === DESIGN_SCHEMA_BETA;
  const requiredKeys = beta ? DESIGN_CONTRACT_BETA_ROOT_KEYS : DESIGN_CONTRACT_ROOT_KEYS;
  const allowedKeys = beta2 ? [...requiredKeys, ...DESIGN_CONTRACT_BETA2_OPTIONAL_KEYS] : requiredKeys;
  const missing = requiredKeys.filter((key) => !Object.hasOwn(contract, key));
  const unknown = Object.keys(contract).filter((key) => !allowedKeys.includes(key));
  if (missing.length > 0) {
    issues.push({
      code: "DESIGN_CONTRACT_ROOT_KEYS",
      path: "",
      message: `the contract is missing ${missing.join(", ")}`,
    });
  }
  if (unknown.length > 0) {
    issues.push({
      code: "DESIGN_CONTRACT_ROOT_KEYS",
      path: "",
      message: `the contract declares unknown root keys ${unknown.join(", ")}`,
    });
  }
  // Root keys must all be present before group rules can say anything meaningful.
  if (missing.length > 0) return issues;
  collectIdentityIssues(contract, issues);
  collectSurfaceIssues(contract, issues);
  collectInventoryIssues(contract, issues);
  if (beta) {
    collectTasteIssues(contract, issues);
    const betaIds = collectBetaIssues(contract, issues);
    const existingIds = new Set([
      contract.contract_id,
      ...designContractInventoryEntries(contract).map(({ id }) => id),
      ...(Array.isArray(contract.omissions) ? contract.omissions.map(({ id }) => id) : []),
      ...(Array.isArray(contract.accepted_exceptions)
        ? contract.accepted_exceptions.map(({ id }) => id)
        : []),
    ]);
    for (const id of betaIds) {
      if (existingIds.has(id)) addIssue(issues, "DESIGN_CONTRACT_ID_COLLISION", "", `${id} is declared more than once in this contract`);
      existingIds.add(id);
    }
  }
  collectIdCollisionIssues(contract, issues);
  return issues;
}

export function designContractReport(contract) {
  const issues = collectDesignContractIssues(contract);
  const beta2 = isObject(contract) && contract.schema_id === DESIGN_SCHEMA_BETA2;
  const beta = beta2 || (isObject(contract) && contract.schema_id === DESIGN_SCHEMA_BETA);
  const alpha = isObject(contract) && contract.schema_id === DESIGN_SCHEMA;
  const valid = issues.length === 0;
  return {
    valid,
    schema: beta2 ? DESIGN_SCHEMA_BETA2 : (beta ? DESIGN_SCHEMA_BETA : DESIGN_SCHEMA),
    issues,
    diagnostics: alpha ? ["LEGACY_SCHEMA_V1ALPHA1"] : [],
    evidence_eligible: beta && valid,
  };
}

// Throwing wrapper for callers that treat an invalid contract as an exception, such as the
// evidence lane binding a contract to a manifest hash.
export function validateDesignContractValue(contract) {
  const issues = collectDesignContractIssues(contract);
  if (issues.length === 0) return;
  const [first] = issues;
  throw new UiuxContractError(first.code, first.message, {
    issue_count: issues.length,
    issues,
  });
}
