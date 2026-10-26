#!/usr/bin/env node
// Interface probe: renders a page in the locally installed headless Chrome at the responsive matrix, runs the
// in-page measurement module, saves one screenshot per viewport, and reports findings.
//
//   node interface-probe.mjs <page.html | directory | http(s) URL> [--out <dir>] [--static]
//                            [--viewports 320,390,...] [--json]
//
// Exit 0: all seven matrix rows ran and no measured or derived HIGH finding remains. Exit 1: at
// least one such HIGH finding (this wins over an incomplete matrix). Exit 2: BLOCKED, printed as
// one `BLOCKED: <reason>` line, including a matrix row that did not run. A blocked run still
// reports the static findings and lists every rendered rule as not verified; it never reads as a
// pass. Nothing here installs or downloads a browser: the driver is the Chrome or Chromium found by
// chrome-driver.mjs (CHROME_PATH overrides). The browser is only resized, opened, read, hovered
// (CF-506) and screenshotted; nothing is clicked, pressed or submitted.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ChromeSession, probeChrome } from "./chrome-driver.mjs";
import { measureLock } from "./interface-probe-lock.mjs";
import { measureInterface, readHover } from "./interface-probe-page.mjs";
import { BLOCKED_REASON, EXIT, LIMITS, MATRIX, RULES, SEVERITY_ORDER } from "./interface-probe-rules.mjs";
import { staticProbe } from "./interface-probe-static.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const options = { target: null, out: null, static: false, json: false, viewports: null, lock: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") options.out = argv[++index];
    else if (arg === "--static") options.static = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--lock") options.lock = argv[++index];
    else if (arg === "--viewports") options.viewports = argv[++index]?.split(",").map((value) => value.trim()).filter(Boolean);
    else if (!arg.startsWith("--") && options.target === null) options.target = arg;
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!options.target) throw new Error("usage: interface-probe.mjs <page.html | directory | URL> [--out <dir>] [--static] [--viewports ids] [--lock design.lock.json] [--json]");
  return options;
}

// A local target is served from its directory; a directory serves its built or root index.html.
export function resolveTarget(target) {
  if (/^https?:\/\//iu.test(target)) return { url: target, root: null, page: null, sourceRoot: null };
  const path = resolve(target.startsWith("file://") ? fileURLToPath(target) : target);
  if (!existsSync(path)) return { missing: `target not found: ${path}` };
  if (statSync(path).isFile()) return { url: null, root: dirname(path), page: basename(path), sourceRoot: path };
  const page = ["dist/index.html", "build/index.html", "out/index.html", "index.html", "public/index.html"].find((candidate) => existsSync(join(path, candidate)));
  if (!page) return { missing: `no index.html under ${path}`, sourceRoot: path };
  return { url: null, root: path, page, sourceRoot: path };
}

function startServer(root) {
  const child = spawn(process.execPath, [join(SCRIPT_DIR, "interface-probe-server.mjs"), root], { stdio: ["ignore", "pipe", "ignore"] });
  return new Promise((resolvePort, reject) => {
    let buffer = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("local file server did not start")); }, 10_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const match = /LISTENING (\d+)/u.exec(buffer);
      if (match) {
        clearTimeout(timer);
        resolvePort({ port: Number(match[1]), stop: () => child.kill("SIGTERM") });
      }
    });
    child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`local file server exited ${code}`)); });
  });
}

async function probeViewport(chrome, url, viewport, outDir, lock) {
  let tab = null;
  try {
    tab = await chrome.newTab();
    await tab.setup(viewport);
    await tab.open(url, LIMITS.settleMs);
    const hover = RULES["CF-506"]?.threshold;
    // A lock with offset elevation is the recorded neo-brutalist register CF-403 accepts.
    const probeOpts = { rules: RULES, limits: LIMITS, touch: viewport.touch, pass: viewport.pass, hoverSample: hover && viewport.id === hover.viewport ? hover.sample : 0, register: lock?.elevation === "offset" ? "neo-brutalist" : null, density: lock?.density ?? null };
    let measured = await tab.evaluate(measureInterface, probeOpts);
    // A page still loading after the settle wait gets exactly one more wait, then counts as unsettled.
    if (measured.ready === "loading") {
      await new Promise((resolveWait) => setTimeout(resolveWait, LIMITS.settleMs));
      measured = await tab.evaluate(measureInterface, probeOpts);
      if (measured.ready === "loading") return { viewport: viewport.id, error: "page did not settle" };
    }
    if (lock) {
      const locked = await tab.evaluate(measureLock, { rules: RULES, limits: LIMITS, lock, pass: viewport.pass });
      if (locked.error) measured.notVerified.push({ rule: "DS-001", reason: `design-lock pass failed: ${locked.error.slice(0, 120)}` });
      else {
        measured.findings.push(...(locked.findings ?? []));
        measured.notVerified.push(...(locked.notVerified ?? []));
      }
    }
    const path = join(outDir, "screenshots", `${viewport.id}.png`);
    let shot = true;
    try { await tab.screenshot(path); } catch { shot = false; }
    const findings = measured.findings.map((finding) => ({ ...finding, viewport: viewport.id }));
    const notVerified = measured.notVerified.map((entry) => ({ ...entry, viewport: viewport.id }));
    // CF-506: a real :hover on at most `sample` repeated controls, after the screenshot.
    for (const target of measured.hoverTargets ?? []) {
      let read;
      try {
        await tab.hover(target.selector);
        read = await tab.evaluate(readHover, target.selector);
      } catch (error) {
        read = { error: error.message };
      }
      if (read.error || !read.found || !read.hover) {
        notVerified.push({ rule: "CF-506", viewport: viewport.id, reason: `${target.name}: hover did not reach :hover` });
      } else if (read.durationMs > hover.maxMs) {
        findings.push({ rule: "CF-506", severity: RULES["CF-506"].severity, tier: RULES["CF-506"].tier, viewport: viewport.id, selector: target.name, value: `${Math.round(read.durationMs)}ms hover transition (${read.property})`, threshold: `≤ ${hover.maxMs}ms` });
      }
    }
    return {
      viewport: viewport.id,
      screenshot: shot && existsSync(path) ? { viewport: viewport.id, path, bytes: statSync(path).size } : null,
      findings,
      notVerified,
    };
  } catch (error) {
    return { viewport: viewport.id, error: error.message };
  } finally {
    await tab?.close();
  }
}

const severityRank = (severity) => SEVERITY_ORDER.indexOf(severity);
const blockingHigh = (findings) => findings.filter((finding) => finding.severity === "HIGH" && finding.tier !== "not_verified");

// MD-007 review table: Severity | Rule | Where | Measured | Fix, one row per rule and place.
export function renderTable(report) {
  const rows = new Map();
  for (const finding of report.findings) {
    const key = `${finding.rule}|${finding.selector}|${finding.severity}`;
    const row = rows.get(key) ?? { ...finding, viewports: [] };
    row.viewports.push(finding.viewport);
    rows.set(key, row);
  }
  const sorted = [...rows.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.rule.localeCompare(b.rule));
  const cell = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/gu, " ");
  const lines = [
    `Interface probe — ${report.manifest.url ?? "no page reached"}`,
    "",
    "| Severity | Rule | Where | Measured | Fix |",
    "| --- | --- | --- | --- | --- |",
    ...sorted.map((row) => {
      const where = row.viewport === "static" ? row.selector : `${row.selector ?? "page"} @ ${row.viewports.join(", ")}`;
      const measured = `${row.value ?? ""}${row.threshold ? ` (want ${row.threshold})` : ""} [${row.tier}]${row.note ? ` ${row.note}` : ""}`;
      return `| ${row.severity} | ${row.rule} | ${cell(where)} | ${cell(measured)} | ${cell(RULES[row.rule]?.fix)} |`;
    }),
  ];
  if (sorted.length === 0) lines.push("| — | — | — | no findings | — |");
  const grouped = (entries) => {
    const map = new Map();
    for (const entry of entries) {
      const key = `${entry.rule}: ${entry.reason.replace(/^judgment: /u, "")}`;
      map.set(key, [...(map.get(key) ?? []), ...(entry.viewport ? [entry.viewport] : [])]);
    }
    return [...map].map(([key, viewports]) => `- ${key}${viewports.length ? ` (${viewports.join(", ")})` : ""}`);
  };
  const judgment = report.manifest.not_verified.filter((entry) => entry.reason.startsWith("judgment: "));
  const unrun = report.manifest.not_verified.filter((entry) => !entry.reason.startsWith("judgment: "));
  if (judgment.length) lines.push("", "Judgment calls (Inferred until a reviewer decides; severity applies only once confirmed):", ...grouped(judgment));
  if (unrun.length) lines.push("", "Not verified:", ...grouped(unrun));
  const high = blockingHigh(report.findings).length;
  lines.push("", `Verdict: ${report.manifest.blocked_reason ? `BLOCKED: ${report.manifest.blocked_reason}` : high ? `Block (${high} HIGH)` : "Approve (0 HIGH)"}`);
  return lines.join("\n");
}

// C.5: a driver or entry blocker is exit 2; otherwise a measured or derived HIGH is exit 1 (even
// with rows missing); otherwise any missing matrix row is exit 2; otherwise exit 0.
export function decideExit({ findings, viewportsRun, blockedReason }) {
  if (blockedReason) return { exitCode: EXIT.blocked, blockedReason };
  if (blockingHigh(findings).length) return { exitCode: EXIT.high, blockedReason: null };
  const skipped = MATRIX.map(({ id }) => id).filter((id) => !viewportsRun.includes(id));
  if (skipped.length) return { exitCode: EXIT.blocked, blockedReason: `${BLOCKED_REASON.matrixIncomplete} (${skipped.join(", ")})` };
  return { exitCode: EXIT.clean, blockedReason: null };
}

// The design lock beside the page (or named by --lock) turns on the DS-* rules. A lock that cannot
// be parsed is reported but does not block the rest of the probe.
function findLock(options, target) {
  const candidates = [options.lock, target.root, target.sourceRoot && dirname(target.sourceRoot)]
    .filter(Boolean).map((dir) => join(dir, "design.lock.json"));
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const lock = JSON.parse(readFileSync(path, "utf8"));
      if (lock.schema_id !== "litfamily.design-lock/v1" || typeof lock.style !== "string") return { lock: null, path, error: "design.lock.json is not a litfamily.design-lock/v1 file" };
      return { lock, path, error: null };
    } catch (error) {
      return { lock: null, path, error: `design.lock.json unreadable: ${error.message}` };
    }
  }
  return { lock: null, path: null, error: null };
}

export async function runProbe(options) {
  const started = Date.now();
  const target = resolveTarget(options.target);
  const outDir = resolve(options.out ?? mkdtempSync(join(tmpdir(), "litgravity-interface-probe-")));
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  const matrix = options.viewports ? MATRIX.filter((viewport) => options.viewports.includes(viewport.id)) : MATRIX;
  const lockState = findLock(options, target);
  const lock = lockState.lock;
  const manifest = {
    url: target.url ?? (target.sourceRoot ? pathToFileURL(target.sourceRoot).href : null),
    viewports_run: [],
    browser_version: null,
    zoom_emulation: "viewport-halved",
    design_lock: null,
    not_verified: [],
    screenshots: [],
    exit_code: EXIT.blocked,
    blocked_reason: null,
  };
  if (lock) manifest.design_lock = { path: lockState.path, style: lock.style, family: lock.family ?? null };
  else manifest.not_verified.push({ rule: "DS-001", reason: lockState.error ?? "no design.lock.json beside the page; lock conformance not checked" });
  const findings = [];

  const driver = options.static || target.missing ? null : probeChrome();
  const driverReady = driver?.status === "available";
  if (driver?.version) manifest.browser_version = driver.version;

  if (driverReady) {
    let server = null;
    const chrome = new ChromeSession(driver.command);
    try {
      await chrome.start();
      let url = target.url;
      if (!url) {
        server = await startServer(target.root);
        url = `http://127.0.0.1:${server.port}/${target.page.split("/").map(encodeURIComponent).join("/")}`;
      }
      manifest.url = url;
      for (const viewport of matrix) {
        if (Date.now() - started > LIMITS.totalBudgetMs) {
          manifest.not_verified.push({ rule: "*", viewport: viewport.id, reason: "time budget exceeded" });
          continue;
        }
        const passStarted = Date.now();
        const result = await probeViewport(chrome, url, viewport, outDir, lock);
        if (result.error) {
          manifest.not_verified.push({ rule: "*", viewport: viewport.id, reason: result.error.slice(0, 160) });
          continue;
        }
        if (Date.now() - passStarted > LIMITS.viewportBudgetMs) manifest.not_verified.push({ rule: "*", viewport: viewport.id, reason: "viewport pass exceeded its time budget; results kept" });
        manifest.viewports_run.push(viewport.id);
        findings.push(...result.findings);
        manifest.not_verified.push(...result.notVerified);
        if (result.screenshot) manifest.screenshots.push(result.screenshot);
      }
    } catch (error) {
      manifest.blocked_reason = `${BLOCKED_REASON.BLOCKED_BROWSER_DRIVER_UNAVAILABLE}: ${error.message}`.slice(0, 200);
    } finally {
      server?.stop();
      if (!(await chrome.stop())) manifest.blocked_reason = BLOCKED_REASON.BLOCKED_BROWSER_DRIVER_CLEANUP_FAILED;
    }
    // RS-002: a dark pass that adds new HIGH contrast findings over the light 390 pass.
    const highContrast = (viewport) => new Set(findings.filter((f) => f.viewport === viewport && f.rule === "CF-201" && f.severity === "HIGH").map((f) => f.selector));
    if (manifest.viewports_run.includes("390-dark") && manifest.viewports_run.includes("390")) {
      const light = highContrast("390");
      const added = [...highContrast("390-dark")].filter((selector) => !light.has(selector));
      if (added.length) findings.push({ rule: "RS-002", severity: RULES["RS-002"].severity, tier: "derived", viewport: "390-dark", selector: added.slice(0, 3).join(" | "), value: `${added.length} new HIGH contrast finding(s) in dark`, threshold: "no new HIGH contrast finding in dark" });
    }
  }

  if (!manifest.blocked_reason) {
    if (target.missing) manifest.blocked_reason = BLOCKED_REASON.noEntry;
    else if (options.static) manifest.blocked_reason = "static run requested; rendered rules not verified";
    else if (!driverReady) manifest.blocked_reason = `${BLOCKED_REASON[driver?.blocker] ?? BLOCKED_REASON.BLOCKED_BROWSER_DRIVER_UNAVAILABLE}${driver?.detail ? ` (${driver.detail})` : ""}`;
  }
  if (manifest.viewports_run.length === 0) {
    if (target.sourceRoot && existsSync(target.sourceRoot)) {
      const fallback = staticProbe(target.sourceRoot);
      findings.push(...fallback.findings);
      manifest.not_verified.push(...fallback.notVerified);
    } else {
      manifest.not_verified.push(...Object.keys(RULES).map((rule) => ({ rule, reason: "nothing could be read or rendered" })));
    }
  }

  const skipped = MATRIX.map(({ id }) => id).filter((id) => !manifest.viewports_run.includes(id));
  for (const id of skipped) if (!manifest.not_verified.some((entry) => entry.rule === "*" && entry.viewport === id)) manifest.not_verified.push({ rule: "*", viewport: id, reason: "matrix row did not run" });
  const decision = decideExit({ findings, viewportsRun: manifest.viewports_run, blockedReason: manifest.blocked_reason });
  manifest.blocked_reason = decision.blockedReason;
  manifest.exit_code = decision.exitCode;
  const report = { manifest, findings };
  writeFileSync(join(outDir, "findings.json"), `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, outDir };
}

// Compare real paths: started through a symlink (macOS /var is one), a resolved path never
// equals this module's path and the probe would exit 0 having done nothing.
const startedDirectly = () => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (startedDirectly()) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stdout.write(`BLOCKED: ${error.message}\n`);
    process.exit(EXIT.blocked);
  }
  runProbe(options).then((report) => {
    if (report.manifest.blocked_reason) process.stdout.write(`BLOCKED: ${report.manifest.blocked_reason}\n`);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${renderTable(report)}\n\nFindings: ${join(report.outDir, "findings.json")}\n`);
    process.exitCode = report.manifest.exit_code;
  }, (error) => {
    process.stdout.write(`BLOCKED: ${error.message}\n`);
    process.exitCode = EXIT.blocked;
  });
}
