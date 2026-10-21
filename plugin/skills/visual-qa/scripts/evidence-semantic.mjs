const CAPTURE_KINDS = new Set([
  "route", "region", "component", "state", "interaction", "viewport", "screen",
  "terminal-size",
]);
const SOURCE_KINDS = new Set(["auth", "theme", "permission"]);
const REFERENCE_KINDS = new Set(["reference", "reference-comparison"]);
const MECHANICAL_KINDS = new Set([
  "tui-check", "image-diff", "accessibility-check", "interaction-check",
]);

function hasBoolean(metrics, field) {
  return typeof metrics[field] === "boolean";
}

function mechanicalMetricsValid(result) {
  const { kind, metrics, status } = result;
  if (!MECHANICAL_KINDS.has(kind)) return false;
  if (kind === "tui-check") {
    return ["topology_valid", "control_sequences_valid", "unicode_width_valid"]
      .every((field) => hasBoolean(metrics, field))
      && (status !== "PASS" || Object.values(metrics).every((value) => value === true));
  }
  if (kind === "image-diff") {
    return hasBoolean(metrics, "dimensionsMatch")
      && (status !== "PASS" || metrics.dimensionsMatch === true);
  }
  if (kind === "accessibility-check") {
    return Number.isInteger(metrics.violations) && metrics.violations >= 0
      && (status !== "PASS" || metrics.violations === 0);
  }
  return Number.isInteger(metrics.assertions_total) && metrics.assertions_total > 0
    && Number.isInteger(metrics.assertions_failed) && metrics.assertions_failed >= 0
    && (status !== "PASS" || metrics.assertions_failed === 0);
}

function intersects(left, right) {
  const candidates = new Set(right);
  return left.some((id) => candidates.has(id));
}

function applicableMechanicsValid(manifest, artifactById) {
  const passing = manifest.mechanical_results.filter(({ status }) => status === "PASS");
  const terminals = manifest.inventory.filter(
    ({ kind, status }) => kind === "terminal-size" && status === "captured",
  );
  const comparisons = manifest.inventory.filter(
    ({ kind, status }) =>
      ["reference", "reference-comparison"].includes(kind) && status === "captured",
  );
  const tuiValid = terminals.every((item) => passing.some((result) =>
    result.kind === "tui-check" && intersects(result.artifact_ids, item.evidence_ids)));
  const captureIds = manifest.artifacts.filter(({ kind }) => kind === "capture").map(({ id }) => id);
  const imageValid = comparisons.every((item) => passing.some((result) =>
    result.kind === "image-diff"
    && intersects(result.artifact_ids, item.evidence_ids)
    && intersects(result.artifact_ids, captureIds)
    && result.artifact_ids.every((id) => artifactById.has(id))));
  return tuiValid && imageValid;
}

export function evidenceSemanticCodes(manifest, artifactById) {
  const codes = [];
  for (const item of manifest.inventory) {
    const kinds = item.evidence_ids.map((id) => artifactById.get(id)?.kind);
    const required = CAPTURE_KINDS.has(item.kind) ? "capture"
      : SOURCE_KINDS.has(item.kind) ? "source"
        : REFERENCE_KINDS.has(item.kind) ? "reference" : undefined;
    if (item.status === "captured" && required && !kinds.includes(required)) {
      codes.push("INVENTORY_EVIDENCE_BINDING_INVALID");
    }
  }
  if (manifest.mechanical_results.some((result) => !mechanicalMetricsValid(result))
    || !applicableMechanicsValid(manifest, artifactById)) {
    codes.push("MECHANICAL_RESULTS_INCOMPLETE");
  }
  const artifactIds = new Set(artifactById.keys());
  const findings = [
    ...manifest.open_findings,
    ...manifest.review_receipts.flatMap(({ findings }) => findings),
  ];
  if (findings.some((finding) =>
    finding.evidence_ids.some((id) => !artifactIds.has(id)))) {
    codes.push("REVIEW_FINDING_INVALID");
  }
  if (manifest.open_findings.some(({ severity, blocking }) =>
    blocking || ["P0", "P1"].includes(severity))) {
    codes.push("OPEN_FINDING_BLOCKING");
  }
  if (manifest.accessibility_results.some((result) =>
    result.status !== "PASS"
    || result.evidence_ids.some((id) => !artifactIds.has(id)))) {
    codes.push("ACCESSIBILITY_RESULTS_INCOMPLETE");
  }
  return [...new Set(codes)];
}
