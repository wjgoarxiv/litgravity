export const EVIDENCE_SCHEMA = "litfamily.evidence-manifest/v1alpha1";
export const EVIDENCE_SCHEMA_BETA = "litfamily.evidence-manifest/v1beta1";
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9./-]*$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const REQUIRED = [
  "schema_id", "tier", "design_contract_path", "design_contract_hash",
  "source_revision", "source_hash", "capture_id", "capture_hash", "created_at",
  "maximum_age", "capture_environment", "auth_owner", "capabilities", "inventory",
  "artifacts", "mechanical_results", "review_receipts", "review_receipt_hashes",
  "accessibility_results", "open_findings", "exception_references", "cleanup", "verdict",
];
const CAPABILITIES = [
  "capture", "auth", "test_account_safe", "independent_review", "image", "terminal",
];
const INVENTORY_KINDS = [
  "route", "region", "component", "state", "interaction", "viewport", "auth", "reference",
  "screen", "theme", "permission", "terminal-size", "reference-comparison",
];

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  return object(value) && required.every((field) => Object.hasOwn(value, field))
    && Object.keys(value).every((field) => allowed.has(field));
}

function ids(value, minimum = 0, maximum = 512, unique = false) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum
    && (!unique || value.length === new Set(value).size)
    && value.every((id) => ID.test(id));
}

function finiteTree(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (object(value)) return Object.values(value).every(finiteTree);
  return true;
}

function text(value, maximum = Number.POSITIVE_INFINITY) {
  return typeof value === "string" && Array.from(value).length <= maximum
    && /^\S(?:[^\n\r\t\u2028\u2029]*\S)?$/u.test(value);
}

function finding(value, maximum) {
  return exact(value, ["id", "severity", "blocking", "message", "evidence_ids"])
    && ID.test(value.id) && ["P0", "P1", "P2", "P3"].includes(value.severity)
    && typeof value.blocking === "boolean"
    && text(value.message, maximum)
    && ids(value.evidence_ids, 1, 128);
}

function exception(value, maximum) {
  return exact(value, ["id", "owner", "reason", "expiry"])
    && ID.test(value.id)
    && text(value.owner, maximum)
    && text(value.reason, maximum)
    && ISO.test(value.expiry) && Number.isFinite(Date.parse(value.expiry));
}

function environment(value, maximum) {
  const fields = [
    "backend", "renderer", "platform", "browser_version", "runtime_version",
    "font_set", "locale", "reduced_motion", "settling_policy", "color_scheme",
    "process_owner", "viewport",
  ];
  return exact(value, fields)
    && [
      "backend", "renderer", "platform", "browser_version", "runtime_version",
      "settling_policy", "process_owner",
    ].every((key) => text(value[key], maximum))
    && Array.isArray(value.font_set) && value.font_set.length >= 1
    && value.font_set.length <= 64
    && value.font_set.every((font) => text(font, maximum))
    && /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(value.locale)
    && typeof value.reduced_motion === "boolean"
    && ["light", "dark", "system"].includes(value.color_scheme)
    && exact(value.viewport, ["width", "height", "scale_factor"])
    && Number.isInteger(value.viewport.width)
    && value.viewport.width >= 1 && value.viewport.width <= 7680
    && Number.isInteger(value.viewport.height)
    && value.viewport.height >= 1 && value.viewport.height <= 4320
    && Number.isFinite(value.viewport.scale_factor)
    && value.viewport.scale_factor > 0 && value.viewport.scale_factor <= 8;
}

export function evidenceShapeValid(manifest) {
  const maximumTextLength = manifest?.schema_id === EVIDENCE_SCHEMA_BETA
    ? 512
    : Number.POSITIVE_INFINITY;
  if (!exact(manifest, REQUIRED)
    || ![EVIDENCE_SCHEMA, EVIDENCE_SCHEMA_BETA].includes(manifest.schema_id)
    || !["smoke", "full", "reference-fidelity"].includes(manifest.tier)
    || !safeEvidenceName(manifest.design_contract_path)
    || !HASH.test(manifest.design_contract_hash) || !ID.test(manifest.source_revision)
    || !HASH.test(manifest.source_hash) || !ID.test(manifest.capture_id)
    || !HASH.test(manifest.capture_hash) || !ISO.test(manifest.created_at)
    || !Number.isInteger(manifest.maximum_age) || manifest.maximum_age < 1
    || manifest.maximum_age > 86400 || !environment(manifest.capture_environment, maximumTextLength)
    || !text(manifest.auth_owner, maximumTextLength)
    || !exact(manifest.capabilities, CAPABILITIES)
    || CAPABILITIES.some((field) => typeof manifest.capabilities[field] !== "boolean")
    || !Array.isArray(manifest.inventory) || manifest.inventory.length < 1
    || manifest.inventory.length > 512 || !Array.isArray(manifest.artifacts)
    || manifest.artifacts.length < 2 || manifest.artifacts.length > 512
    || !Array.isArray(manifest.mechanical_results) || manifest.mechanical_results.length < 1
    || manifest.mechanical_results.length > 512
    || !Array.isArray(manifest.review_receipts) || !Array.isArray(manifest.review_receipt_hashes)
    || manifest.review_receipts.length > 2 || manifest.review_receipt_hashes.length > 2
    || !manifest.review_receipts.every(reviewShapeValid)
    || !manifest.review_receipt_hashes.every((hash) => HASH.test(hash))
    || (manifest.tier === "smoke"
      ? manifest.review_receipts.length !== 0 || manifest.review_receipt_hashes.length !== 0
      : manifest.review_receipts.length !== 2 || manifest.review_receipt_hashes.length !== 2)
    || !Array.isArray(manifest.accessibility_results) || manifest.accessibility_results.length < 1
    || manifest.accessibility_results.length > 256
    || !Array.isArray(manifest.open_findings) || manifest.open_findings.length > 256
    || !ids(manifest.exception_references, 0, 128, true)
    || !["PASS", "FAIL", "BLOCKED"].includes(manifest.verdict)) return false;
  if (!manifest.inventory.every((item) =>
    exact(item, ["id", "kind", "status", "evidence_ids"], ["exception"])
    && ID.test(item.id) && INVENTORY_KINDS.includes(item.kind)
    && ["captured", "not_applicable", "accepted_exception", "blocked"].includes(item.status)
    && ids(item.evidence_ids, 1)
    && (item.status !== "accepted_exception" || Object.hasOwn(item, "exception"))
    && (!Object.hasOwn(item, "exception") || exception(item.exception, maximumTextLength)))) return false;
  if (!manifest.artifacts.every((item) =>
    exact(item, ["id", "kind", "path", "sha256", "created_at"])
    && ID.test(item.id) && ["source", "capture", "reference", "report", "log"].includes(item.kind)
    && safeEvidenceName(item.path)
    && HASH.test(item.sha256) && ISO.test(item.created_at))) return false;
  if (!manifest.mechanical_results.every((item) =>
    exact(item, ["id", "kind", "status", "artifact_ids", "metrics"])
    && ID.test(item.id) && text(item.kind, maximumTextLength)
    && ["PASS", "FAIL", "BLOCKED"].includes(item.status)
    && ids(item.artifact_ids, 1) && object(item.metrics)
    && Object.keys(item.metrics).length > 0 && finiteTree(item.metrics))) return false;
  if (!manifest.accessibility_results.every((item) =>
    exact(item, ["id", "criterion", "status", "evidence_ids"])
    && ID.test(item.id) && /^\d+\.\d+\.\d+$/u.test(item.criterion)
    && ["PASS", "FAIL", "BLOCKED"].includes(item.status) && ids(item.evidence_ids, 1, 128))
    || !manifest.open_findings.every((item) => finding(item, maximumTextLength))) return false;
  // A run that could not release what it created must still be able to say so. Pinning the
  // shape to `complete`/`cleaned` made an honest incomplete cleanup unrepresentable, which
  // pushed it out as a schema error instead of the blocker it is. The shape now accepts both
  // outcomes; whether the claim is coherent, and whether it blocks, is decided in the
  // validator, not here.
  return exact(manifest.cleanup, ["status", "resources"])
    && ["complete", "incomplete"].includes(manifest.cleanup.status)
    && Array.isArray(manifest.cleanup.resources)
    && manifest.cleanup.resources.length <= 128
    && manifest.cleanup.resources.every((item) =>
      exact(item, ["id", "state", "receipt"]) && ID.test(item.id)
      && ["cleaned", "leaked"].includes(item.state)
      && text(item.receipt, maximumTextLength));
}
import { safeEvidenceName } from "./evidence-io.mjs";
import { reviewShapeValid } from "./review-rules.mjs";
