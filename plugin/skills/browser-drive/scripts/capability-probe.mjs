#!/usr/bin/env node
// Capability probe for the external browser driver this skill delegates to.
//
//   node capability-probe.mjs          one JSON object on stdout, exit 0 when a driver tier is usable
//
// Three tiers, best first: `agent-browser` (a snapshot-and-handle CLI whose version banner is checked
// below), an already-installed Playwright package with a browser build, and a bare Chrome or Chromium
// binary for one-shot page dumps and screenshots. The tier that is reported is the one the skill uses.
//
// It answers one question — may this session drive a browser, and by what exact command — and it
// answers it as data. Nothing here installs, downloads, or launches a browser. A missing driver is
// a normal result, not an exception, because "no driver" is the answer that most often decides the
// route.
//
// Resolving a name is not the same as verifying a tool. A command on PATH can carry the expected
// name and be something else entirely, so identity is checked against the version banner before the
// driver is reported as usable.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import process from "node:process";
import { containsSecret } from "./secret-shapes.mjs";
import { resolveOnPath, spawnPlan } from "../../../lib/host-exec.mjs";

const DRIVER_SOURCE = "vercel-labs/agent-browser";
export const DRIVER_COMMAND = "agent-browser";
export const BROWSER_PROCESS_CLEANUP_FAILED = "BROWSER_PROCESS_CLEANUP_FAILED";

export const BROWSER_DRIVE_BLOCKER = Object.freeze({
  unavailable: "BLOCKED_BROWSER_DRIVER_UNAVAILABLE",
  identity: "BLOCKED_BROWSER_IDENTITY_UNVERIFIED",
  cleanup: "BLOCKED_BROWSER_DRIVER_CLEANUP_FAILED",
});
const MAX_BANNER_CHARS = 200;
const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_VERSION_TIMEOUT_MS = 10_000;
const MAX_VERSION_TIMEOUT_MS = DEFAULT_VERSION_TIMEOUT_MS;
const VERIFIED_VERSION_FLOOR = "0.34.0";
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const BANNER_INSTRUCTION_PATTERN =
  /(?:^|[^A-Za-z0-9])(?:ignore|disregard|forget)[\s_-]+(?:(?:the|any|all|every)[\s_-]+)?(?:previous|prior|above|earlier)[\s_-]+instructions?\b/iu;
const BANNER_MARKUP_PATTERN = /(?:<\/?[A-Za-z][^>\r\n]{0,128}>|<!--|-->|<!\[CDATA\[|\{\{|\}\})/u;
const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\))/gu;
const RESIDUAL_CONTROL_OR_FORMAT_PATTERN = /[\p{Cc}\p{Cf}]/u;
const sanitizeLine = (raw) => raw.replace(ANSI_ESCAPE_PATTERN, "").trim();
const sleepSync = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

// Version output is untrusted data from a program this session did not write.
function meaningfulLines(text) {
  if (typeof text !== "string") return null;
  return text.split(/\r?\n/u).map(sanitizeLine).filter((line) => line !== "");
}

function firstMeaningfulLine(text) {
  const line = meaningfulLines(text)?.[0] ?? null;
  return line !== null && line.length <= MAX_BANNER_CHARS ? line : null;
}

function hasOverLimitMeaningfulLine(text) {
  return (meaningfulLines(text) ?? []).some((line) => line.length > MAX_BANNER_CHARS);
}

function hasResidualControlOrFormat(text) {
  return typeof text === "string"
    && text.split(/\r?\n/u).some((raw) => RESIDUAL_CONTROL_OR_FORMAT_PATTERN.test(raw.replace(ANSI_ESCAPE_PATTERN, "")));
}

function outputByteLength(value) {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  if (Buffer.isBuffer(value)) return value.byteLength;
  return 0;
}

function exceedsOutputLimit(resultValue) {
  return outputByteLength(resultValue?.stdout) + outputByteLength(resultValue?.stderr) > MAX_OUTPUT_BYTES;
}

function terminateOwnedProcessGroup(pid) {
  if (process.platform === "win32") return true;
  if (!Number.isSafeInteger(pid) || pid <= 1) return false;
  try { process.kill(-pid, "SIGTERM"); } catch (error) {
    // The wrapper may have exited and the numeric process-group id may already
    // belong to another user's group.  EPERM proves we did not signal it; the
    // original group is therefore gone and cleanup is complete for this run.
    return error?.code === "ESRCH" || error?.code === "EPERM";
  }
  sleepSync(25);
  // A terminated process group can disappear and its numeric id can be reused before the
  // second signal. Probe ownership first: EPERM means the old group is gone and the reused
  // group is not ours, so do not signal it. This avoids turning a successful cleanup into a
  // false denial for a legitimate driver while never sending SIGKILL to an unrelated group.
  try { process.kill(-pid, 0); } catch (error) {
    return error?.code === "ESRCH" || error?.code === "EPERM";
  }
  try {
    process.kill(-pid, "SIGKILL");
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return true;
    if (error?.code !== "EPERM") return false;
    // The group may have disappeared and been reused between the ownership probe and
    // SIGKILL. Confirm that no signalable member of our original group remains before
    // accepting the cleanup as complete.
    try {
      process.kill(-pid, 0);
      return false;
    } catch (probeError) {
      return probeError?.code === "ESRCH" || probeError?.code === "EPERM";
    }
  }
}

function cleanupFailure(resultValue) {
  return {
    ...resultValue,
    error: Object.assign(new Error("the browser process-group cleanup was not verified"), {
      code: BROWSER_PROCESS_CLEANUP_FAILED,
    }),
  };
}

const POSIX_DRIVER_WRAPPER = [
  "parent_pid=$1; mode=$2; shift 2",
  "group_pid=$$",
  "trap '' TERM INT HUP",
  "(",
  "  trap '' TERM INT HUP",
  "  while kill -0 \"$parent_pid\" 2>/dev/null; do /bin/sleep 0.02; done",
  "  kill -TERM -\"$group_pid\" 2>/dev/null",
  "  /bin/sleep 0.1",
  "  kill -KILL -\"$group_pid\" 2>/dev/null",
  ") >/dev/null 2>&1 &",
  "if [ \"$mode\" = \"shell\" ]; then",
  "  command \"$@\" </dev/null",
  "else",
  "  \"$@\" </dev/null",
  "fi",
  "status=$?",
  "exit \"$status\"",
].join("\n");

// Zero is the trap: spawnSync reads timeout 0 as "no timeout", so anything that is not a
// positive integer becomes the finite default instead of an unlimited wait.
const boundedVersionTimeout = (value) => Number.isInteger(value) && value > 0
  ? Math.min(value, MAX_VERSION_TIMEOUT_MS)
  : DEFAULT_VERSION_TIMEOUT_MS;

function outputLimitError() {
  return Object.assign(new Error("browser process output exceeded the safe limit"), { code: "ENOBUFS" });
}

/** Run a browser probe command synchronously with bounded output and owned cleanup. */
export function runBrowserCommand(command, args, options = {}) {
  const requestedMaxBuffer = Number.isSafeInteger(options.maxBuffer) && options.maxBuffer > 0
    ? options.maxBuffer
    : MAX_OUTPUT_BYTES;
  let resultValue;
  try {
    // A .cmd shim (agent-browser from npm) is refused without a shell since CVE-2024-27980; spawnPlan quotes it for cmd.exe.
    const windowsPlan = process.platform === "win32" ? spawnPlan(command, args, { env: options.env ?? process.env }) : null;
    resultValue = spawnSync(
      windowsPlan ? windowsPlan.command : "/bin/sh",
      windowsPlan
        ? windowsPlan.args
        : ["-c", POSIX_DRIVER_WRAPPER, "litgravity-browser-watch", String(process.pid), options.shell ? "shell" : "direct", command, ...args],
      {
        ...options,
        // POSIX gets an owned process group. Windows receives Node's direct-child timeout fallback.
        detached: process.platform !== "win32",
        shell: windowsPlan ? windowsPlan.shell : false,
        ...(process.platform === "win32" ? {} : { stdio: ["ignore", "pipe", "pipe"] }),
        // SIGTERM can be ignored, and spawnSync keeps waiting for a child that ignores it — the
        // timeout only stays a bound if the kill is one the child cannot swallow.
        killSignal: "SIGKILL",
        maxBuffer: Math.min(requestedMaxBuffer, MAX_OUTPUT_BYTES),
      },
    );
  } catch {
    return null;
  }
  const processWasStarted = process.platform !== "win32"
    && Number.isSafeInteger(resultValue?.pid)
    && resultValue.pid > 1;
  const cleanupMustBeProven = process.platform !== "win32"
    && (processWasStarted || resultValue?.status === 0 || ["ETIMEDOUT", "ENOBUFS"].includes(resultValue?.error?.code));
  const cleanupVerified = process.platform === "win32"
    || (processWasStarted ? terminateOwnedProcessGroup(resultValue.pid) : !cleanupMustBeProven);
  if (!cleanupVerified || (cleanupMustBeProven && !processWasStarted)) return cleanupFailure(resultValue);
  if (!exceedsOutputLimit(resultValue)) return resultValue;
  return {
    ...resultValue,
    stdout: "",
    stderr: "",
    error: resultValue.error ?? outputLimitError(),
  };
}

function bannerIsUnsafe(text) {
  return (meaningfulLines(text) ?? []).some((line) => BANNER_INSTRUCTION_PATTERN.test(line)
    || BANNER_MARKUP_PATTERN.test(line)
    || containsSecret(line));
}

function parseSemver(value) {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return {
    core: match.slice(1, 4).map((part) => BigInt(part)),
    prerelease: match[4]?.split(".") ?? null,
  };
}

function compareSemver(left, right) {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  if (left.prerelease === null || right.prerelease === null) {
    return left.prerelease === right.prerelease ? 0 : left.prerelease === null ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/u.test(leftPart);
    const rightNumeric = /^\d+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) return BigInt(leftPart) < BigInt(rightPart) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function result(status, { command = null, version = null, blocker = null, detail }) {
  return { status, command, version, blocker, detail };
}

function invalidProbeInput() {
  return result("unavailable", {
    blocker: BROWSER_DRIVE_BLOCKER.unavailable,
    detail: "browser driver probe received malformed options; no driver was invoked",
  });
}

function probeFailure() {
  return result("unavailable", {
    blocker: BROWSER_DRIVE_BLOCKER.unavailable,
    detail: "browser driver probe failed closed",
  });
}

export function probeBrowserDriver(options) {
  try {
    // The CLI calls this with no arguments. An explicit undefined is malformed input.
    if (arguments.length === 0) options = {};
    if (options === null || typeof options !== "object" || Array.isArray(options)) return invalidProbeInput();

    let path;
    let runCommand = runBrowserCommand;
    let versionTimeoutMs = DEFAULT_VERSION_TIMEOUT_MS;
    try {
      path = options.path;
      const configuredRunCommand = options.runCommand;
      if (configuredRunCommand !== undefined) runCommand = configuredRunCommand;
      versionTimeoutMs = options.versionTimeoutMs;
    } catch {
      return invalidProbeInput();
    }
    if ((path !== undefined && typeof path !== "string") || typeof runCommand !== "function") return invalidProbeInput();

    const searchPath = typeof path === "string" ? path : (process.env.PATH ?? "");
    const env = { PATH: searchPath };

    let resolved;
    try {
      // cmd.exe has no `command -v`: on Windows the PATH search runs here, with PATHEXT.
      const windowsHit = process.platform === "win32" && runCommand === runBrowserCommand ? resolveOnPath(DRIVER_COMMAND, { env }) : undefined;
      resolved = windowsHit !== undefined
        ? { status: windowsHit ? 0 : 1, stdout: windowsHit ? `${windowsHit}\n` : "", stderr: "" }
        : runCommand("command", ["-v", DRIVER_COMMAND], {
          encoding: "utf8",
          env,
          shell: true,
          timeout: DEFAULT_VERSION_TIMEOUT_MS,
          maxBuffer: MAX_OUTPUT_BYTES,
        });
    } catch {
      resolved = null;
    }
    if (resolved?.error?.code === BROWSER_PROCESS_CLEANUP_FAILED) {
      return result("unverified-identity", {
        blocker: BROWSER_DRIVE_BLOCKER.cleanup,
        detail: `${DRIVER_COMMAND} resolution cleanup was not verified`,
      });
    }
    const resolverOutputTooLarge = exceedsOutputLimit(resolved);
    const resolverStdout = resolverOutputTooLarge ? [] : (meaningfulLines(resolved?.stdout) ?? []);
    const resolverStderr = resolverOutputTooLarge ? [] : (meaningfulLines(resolved?.stderr) ?? []);
    const resolverHasResidualControlOrFormat = !resolverOutputTooLarge
      && (hasResidualControlOrFormat(resolved?.stdout) || hasResidualControlOrFormat(resolved?.stderr));
    const command = resolved?.status === 0
      && !resolverOutputTooLarge
      && resolverStdout.length === 1
      && resolverStderr.length === 0
      && resolverStdout[0].length <= MAX_BANNER_CHARS
      && !resolverHasResidualControlOrFormat
      && !bannerIsUnsafe(resolverStdout[0])
      ? resolverStdout[0]
      : null;
    if (command === null) {
      const resolverRejected = resolved?.status === 0 || resolved?.error?.code === "ENOBUFS";
      return result(resolverRejected ? "unverified-identity" : "unavailable", {
        blocker: resolverRejected ? BROWSER_DRIVE_BLOCKER.identity : BROWSER_DRIVE_BLOCKER.unavailable,
        detail: resolverRejected
          ? `${DRIVER_COMMAND} resolved but its command path was rejected`
          : `${DRIVER_COMMAND} is not on PATH; this session cannot drive a browser`,
      });
    }

    let versionRun;
    try {
      versionRun = runCommand(command, ["--version"], {
        encoding: "utf8",
        env,
        timeout: boundedVersionTimeout(versionTimeoutMs),
        maxBuffer: MAX_OUTPUT_BYTES,
      });
    } catch {
      versionRun = null;
    }
    if (versionRun?.error?.code === BROWSER_PROCESS_CLEANUP_FAILED) {
      return result("unverified-identity", {
        command,
        version: null,
        blocker: BROWSER_DRIVE_BLOCKER.cleanup,
        detail: `${command} cleanup was not verified`,
      });
    }
    const versionOutputTooLarge = exceedsOutputLimit(versionRun);
    const version = versionOutputTooLarge
      ? null
      : firstMeaningfulLine(versionRun?.stdout) ?? firstMeaningfulLine(versionRun?.stderr);
    const versionHasResidualControlOrFormat = !versionOutputTooLarge
      && (hasResidualControlOrFormat(versionRun?.stdout) || hasResidualControlOrFormat(versionRun?.stderr));
    const unsafeBanner = !versionOutputTooLarge
      && (bannerIsUnsafe(versionRun?.stdout) || bannerIsUnsafe(versionRun?.stderr));
    const overLimitBanner = !versionOutputTooLarge
      && (hasOverLimitMeaningfulLine(versionRun?.stdout) || hasOverLimitMeaningfulLine(versionRun?.stderr));

    if (versionRun === null || versionRun.status !== 0 || version === null || versionOutputTooLarge
      || versionHasResidualControlOrFormat || unsafeBanner || overLimitBanner) {
      return result("unverified-identity", {
        command,
        version: null,
        blocker: BROWSER_DRIVE_BLOCKER.identity,
        detail: `${command} resolved but did not report a usable version`,
      });
    }
    const versionPrefix = `${DRIVER_COMMAND} `;
    const parsedVersion = version.startsWith(versionPrefix) ? parseSemver(version.slice(versionPrefix.length)) : null;
    const floor = parseSemver(VERIFIED_VERSION_FLOOR);
    if (parsedVersion === null || compareSemver(parsedVersion, floor) < 0) {
      return result("unverified-identity", {
        command,
        version: null,
        blocker: BROWSER_DRIVE_BLOCKER.identity,
        detail: `${command} resolved but did not identify ${DRIVER_COMMAND} at or above the verified floor ${VERIFIED_VERSION_FLOOR} from ${DRIVER_SOURCE}`,
      });
    }
    const beyondVerified = compareSemver(parsedVersion, floor) > 0;
    return result(beyondVerified ? "beyond-verified" : "available", {
      command,
      version,
      detail: beyondVerified
        ? `${command} identified ${DRIVER_SOURCE} ${version}, beyond the verified floor ${VERIFIED_VERSION_FLOOR}`
        : `${command} identified itself as ${DRIVER_SOURCE} at the verified floor ${VERIFIED_VERSION_FLOOR}`,
    });
  } catch {
    return probeFailure();
  }
}

const PLAYWRIGHT_BANNER = /^Version (\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?$/u;

function playwrightBrowserBuilds() {
  const home = process.env.HOME ?? "";
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    `${home}/Library/Caches/ms-playwright`,
    `${home}/.cache/ms-playwright`,
  ].filter((root) => typeof root === "string" && root !== "" && root !== "0");
  const builds = [];
  for (const root of roots) {
    try {
      for (const entry of readdirSync(root)) {
        if (/^(chromium|chromium_headless_shell|firefox|webkit)-\d+$/u.test(entry)) builds.push(entry);
      }
    } catch { /* an absent cache directory is a normal answer */ }
  }
  return [...new Set(builds)].sort();
}

/** Playwright tier: the package must answer `playwright --version` without a download. */
export function probePlaywright(options = {}) {
  const runCommand = options.runCommand ?? runBrowserCommand;
  const env = { PATH: options.path ?? process.env.PATH ?? "", HOME: process.env.HOME ?? "" };
  const run = runCommand("npx", ["--no-install", "playwright", "--version"], {
    encoding: "utf8",
    env,
    timeout: DEFAULT_VERSION_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const banner = firstMeaningfulLine(run?.stdout);
  const match = run?.status === 0 && banner !== null ? PLAYWRIGHT_BANNER.exec(banner) : null;
  if (match === null) {
    return { status: "unavailable", version: null, browsers: [], detail: "no Playwright package answers `npx --no-install playwright --version`" };
  }
  const browsers = playwrightBrowserBuilds();
  return {
    status: browsers.some((name) => name.startsWith("chromium")) ? "available" : "no-browser",
    version: match[1],
    browsers,
    detail: browsers.length === 0
      ? "Playwright answers but no browser build is cached; the user runs `npx playwright install chromium`"
      : `Playwright ${match[1]} with ${browsers.join(", ")}`,
  };
}

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/** Chrome tier: a binary that identifies itself; used for one-shot --dump-dom and --screenshot only. */
export function probeChrome(options = {}) {
  const runCommand = options.runCommand ?? runBrowserCommand;
  const candidates = [...(options.paths ?? CHROME_PATHS)];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const run = runCommand(candidate, ["--version"], {
      encoding: "utf8",
      timeout: DEFAULT_VERSION_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    const banner = firstMeaningfulLine(run?.stdout);
    if (run?.status === 0 && banner !== null && /(Chrome|Chromium|Edge)\s+\d+\./u.test(banner)) {
      return { status: "available", command: candidate, version: banner, detail: `${banner} at ${candidate}` };
    }
  }
  return { status: "unavailable", command: null, version: null, detail: "no Chrome, Chromium or Edge binary at the usual paths" };
}

/** Probe every tier and select the best usable one. Never installs or launches a page. */
export function probeAllTiers(options = {}) {
  const agentBrowser = probeBrowserDriver(options);
  const playwright = probePlaywright(options);
  const chrome = probeChrome(options);
  const selected = ["available", "beyond-verified"].includes(agentBrowser.status) ? "agent-browser"
    : playwright.status === "available" ? "playwright"
    : chrome.status === "available" ? "chrome-cli"
    : null;
  return {
    status: selected === null ? "unavailable" : "available",
    selected,
    blocker: selected === null
      ? (agentBrowser.blocker === BROWSER_DRIVE_BLOCKER.identity ? BROWSER_DRIVE_BLOCKER.identity : BROWSER_DRIVE_BLOCKER.unavailable)
      : null,
    tiers: { "agent-browser": agentBrowser, playwright, "chrome-cli": chrome },
  };
}

if (process.argv[1]?.endsWith("capability-probe.mjs")) {
  const report = probeAllTiers();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.selected === null ? 1 : 0;
}
