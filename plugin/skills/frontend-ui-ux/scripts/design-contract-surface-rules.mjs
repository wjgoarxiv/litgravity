// Non-inventory rule groups of litfamily.design-contract/v1alpha1.
//
// The JSON Schema document mirrors these rules for editors and reviewers, but a schema
// document is inert: nothing in the runtime reads it. Every rule that must actually hold is
// executed here and reported as a structured issue.
import { isStableId, isUtcTimestamp } from "./design-contract-format.mjs";

// A single literal target. Not a pattern and not an enum: the contract binds one conformance
// target so that two contracts are comparable without interpreting a range.
export const ACCESSIBILITY_TARGET = "WCAG 2.2 AA";

export const TOKEN_STRATEGIES = Object.freeze(["reuse", "extend", "create"]);

export const EVIDENCE_CHANNELS = Object.freeze([
  "tests", "browser", "keyboard", "accessibility-tree", "screen-reader", "performance",
  "localization",
]);

const ACCESSIBILITY_FLAGS = Object.freeze([
  "keyboard", "screen_reader", "reduced_motion", "forced_colors",
]);

const LOCALIZATION_FLAGS = Object.freeze([
  "cjk_line_break_review", "font_fallback_review", "ime_review", "rtl_review",
]);

const LOCALE_TAG = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/u;

const TEXT_MAX_LENGTH = 512;

const PHRASE_MAX_ITEMS = 32;

const SCOPE_MAX_ITEMS = 64;

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Trimmed, single-line, bounded. A field that needs a paragraph belongs in a reference
// document, not in a machine-compared contract value.
export function isText(value) {
  if (typeof value !== "string") return false;
  const length = Array.from(value).length;
  return length > 0 && length <= TEXT_MAX_LENGTH && value.trim() === value
    && !/[\n\r\t]/u.test(value);
}

export function isStrictBoolean(value) {
  return typeof value === "boolean";
}

export function isBoundedInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function isBoundedNumber(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isPhraseList(value, { minimum, maximum = PHRASE_MAX_ITEMS }) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
    && value.length === new Set(value).size && value.every(isText);
}

function keySet(value, required, optional = []) {
  if (!isObject(value)) return { missing: required, unknown: [] };
  const allowed = new Set([...required, ...optional]);
  return {
    missing: required.filter((field) => !Object.hasOwn(value, field)),
    unknown: Object.keys(value).filter((field) => !allowed.has(field)),
  };
}

// Closed objects everywhere. An unknown key is a silent design decision nobody reviewed, so
// it fails rather than being ignored.
export function collectKeyIssues(issues, value, path, code, required, optional = []) {
  if (!isObject(value)) {
    issues.push({ code, path, message: `${path} must be an object` });
    return false;
  }
  const { missing, unknown } = keySet(value, required, optional);
  if (missing.length > 0) {
    issues.push({ code, path, message: `${path} is missing ${missing.join(", ")}` });
  }
  if (unknown.length > 0) {
    issues.push({ code, path, message: `${path} declares unknown keys ${unknown.join(", ")}` });
  }
  return missing.length === 0 && unknown.length === 0;
}

function collectIntentIssues(issues, intent) {
  const code = "DESIGN_CONTRACT_INTENT";
  if (!collectKeyIssues(issues, intent, "intent", code, [
    "audiences", "tasks", "qualities", "constraints", "non_goals",
  ])) return;
  for (const field of ["audiences", "tasks", "qualities"]) {
    if (!isPhraseList(intent[field], { minimum: 1 })) {
      issues.push({
        code,
        path: `intent.${field}`,
        message: `intent.${field} needs 1..${PHRASE_MAX_ITEMS} unique non-empty entries`,
      });
    }
  }
  for (const field of ["constraints", "non_goals"]) {
    if (!isPhraseList(intent[field], { minimum: 0 })) {
      issues.push({
        code,
        path: `intent.${field}`,
        message: `intent.${field} must be an array of at most ${PHRASE_MAX_ITEMS} unique non-empty entries`,
      });
    }
  }
}

function collectDirectionIssues(issues, direction) {
  const code = "DESIGN_CONTRACT_DIRECTION";
  if (!collectKeyIssues(issues, direction, "direction", code, [
    "name", "principles", "token_strategy", "voice",
  ])) return;
  for (const field of ["name", "voice"]) {
    if (!isText(direction[field])) {
      issues.push({ code, path: `direction.${field}`, message: `direction.${field} must be one bounded line` });
    }
  }
  // Three principles is the minimum that expresses a direction; more than seven is a wish
  // list nobody can apply as a tie-breaker.
  if (!isPhraseList(direction.principles, { minimum: 3, maximum: 7 })) {
    issues.push({
      code,
      path: "direction.principles",
      message: "direction.principles needs 3..7 unique non-empty entries",
    });
  }
  if (!TOKEN_STRATEGIES.includes(direction.token_strategy)) {
    issues.push({
      code,
      path: "direction.token_strategy",
      message: `direction.token_strategy must be one of ${TOKEN_STRATEGIES.join(", ")}`,
    });
  }
}

function collectAccessibilityIssues(issues, accessibility) {
  const code = "DESIGN_CONTRACT_ACCESSIBILITY";
  if (!collectKeyIssues(issues, accessibility, "accessibility", code, [
    "target", ...ACCESSIBILITY_FLAGS, "zoom_percent",
  ])) return;
  if (accessibility.target !== ACCESSIBILITY_TARGET) {
    issues.push({
      code,
      path: "accessibility.target",
      message: `accessibility.target must equal ${JSON.stringify(ACCESSIBILITY_TARGET)}`,
    });
  }
  for (const flag of ACCESSIBILITY_FLAGS) {
    if (!isStrictBoolean(accessibility[flag])) {
      issues.push({
        code,
        path: `accessibility.${flag}`,
        message: `accessibility.${flag} must be true or false, not a truthy value`,
      });
    }
  }
  if (!isBoundedInteger(accessibility.zoom_percent, 200, 400)) {
    issues.push({
      code,
      path: "accessibility.zoom_percent",
      message: "accessibility.zoom_percent must be an integer from 200 through 400",
    });
  }
}

function collectLocalizationIssues(issues, localization) {
  const code = "DESIGN_CONTRACT_LOCALIZATION";
  if (!collectKeyIssues(issues, localization, "localization", code, [
    "locales", "text_expansion_percent", ...LOCALIZATION_FLAGS,
  ])) return;
  if (!isPhraseList(localization.locales, { minimum: 1 })
    || !localization.locales.every((locale) => LOCALE_TAG.test(locale))) {
    issues.push({
      code,
      path: "localization.locales",
      message: "localization.locales needs at least one unique language tag such as ko-KR",
    });
  }
  if (!isBoundedInteger(localization.text_expansion_percent, 0, 300)) {
    issues.push({
      code,
      path: "localization.text_expansion_percent",
      message: "localization.text_expansion_percent must be an integer from 0 through 300",
    });
  }
  for (const flag of LOCALIZATION_FLAGS) {
    if (!isStrictBoolean(localization[flag])) {
      issues.push({
        code,
        path: `localization.${flag}`,
        message: `localization.${flag} must be true or false, not a truthy value`,
      });
    }
  }
}

// Every dimension is bounded on both sides. An open-ended budget is not a budget, and a
// missing upper bound is how a regression gets accepted as "within contract".
function collectPerformanceIssues(issues, performance) {
  const code = "DESIGN_CONTRACT_PERFORMANCE";
  if (!collectKeyIssues(issues, performance, "performance", code, [
    "lcp_ms", "cls", "inp_ms", "initial_js_kb", "initial_css_kb",
  ])) return;
  for (const field of ["lcp_ms", "inp_ms"]) {
    if (!isBoundedInteger(performance[field], 1, 60000)) {
      issues.push({
        code,
        path: `performance.${field}`,
        message: `performance.${field} must be an integer from 1 through 60000`,
      });
    }
  }
  if (!isBoundedNumber(performance.cls, 0, 1)) {
    issues.push({
      code,
      path: "performance.cls",
      message: "performance.cls must be a finite number from 0 through 1",
    });
  }
  for (const field of ["initial_js_kb", "initial_css_kb"]) {
    if (!isBoundedInteger(performance[field], 0, 1048576)) {
      issues.push({
        code,
        path: `performance.${field}`,
        message: `performance.${field} must be an integer from 0 through 1048576`,
      });
    }
  }
}

function collectEvidencePolicyIssues(issues, policy) {
  const code = "DESIGN_CONTRACT_EVIDENCE_POLICY";
  if (!collectKeyIssues(issues, policy, "evidence_policy", code, [
    "independent_review_required", "required_channels", "cleanup_required",
  ])) return;
  for (const field of ["independent_review_required", "cleanup_required"]) {
    if (!isStrictBoolean(policy[field])) {
      issues.push({
        code,
        path: `evidence_policy.${field}`,
        message: `evidence_policy.${field} must be true or false, not a truthy value`,
      });
    }
  }
  const channels = policy.required_channels;
  if (!Array.isArray(channels) || channels.length < 1
    || channels.length > EVIDENCE_CHANNELS.length
    || channels.length !== new Set(channels).size
    || !channels.every((channel) => EVIDENCE_CHANNELS.includes(channel))) {
    issues.push({
      code,
      path: "evidence_policy.required_channels",
      message: `evidence_policy.required_channels must be a non-empty unique subset of ${EVIDENCE_CHANNELS.join(", ")}`,
    });
  }
}

// Omissions and accepted exceptions are the only places where a contract may leave something
// undone, so both carry a named owner. `expires_at` is optional: an undated record is a
// standing decision, and a dated one must be a strict UTC instant.
function collectScopeRecordIssues(issues, records, field) {
  const code = "DESIGN_CONTRACT_SCOPE_RECORD";
  if (!Array.isArray(records) || records.length > SCOPE_MAX_ITEMS) {
    issues.push({
      code,
      path: field,
      message: `${field} must be an array of at most ${SCOPE_MAX_ITEMS} records`,
    });
    return;
  }
  records.forEach((record, index) => {
    const path = `${field}[${index}]`;
    if (!collectKeyIssues(issues, record, path, code, ["id", "reason", "owner"], ["expires_at"])) return;
    if (!isStableId(record.id)) {
      issues.push({
        code: "DESIGN_CONTRACT_ID_GRAMMAR",
        path: `${path}.id`,
        message: `${path}.id must be a typed lowercase identifier`,
      });
    }
    for (const key of ["reason", "owner"]) {
      if (!isText(record[key])) {
        issues.push({ code, path: `${path}.${key}`, message: `${path}.${key} must be one bounded line` });
      }
    }
    if (Object.hasOwn(record, "expires_at") && !isUtcTimestamp(record.expires_at)) {
      issues.push({
        code: "DESIGN_CONTRACT_TIMESTAMP",
        path: `${path}.expires_at`,
        message: `${path}.expires_at must be a strict UTC instant such as 2026-08-01T00:00:00.000Z`,
      });
    }
  });
}

export function collectSurfaceIssues(contract, issues) {
  collectIntentIssues(issues, contract.intent);
  collectDirectionIssues(issues, contract.direction);
  collectAccessibilityIssues(issues, contract.accessibility);
  collectLocalizationIssues(issues, contract.localization);
  collectPerformanceIssues(issues, contract.performance);
  collectEvidencePolicyIssues(issues, contract.evidence_policy);
  collectScopeRecordIssues(issues, contract.omissions, "omissions");
  collectScopeRecordIssues(issues, contract.accepted_exceptions, "accepted_exceptions");
}
