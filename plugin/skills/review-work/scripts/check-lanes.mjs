#!/usr/bin/env node
// Structural check for a review packet written by review-work. Dependency-free Node ESM. Reads one JSON file and
// writes nothing.
//
//   node check-lanes.mjs <review.json>
//
// Work packet:  {"mode":"work","objective","scope":[..],"lanes":{goal,qa,quality,security,context}}
//   each lane:  {"verdict":"PASS|FAIL|BLOCKED","confidence":"HIGH|MEDIUM|LOW","summary","evidence":[..],
//                "findings":[{"severity":"BLOCKER|MAJOR|MINOR|NOTE","path","line"?,"text"}],"limitations":[..]}
// Plan packet:  {"mode":"plan","plan":"plans/x.md","verdict":"PASS|ITERATE|NEEDS-CONTEXT",
//                "dimensions":{scope,achievability,decisions,atomicity,acceptance,guardrails,qa_scenarios,order_cleanup},
//                "findings":[..]}   each dimension: {"result":"PASS|FAIL","evidence":"text"}
//
// Exit 0 when the packet is well formed (the aggregate verdict is printed), 1 when it is malformed, 2 on usage errors.
// The check covers structure. A complete packet that cites invented paths still fails the review, so the parent
// opens the paths it cites.

import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORK_LANES = ['goal', 'qa', 'quality', 'security', 'context'];
const PLAN_DIMENSIONS = ['scope', 'achievability', 'decisions', 'atomicity', 'acceptance', 'guardrails', 'qa_scenarios', 'order_cleanup'];
const LANE_VERDICTS = new Set(['PASS', 'FAIL', 'BLOCKED']);
const PLAN_VERDICTS = new Set(['PASS', 'ITERATE', 'NEEDS-CONTEXT']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const SEVERITY = new Set(['BLOCKER', 'MAJOR', 'MINOR', 'NOTE']);
const MAX_BYTES = 1024 * 1024;

function fail(code, detail, exit = 1) {
  process.stderr.write(`FAIL ${code}: ${detail}\n`);
  process.exit(exit);
}

const text = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const [packetPath, ...extra] = process.argv.slice(2);
if (!packetPath || extra.length) fail('USAGE', 'check-lanes.mjs <review.json>', 2);

let packet;
try {
  const path = resolve(packetPath);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error('packet must be a regular file under 1 MiB');
  packet = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  fail('PACKET_READ', error.message);
}
if (!isObject(packet)) fail('PACKET_INVALID', 'top level must be an object');

function checkFindings(list, where) {
  if (!Array.isArray(list)) fail('FINDINGS_INVALID', `${where} findings must be an array`);
  list.forEach((f, i) => {
    if (!isObject(f)) fail('FINDING_INVALID', `${where}[${i}] must be an object`);
    if (!SEVERITY.has(f.severity)) fail('FINDING_SEVERITY', `${where}[${i}] ${String(f.severity)}`);
    if (!text(f.text)) fail('FINDING_TEXT', `${where}[${i}]`);
    if (!text(f.path)) fail('FINDING_PATH', `${where}[${i}] needs a path (file or command)`);
    if (f.line !== undefined && !(Number.isInteger(f.line) && f.line > 0)) fail('FINDING_LINE', `${where}[${i}]`);
  });
  return list.length;
}

if (packet.mode === 'work') {
  if (!text(packet.objective)) fail('FIELD_MISSING', 'objective');
  if (!Array.isArray(packet.scope) || !packet.scope.length || !packet.scope.every(text)) {
    fail('FIELD_INVALID', 'scope must be a nonempty string array');
  }
  if (!isObject(packet.lanes)) fail('FIELD_INVALID', 'lanes must be an object');
  for (const lane of WORK_LANES) if (!Object.hasOwn(packet.lanes, lane)) fail('LANE_MISSING', lane);
  for (const lane of Object.keys(packet.lanes)) if (!WORK_LANES.includes(lane)) fail('LANE_UNKNOWN', lane);

  let findings = 0;
  const verdicts = [];
  for (const lane of WORK_LANES) {
    const r = packet.lanes[lane];
    if (!isObject(r)) fail('LANE_INVALID', lane);
    if (!LANE_VERDICTS.has(r.verdict)) fail('LANE_VERDICT_INVALID', `${lane} ${String(r.verdict)}`);
    if (!CONFIDENCE.has(r.confidence)) fail('LANE_CONFIDENCE_INVALID', `${lane} ${String(r.confidence)}`);
    if (!text(r.summary)) fail('LANE_SUMMARY_MISSING', lane);
    if (!Array.isArray(r.evidence) || !r.evidence.length || !r.evidence.every(text)) fail('LANE_EVIDENCE_MISSING', lane);
    if (!Array.isArray(r.limitations)) fail('LANE_LIMITATIONS_INVALID', lane);
    findings += checkFindings(r.findings, lane);
    const blocking = r.findings.some((f) => f.severity === 'BLOCKER' || f.severity === 'MAJOR');
    if (r.verdict === 'PASS' && blocking) fail('LANE_PASS_WITH_BLOCKING', `${lane} is PASS but carries a BLOCKER or MAJOR finding`);
    if (r.verdict === 'FAIL' && !blocking) fail('LANE_FAIL_WITHOUT_BLOCKING', `${lane} is FAIL but has no BLOCKER or MAJOR finding`);
    if (r.verdict === 'BLOCKED' && !r.limitations.length) fail('LANE_BLOCKED_WITHOUT_REASON', `${lane} needs a limitation that names the reason`);
    verdicts.push(r.verdict);
  }
  const overall = verdicts.includes('FAIL') ? 'REVIEW FAILED' : verdicts.includes('BLOCKED') ? 'REVIEW BLOCKED' : 'REVIEW PASSED';
  process.stdout.write(`${overall} lanes=${WORK_LANES.length} findings=${findings}\n`);
} else if (packet.mode === 'plan') {
  if (!text(packet.plan)) fail('FIELD_MISSING', 'plan');
  if (!PLAN_VERDICTS.has(packet.verdict)) fail('PLAN_VERDICT_INVALID', String(packet.verdict));
  if (!isObject(packet.dimensions)) fail('FIELD_INVALID', 'dimensions must be an object');
  for (const d of PLAN_DIMENSIONS) if (!Object.hasOwn(packet.dimensions, d)) fail('DIMENSION_MISSING', d);
  for (const d of Object.keys(packet.dimensions)) if (!PLAN_DIMENSIONS.includes(d)) fail('DIMENSION_UNKNOWN', d);
  let failing = 0;
  for (const d of PLAN_DIMENSIONS) {
    const r = packet.dimensions[d];
    if (!isObject(r) || !['PASS', 'FAIL'].includes(r.result) || !text(r.evidence)) fail('DIMENSION_INVALID', d);
    if (r.result === 'FAIL') failing += 1;
  }
  const findings = checkFindings(packet.findings, 'plan');
  if (packet.verdict === 'PASS' && failing) fail('PLAN_PASS_WITH_FAILING_DIMENSION', `${failing} dimension(s) FAIL`);
  if (packet.verdict === 'ITERATE' && !failing && !findings) fail('PLAN_ITERATE_WITHOUT_DEFECT', 'ITERATE needs a failing dimension or a finding');
  process.stdout.write(`PLAN ${packet.verdict} dimensions=${PLAN_DIMENSIONS.length} failing=${failing} findings=${findings}\n`);
} else {
  fail('MODE_INVALID', `mode must be "work" or "plan", got ${String(packet.mode)}`);
}
