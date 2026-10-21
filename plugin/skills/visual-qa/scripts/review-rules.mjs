import { stableJson } from "./strict-json.mjs";
import { sha256 } from "./evidence-io.mjs";

export const REVIEW_SCHEMA = "litfamily.review-receipt/v1alpha1";
export const REVIEWERS = ["quality-reviewer", "lit-verifier"];
// A receipt may name the agent bare or as the namespaced subagent type (`litgravity/quality-reviewer`).
const reviewerIdentity = (id) => (typeof id === "string" && id.startsWith("litgravity/") ? id.slice("litgravity/".length) : id);
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9./-]*$/u;
const INPUT_KEYS = [
  "design_contract_hash", "source_hash", "capture_hash", "artifacts_hash",
];
const RECEIPT_KEYS = [
  "schema_id", "review_id", "fresh_context_id", "reviewer_capability", "input_hashes",
  "reviewed_inventory", "confidence", "findings", "independence_assertion",
  "peer_draft_received", "implementer_context",
  "started_at", "ended_at", "timeout", "cancelled", "verdict",
];
const FINDING_KEYS = ["id", "severity", "blocking", "message", "evidence_ids"];
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function reviewShapeValid(receipt) {
  if (!object(receipt) || RECEIPT_KEYS.some((field) => !Object.hasOwn(receipt, field))
    || Object.keys(receipt).some((field) => !RECEIPT_KEYS.includes(field))
    || receipt.schema_id !== REVIEW_SCHEMA
    || !ID.test(receipt.review_id) || !ID.test(receipt.fresh_context_id)
    || !REVIEWERS.includes(reviewerIdentity(receipt.reviewer_capability))
    || !object(receipt.input_hashes)
    || Object.keys(receipt.input_hashes).length !== INPUT_KEYS.length
    || Object.keys(receipt.input_hashes).some((key) => !INPUT_KEYS.includes(key))
    || INPUT_KEYS.some((key) => !Object.hasOwn(receipt.input_hashes, key))
    || INPUT_KEYS.some((key) => !HASH.test(receipt.input_hashes[key]))
    || !Array.isArray(receipt.reviewed_inventory)
    || receipt.reviewed_inventory.length < 1 || receipt.reviewed_inventory.length > 512
    || receipt.reviewed_inventory.length !== new Set(receipt.reviewed_inventory).size
    || receipt.reviewed_inventory.some((id) => !ID.test(id))
    || !["HIGH", "MEDIUM", "LOW"].includes(receipt.confidence)
    || !Array.isArray(receipt.findings)
    || receipt.findings.length > 256
    || typeof receipt.independence_assertion !== "boolean"
    || typeof receipt.peer_draft_received !== "boolean"
    || typeof receipt.implementer_context !== "boolean"
    || typeof receipt.timeout !== "boolean"
    || typeof receipt.cancelled !== "boolean"
    || !["PASS", "FAIL", "BLOCKED"].includes(receipt.verdict)) return false;
  if (!ISO_TIME.test(receipt.started_at) || !ISO_TIME.test(receipt.ended_at)) return false;
  const start = Date.parse(receipt.started_at);
  const end = Date.parse(receipt.ended_at);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    && receipt.findings.every((finding) => object(finding)
      && FINDING_KEYS.every((key) => Object.hasOwn(finding, key))
      && ID.test(finding.id)
      && ["P0", "P1", "P2", "P3"].includes(finding.severity)
      && typeof finding.blocking === "boolean"
      && typeof finding.message === "string"
      && finding.message.length > 0
      && Array.isArray(finding.evidence_ids)
      && finding.evidence_ids.length > 0
      && finding.evidence_ids.length <= 128
      && finding.evidence_ids.length === new Set(finding.evidence_ids).size
      && finding.evidence_ids.every((id) => ID.test(id))
      && Object.keys(finding).every((key) => FINDING_KEYS.includes(key)));
}

export function validateReviewSet(
  receipts, hashes, expectedInputs, expectedInventory, artifactIds, now, maximumAgeSeconds,
  required = true,
) {
  const blocked = [];
  const failures = [];
  if (!required) {
    if (Array.isArray(receipts) && receipts.length === 0
      && Array.isArray(hashes) && hashes.length === 0) {
      return { blocked, failures };
    }
    return { blocked, failures: ["REVIEW_RECEIPT_COUNT_INVALID"] };
  }
  if (!Array.isArray(receipts) || receipts.length !== 2
    || !Array.isArray(hashes) || hashes.length !== 2) {
    failures.push("REVIEW_RECEIPT_COUNT_INVALID");
    return { blocked, failures };
  }
  if (receipts.some((receipt) => !reviewShapeValid(receipt))) {
    failures.push("REVIEW_RECEIPT_SCHEMA_INVALID");
    return { blocked, failures };
  }
  if (new Set(receipts.map(({ reviewer_capability: id }) => reviewerIdentity(id))).size !== 2
    || new Set(receipts.map(({ review_id: id }) => id)).size !== 2
    || new Set(receipts.map(({ fresh_context_id: id }) => id)).size !== 2
    || receipts.some((receipt) =>
      receipt.review_id !== `review:${receipt.reviewer_capability}`
      || receipt.independence_assertion !== true
      || receipt.peer_draft_received !== false
      || receipt.implementer_context !== false)) {
    failures.push("REVIEW_RECEIPT_INDEPENDENCE_INVALID");
  }
  if (receipts.some((receipt) =>
    INPUT_KEYS.some((key) => receipt.input_hashes[key] !== expectedInputs[key]))) {
    failures.push("REVIEW_RECEIPT_INPUT_MISMATCH");
  }
  if (receipts.some((receipt) =>
    receipt.reviewed_inventory.length !== expectedInventory.length
    || receipt.reviewed_inventory.some((id, index) => id !== expectedInventory[index]))) {
    failures.push("REVIEW_RECEIPT_INVENTORY_MISMATCH");
  }
  if (receipts.some(({ findings }) => findings.some((finding) =>
    (["P0", "P1"].includes(finding.severity) && finding.blocking !== true)
    || finding.evidence_ids.some((id) => !artifactIds.has(id))))) {
    failures.push("REVIEW_FINDING_INVALID");
  }
  if (receipts.some((receipt, index) => sha256(stableJson(receipt)) !== hashes[index])) {
    failures.push("REVIEW_RECEIPT_HASH_INVALID");
  }
  if (receipts.some(({ timeout }) => timeout)) blocked.push("BLOCKED_REVIEW_TIMEOUT");
  if (receipts.some(({ cancelled }) => cancelled)) blocked.push("BLOCKED_REVIEW_CANCELLED");
  if (receipts.some(({ verdict }) => verdict !== "PASS")) failures.push("REVIEW_RECEIPT_NOT_PASS");
  if (receipts.some(({ findings }) => findings.some(({ blocking, severity }) =>
    blocking || ["P0", "P1"].includes(severity)))) {
    failures.push("REVIEW_BLOCKING_FINDING");
  }
  if (receipts.some((receipt) => receipt.verdict === "PASS"
    && (receipt.timeout || receipt.cancelled || receipt.findings.some(({ blocking, severity }) =>
      blocking || ["P0", "P1"].includes(severity))))) {
    failures.push("REVIEW_RECEIPT_VERDICT_INCOHERENT");
  }
  if (receipts.some(({ ended_at }) => Date.parse(ended_at) > now)) {
    failures.push("REVIEW_RECEIPT_TIMESTAMP_INVALID");
  }
  if (receipts.some(({ ended_at }) => now - Date.parse(ended_at) > maximumAgeSeconds * 1000)) {
    blocked.push("BLOCKED_EVIDENCE_STALE");
  }
  return { blocked: [...new Set(blocked)], failures: [...new Set(failures)] };
}
