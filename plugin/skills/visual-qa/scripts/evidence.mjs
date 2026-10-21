import { decodeStrictUtf8, parseStrictJson, stableJson } from "./strict-json.mjs";
import {
  DESIGN_CONTRACT_BETA_SCHEMA,
  DESIGN_CONTRACT_BETA2_SCHEMA,
  DESIGN_CONTRACT_SCHEMA,
  designContractShapeValid,
  designContractSurfaces,
} from "./design-contract-shape.mjs";
import { VisualQaError } from "./errors.mjs";
import { evidenceSemanticCodes } from "./evidence-semantic.mjs";
import { assertEvidenceRoot, readBoundArtifact, readStrictJson, sha256 } from "./evidence-io.mjs";
import { decodePng } from "./png-decode.mjs";
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_SCHEMA,
  EVIDENCE_SCHEMA_BETA,
  evidenceShapeValid,
} from "./evidence-shape.mjs";
import {
  REVIEW_SCHEMA,
  reviewShapeValid,
  validateReviewSet,
} from "./review-rules.mjs";

const REVIEW_MAX_BYTES = 1024 * 1024;
const ID = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9./-]*$/u;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueIds(items) {
  const ids = items.map(({ id }) => id);
  return ids.length === new Set(ids).size;
}

function capabilityCodes(capabilities, tier) {
  const mapping = [
    ["capture", "BLOCKED_RENDERER_UNAVAILABLE"],
    ["auth", "BLOCKED_AUTH_UNAVAILABLE"],
    ["test_account_safe", "BLOCKED_TEST_ACCOUNT_UNSAFE"],
    ["independent_review", "BLOCKED_INDEPENDENT_REVIEW_UNAVAILABLE"],
    ["image", "BLOCKED_IMAGE_UNAVAILABLE"],
    ["terminal", "BLOCKED_TERMINAL_UNAVAILABLE"],
  ];
  return mapping
    .filter(([field]) => !(tier === "smoke" && field === "independent_review"))
    .filter(([field]) => capabilities[field] !== true)
    .map(([, code]) => code);
}

// A capture is only attributable if the manifest says which renderer produced it and who owned
// that process. These two fields are the manifest's entire ownership record, so a placeholder in
// either one means ownership was never established -- the capability to attribute the capture
// was absent, which is a blocker rather than a product defect.
const UNVERIFIED_OWNER = new Set([
  "unknown", "unverified", "none", "n/a", "na", "null", "nil", "tbd", "pending", "-", "?",
]);

function ownershipCodes(environment) {
  const declared = [environment.renderer, environment.process_owner];
  return declared.some((value) => UNVERIFIED_OWNER.has(value.trim().toLowerCase()))
    ? ["BLOCKED_RENDERER_OWNERSHIP_UNVERIFIED"]
    : [];
}

// Cleanup has two separable questions. Did the run release what it created, and does the
// recorded status agree with the recorded resources? An honest incomplete cleanup is a missing
// capability and blocks; a status that contradicts its own resource list is an incoherent claim
// and fails.
function cleanupCodes(cleanup) {
  const leaked = cleanup.resources.some(({ state }) => state === "leaked");
  const claimsComplete = cleanup.status === "complete";
  if (claimsComplete === leaked) return ["CLEANUP_INCOMPLETE"];
  return leaked ? ["BLOCKED_CLEANUP_INCOMPLETE"] : [];
}

function materialTimeCodes(metadata, nowTime, maximumAge) {
  if (!metadata || !Number.isFinite(metadata.mtimeMs) || !Number.isFinite(metadata.ctimeMs)) {
    return ["BLOCKED_EVIDENCE_FRESHNESS_UNPROVEN"];
  }
  if (metadata.mtimeMs > nowTime) return ["BLOCKED_EVIDENCE_FUTURE"];
  if (nowTime - metadata.mtimeMs > maximumAge * 1000) return ["BLOCKED_EVIDENCE_STALE"];
  return [];
}

function inventoryCodes(manifest, artifactIds, nowTime) {
  const codes = [];
  const currentException = (item) => object(item.exception)
    && Number.isFinite(Date.parse(item.exception.expiry))
    && Date.parse(item.exception.expiry) > nowTime;
  const validException = (item) => item.status === "accepted_exception"
    && currentException(item);
  const captured = manifest.inventory.filter((item) => item.status === "captured" || validException(item));
  // Kinds a full run must have exercised. Authentication is no longer one of them: the
  // Design Contract now couples an auth-required route to a safe test surface itself, so a
  // contract that reaches this point has already proved that binding.
  const required = manifest.tier === "smoke"
    ? ["route", "interaction", "viewport"]
    : ["route", "state", "viewport", "interaction"];
  if (required.some((kind) => !captured.some((item) => item.kind === kind))
    || captured.filter(({ kind }) => kind === "viewport").length < 2
    || manifest.inventory.some((item) =>
      (!["captured", "not_applicable"].includes(item.status) && !validException(item))
      || item.evidence_ids.length < 1
      || item.evidence_ids.some((id) => !artifactIds.has(id)))) {
    codes.push("INVENTORY_INCOMPLETE");
  }
  if (manifest.inventory.some((item) =>
    (Object.hasOwn(item, "exception") && !currentException(item))
    || (item.status === "accepted_exception" && !validException(item)))) {
    codes.push("EXCEPTION_INVALID");
  }
  if (manifest.tier === "reference-fidelity"
    && (!captured.some(({ kind }) => kind === "reference")
      || manifest.mechanical_results.some((result) =>
        result.kind === "image-diff" && result.metrics.dimensionsMatch !== true))) {
    codes.push("REFERENCE_FIDELITY_FAILED");
  }
  return codes;
}

function artifactCodes(manifestPath, manifest, nowTime) {
  const codes = [];
  const dimensions = new Map();
  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    if (seen.has(artifact.id)) codes.push("EVIDENCE_ARTIFACT_ID_INVALID");
    seen.add(artifact.id);
    const result = readBoundArtifact(manifestPath, artifact);
    if (!result.valid) codes.push(result.failureCode ?? "EVIDENCE_ARTIFACT_HASH_INVALID");
    if (!["source", "reference"].includes(artifact.kind)) {
      codes.push(...materialTimeCodes(result.metadata, nowTime, manifest.maximum_age));
    }
    if (manifest.schema_id === EVIDENCE_SCHEMA_BETA && artifact.kind === "capture" && result.valid) {
      try {
        const image = decodePng(result.content);
        dimensions.set(artifact.id, { width: image.width, height: image.height });
        if (artifact.id === manifest.capture_id
          && (image.width !== manifest.capture_environment.viewport.width
          || image.height !== manifest.capture_environment.viewport.height)) {
          codes.push("EVIDENCE_CAPTURE_DIMENSIONS_INVALID");
        }
      } catch {
        codes.push("EVIDENCE_CAPTURE_INVALID");
      }
    }
    // Past the freshness bound and ahead of the clock are different faults. An artifact dated
    // after `now` was not observed; folding it into staleness let an unreadable clock be
    // reported as merely old evidence.
    const created = Date.parse(artifact.created_at);
    if (created > nowTime) codes.push("BLOCKED_EVIDENCE_FUTURE");
    else if (nowTime - created > manifest.maximum_age * 1000) {
      codes.push("BLOCKED_EVIDENCE_STALE");
    }
  }
  const source = manifest.artifacts.find(({ kind }) => kind === "source");
  const capture = manifest.artifacts.find(({ id }) => id === manifest.capture_id);
  if (!source || source.sha256 !== manifest.source_hash
    || !capture || capture.kind !== "capture" || capture.sha256 !== manifest.capture_hash) {
    codes.push("EVIDENCE_ARTIFACT_BINDING_INVALID");
  }
  return { codes: [...new Set(codes)], dimensions };
}

// Evidence records an accepted exception with an `expiry`; the Design Contract records the
// same decision as an accepted exception with an optional `expires_at`. Only a dated contract
// record can back an evidence exception, so an undated standing decision is absent here and
// fails closed at the reference check.
function contractExceptions(contract) {
  return contract.accepted_exceptions
    .filter((item) => Object.hasOwn(item, "expires_at"))
    .map(({ id, owner, reason, expires_at: expiry }) => ({ id, owner, reason, expiry }));
}

function contractResult(path, manifest) {
  const contract = readBoundArtifact(path, {
    path: manifest.design_contract_path,
    sha256: manifest.design_contract_hash,
  }, 1024 * 1024);
  if (!contract.valid) return { codes: ["EVIDENCE_CONTRACT_HASH_INVALID"], inventory: [] };
  try {
    const value = parseStrictJson(decodeStrictUtf8(contract.content));
    if (!designContractShapeValid(value)) {
      return { codes: ["EVIDENCE_CONTRACT_INVALID"], inventory: [] };
    }
    if (manifest.schema_id === EVIDENCE_SCHEMA_BETA
      && ![DESIGN_CONTRACT_BETA_SCHEMA, DESIGN_CONTRACT_BETA2_SCHEMA].includes(value.schema_id)) {
      return {
        codes: [value.schema_id === DESIGN_CONTRACT_SCHEMA
          ? "EVIDENCE_CONTRACT_SCHEMA_LEGACY"
          : "EVIDENCE_CONTRACT_INVALID"],
        inventory: [],
      };
    }
    return {
      codes: [],
      // The contract groups its inventory by kind; evidence accounts for a flat surface list.
      // References are excluded on both sides: their identity is already bound by hash.
      inventory: designContractSurfaces(value).filter(({ kind }) => kind !== "reference"),
      exceptions: contractExceptions(value),
      primaryRoutes: value.inventory.routes.filter(({ primary }) => primary).map(({ id }) => id),
      criticalInteractions: value.inventory.interactions.filter(({ critical }) => critical).map(({ id }) => id),
      negativeStates: value.inventory.states
        .filter(({ kind }) => ["empty", "error", "disabled", "permission", "offline"].includes(kind))
        .map(({ id }) => id),
      viewports: value.inventory.viewports.map(({ id, width_px: width, height_px: height }) => ({ id, width, height })),
    };
  } catch {
    return { codes: ["EVIDENCE_CONTRACT_INVALID"], inventory: [] };
  }
}

export function validateEvidence(path, {
  tier,
  now,
  currentSourceHash,
  currentSourceRevision,
} = {}) {
  assertEvidenceRoot(path);
  const { metadata: manifestMetadata, value: manifest } = readStrictJson(
    path,
    EVIDENCE_MAX_BYTES,
    "EVIDENCE_INVALID_JSON",
  );
  if (!evidenceShapeValid(manifest)) {
    throw new VisualQaError("EVIDENCE_SCHEMA_INVALID", "manifest shape or bounded fields are invalid");
  }
  if (tier !== manifest.tier) throw new VisualQaError("EVIDENCE_TIER_INVALID", `tier mismatch: ${tier}`);
  const nowTime = Date.parse(now);
  if (!Number.isFinite(nowTime)) throw new VisualQaError("EVIDENCE_TIME_INVALID", "--now must be ISO time");
  const blocked = capabilityCodes(manifest.capabilities, manifest.tier);
  blocked.push(...ownershipCodes(manifest.capture_environment));
  const failures = [];
  const beta = manifest.schema_id === EVIDENCE_SCHEMA_BETA;
  if (beta) {
    // This package has no host capture adapter that can bind creation time to a trusted
    // in-process capture event, and Node 22 on supported macOS does not expose openat or a
    // working descriptor-relative /dev/fd directory path. Public JSON, mtime, hashes, and
    // caller-supplied "current" strings are observations, not authority. Keep pathname
    // diagnostics useful, but never let them unlock beta PASS.
    blocked.push("BLOCKED_EVIDENCE_FRESHNESS_UNPROVEN", "BLOCKED_EVIDENCE_ROOT_UNPROVEN");
  }
  if (beta && manifest.tier !== "smoke") {
    // The host can spawn reviewer agents (invoke_subagent), but this package has no host-owned provenance
    // adapter that can prove a receipt was emitted by those identities. Self-attested JSON
    // therefore cannot unlock full/reference-fidelity PASS.
    blocked.push("BLOCKED_INDEPENDENT_REVIEW_UNAVAILABLE");
  }
  // Freshness and clock coherence are checked separately, and the source binding is checked
  // independently of both: a manifest dated ahead of the clock is not stale, but it can still
  // be bound to the wrong revision, and both facts have to survive into the report.
  const createdAt = Date.parse(manifest.created_at);
  if (Number.isFinite(createdAt) && createdAt > nowTime) {
    blocked.push("BLOCKED_EVIDENCE_FUTURE");
  }
  if (!Number.isFinite(createdAt)
    || (createdAt <= nowTime && nowTime - createdAt > manifest.maximum_age * 1000)
    || (currentSourceHash && currentSourceHash !== manifest.source_hash)
    || (currentSourceRevision && currentSourceRevision !== manifest.source_revision)) {
    blocked.push("BLOCKED_EVIDENCE_STALE");
  }
  if (beta) {
    blocked.push(...materialTimeCodes(manifestMetadata, nowTime, manifest.maximum_age));
    if (!currentSourceHash || !currentSourceRevision) {
      blocked.push("BLOCKED_EVIDENCE_FRESHNESS_UNPROVEN");
    }
  }
  const artifactResults = artifactCodes(path, manifest, nowTime);
  for (const code of artifactResults.codes) {
    (code.startsWith("BLOCKED_") ? blocked : failures).push(code);
  }
  const contract = contractResult(path, manifest);
  failures.push(...contract.codes);
  if (contract.codes.length === 0) {
    const expected = new Map(contract.inventory.map(({ id, kind }) => [id, kind]));
    const actual = manifest.inventory.filter(({ kind }) => kind !== "reference");
    if ((manifest.tier !== "smoke"
      && (actual.length !== expected.size || actual.some(({ id, kind }) => expected.get(id) !== kind)))
      || (beta && manifest.tier === "smoke"
        && actual.some(({ id, kind }) => expected.get(id) !== kind))) {
      failures.push("EVIDENCE_CONTRACT_INVENTORY_MISMATCH");
    }
    if (beta && manifest.tier === "smoke") {
      const capturedIds = new Set(actual.filter(({ status }) => status === "captured").map(({ id }) => id));
      const widths = contract.viewports.map(({ width }) => width);
      const boundaryViewports = contract.viewports.filter(({ width }) =>
        width === Math.min(...widths) || width === Math.max(...widths));
      const requiredIds = [
        ...contract.primaryRoutes,
        ...contract.criticalInteractions,
        ...boundaryViewports.map(({ id }) => id),
      ];
      if (requiredIds.some((id) => !capturedIds.has(id))
        || (contract.negativeStates.length > 0
          && !contract.negativeStates.some((id) => capturedIds.has(id)))) {
        failures.push("INVENTORY_INCOMPLETE");
      }
    }
    if (beta && contract.viewports.some((viewport) => {
      const item = actual.find(({ id, kind, status }) =>
        id === viewport.id && kind === "viewport" && status === "captured");
      if (!item) return false;
      return !item.evidence_ids.some((artifactId) => {
        const artifact = manifest.artifacts.find(({ id }) => id === artifactId);
        const observed = artifactResults.dimensions.get(artifactId);
        return artifact?.kind === "capture" && observed?.width === viewport.width
          && observed?.height === viewport.height;
      });
    })) failures.push("EVIDENCE_VIEWPORT_BINDING_INVALID");
  }
  const artifactById = new Map(manifest.artifacts.map((artifact) => [artifact.id, artifact]));
  const artifactIds = new Set(artifactById.keys());
  failures.push(...inventoryCodes(manifest, artifactIds, nowTime));
  failures.push(...evidenceSemanticCodes(manifest, artifactById));
  if (contract.codes.length === 0) {
    const allowedExceptions = new Map(contract.exceptions.map((item) => [item.id, item]));
    if (manifest.exception_references.some((id) => {
      const item = allowedExceptions.get(id);
      return !item || Date.parse(item.expiry) <= nowTime;
    })
      || manifest.inventory.some((item) =>
        Object.hasOwn(item, "exception")
        && (!manifest.exception_references.includes(item.exception.id)
          || stableJson(item.exception) !== stableJson(allowedExceptions.get(item.exception.id))))) {
      failures.push("EXCEPTION_REFERENCE_INVALID");
    }
  }
  if (!uniqueIds(manifest.inventory) || !uniqueIds(manifest.mechanical_results)
    || manifest.mechanical_results.some((result) =>
      result.status !== "PASS"
      || result.artifact_ids.length < 1
      || result.artifact_ids.some((id) => !artifactIds.has(id)))) {
    failures.push("MECHANICAL_RESULTS_INCOMPLETE");
  }
  if (!Array.isArray(manifest.cleanup.resources)
    || manifest.cleanup.resources.some((item) =>
      !ID.test(item.id) || !["cleaned", "leaked"].includes(item.state)
      || typeof item.receipt !== "string" || item.receipt.length === 0)) {
    failures.push("CLEANUP_INCOMPLETE");
  } else {
    for (const code of cleanupCodes(manifest.cleanup)) {
      (code.startsWith("BLOCKED_") ? blocked : failures).push(code);
    }
  }
  const artifactsHash = sha256(stableJson(
    manifest.artifacts.map(({ id, sha256: hash }) => ({ id, sha256: hash })),
  ));
  const review = validateReviewSet(manifest.review_receipts, manifest.review_receipt_hashes, {
    design_contract_hash: manifest.design_contract_hash,
    source_hash: manifest.source_hash,
    capture_hash: manifest.capture_hash,
    artifacts_hash: artifactsHash,
  }, manifest.inventory.map(({ id }) => id), artifactIds, nowTime, manifest.maximum_age,
    manifest.tier !== "smoke" && !beta);
  blocked.push(...review.blocked);
  failures.push(...review.failures);
  let validationVerdict = blocked.length > 0 ? "BLOCKED" : failures.length > 0 ? "FAIL" : "PASS";
  if (manifest.verdict !== validationVerdict) {
    failures.push("EVIDENCE_VERDICT_INCOHERENT");
    if (validationVerdict === "PASS") validationVerdict = "FAIL";
  }
  const outputBlocked = beta ? blocked : [...blocked, "BLOCKED_LEGACY_EVIDENCE_SCHEMA"];
  const verdict = beta ? validationVerdict : "BLOCKED";
  return {
    command: "validate-evidence", schema_id: manifest.schema_id, tier, verdict,
    evidence_eligible: beta && verdict === "PASS",
    blocked_codes: [...new Set(outputBlocked)], failure_codes: [...new Set(failures)],
    codes: [...new Set([...outputBlocked, ...failures])],
    artifact_count: manifest.artifacts.length,
    review_count: manifest.review_receipts.length,
    ...(beta ? {} : {
      diagnostics: ["LEGACY_SCHEMA_V1ALPHA1"],
      compatibility: {
        manifest_verdict: manifest.verdict,
        validation_verdict: validationVerdict,
        evidence_eligible: false,
      },
    }),
  };
}

export function validateReviewReceipt(path) {
  const { value: receipt } = readStrictJson(path, REVIEW_MAX_BYTES, "REVIEW_RECEIPT_INVALID_JSON");
  if (!reviewShapeValid(receipt)) {
    throw new VisualQaError("REVIEW_RECEIPT_SCHEMA_INVALID", "receipt shape is invalid");
  }
  const blocked = [];
  if (receipt.timeout) blocked.push("BLOCKED_REVIEW_TIMEOUT");
  if (receipt.cancelled) blocked.push("BLOCKED_REVIEW_CANCELLED");
  if (!receipt.independence_assertion || receipt.peer_draft_received || receipt.implementer_context) {
    blocked.push("BLOCKED_INDEPENDENT_REVIEW_UNAVAILABLE");
  }
  const failures = [];
  if (receipt.findings.some(({ severity, blocking }) =>
    ["P0", "P1"].includes(severity) && blocking !== true)) {
    failures.push("REVIEW_FINDING_INVALID");
  }
  if (receipt.findings.some(({ severity, blocking }) =>
    blocking || ["P0", "P1"].includes(severity))) {
    failures.push("REVIEW_BLOCKING_FINDING");
  }
  if (receipt.verdict === "PASS" && (blocked.length > 0 || failures.length > 0)) {
    failures.push("REVIEW_RECEIPT_VERDICT_INCOHERENT");
  }
  if (receipt.verdict === "BLOCKED" && blocked.length === 0) {
    failures.push("REVIEW_RECEIPT_VERDICT_INCOHERENT");
  }
  if (receipt.verdict !== "PASS") failures.push("REVIEW_RECEIPT_NOT_PASS");
  const verdict = blocked.length > 0
    ? "BLOCKED"
    : failures.length > 0 || receipt.verdict !== "PASS" ? "FAIL" : "PASS";
  return {
    command: "validate-review", schema_id: REVIEW_SCHEMA,
    verdict, blocked_codes: [...new Set(blocked)],
    failure_codes: [...new Set(failures)],
    codes: [...new Set([...blocked, ...failures])],
    review_id: receipt.review_id,
    fresh_context_id: receipt.fresh_context_id,
  };
}
