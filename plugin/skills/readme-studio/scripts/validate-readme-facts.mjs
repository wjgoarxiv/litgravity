#!/usr/bin/env node
import { relative, resolve } from "node:path";
import { argumentsMap, boundedRead, inside } from "../templates/typography/safe-files.mjs";

const report = { valid: false, validation_scope: "structure-only", factual_accuracy: "not-checked", source_contents_compared: false, badge_truth_checked: false, issues: [] };
try {
  const args = argumentsMap(process.argv.slice(2), ["--project-root", "--facts"]);
  if (!args.get("--project-root") || !args.get("--facts")) throw new Error("PROJECT_ROOT_AND_FACTS_REQUIRED");
  const root = resolve(args.get("--project-root"));
  const factsPath = inside(root, relative(root, resolve(args.get("--facts"))).replaceAll("\\", "/"));
  const data = JSON.parse(boundedRead(factsPath, 1024 * 1024).toString("utf8"));
  if (!data || !Array.isArray(data.claims) || !data.claims.length || !Array.isArray(data.badges)) throw new Error("CLAIMS_AND_BADGES_REQUIRED");
  const ids = new Set();
  for (const claim of data.claims) {
    if (!claim || typeof claim.id !== "string" || !claim.id.trim() || ids.has(claim.id) || typeof claim.value !== "string" || !claim.value.trim()) throw new Error("INVALID_OR_DUPLICATE_CLAIM");
    ids.add(claim.id);
    boundedRead(inside(root, claim.source), 8 * 1024 * 1024);
  }
  for (const badge of data.badges) {
    if (!badge || typeof badge.label !== "string" || !badge.label.trim() || typeof badge.url !== "string" || /[\s\x00-\x1f\x7f]/u.test(badge.url)) throw new Error("INVALID_BADGE");
    const url = new URL(badge.url);
    if (!/^https?:\/\//u.test(badge.url) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("UNSAFE_BADGE_URL");
    boundedRead(inside(root, badge.source), 8 * 1024 * 1024);
  }
  report.valid = true;
} catch (error) { report.issues.push(error.message); }
console.log(JSON.stringify(report));
process.exitCode = report.valid ? 0 : 1;
