// Host lookups that differ on Windows. `where` ends each line with \r\n, so a plain split("\n")
// keeps the \r and the path is never found. npm on Windows is npm.cmd, and since the
// CVE-2024-27980 fix (Node 18.20.2, 20.12.2, 21.7.3 and every 22+) Node refuses to spawn a .cmd
// without a shell (spawnSync EINVAL). When npm itself started us, npm_execpath names its npm-cli.js
// and this Node runs it with no shell at all; otherwise the .cmd goes through cmd.exe with every
// argument quoted, and an argument cmd.exe could still reinterpret inside quotes is refused.
import { spawnSync } from "node:child_process";

const LOOKUP = Object.freeze({ win32: "where", default: "which" });

/** The first match for `name` on PATH, or null. */
export function which(name, env = process.env, { platform = process.platform, spawn = spawnSync } = {}) {
  const cmd = LOOKUP[platform] ?? LOOKUP.default;
  const probe = spawn(cmd, [name], { encoding: "utf8", env });
  if (probe.status !== 0) return null;
  return String(probe.stdout ?? "").split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? null;
}

const CMD_SAFE = /^[\w@.,:=+/\\-]+$/u;
const CMD_UNSAFE = /["%\r\n]/u;

export const quoteForCmd = (arg) => {
  const text = String(arg);
  if (CMD_UNSAFE.test(text)) throw new Error(`refusing to pass ${JSON.stringify(text)} through cmd.exe`);
  // Trailing backslashes are doubled so the closing quote still ends the argument for node.
  return CMD_SAFE.test(text) ? text : `"${text.replace(/(\\+)$/u, "$1$1")}"`;
};

/** { command, args, shell } for spawn/spawnSync. */
export function npmInvocation(args, { platform = process.platform, env = process.env, execPath = process.execPath } = {}) {
  if (platform !== "win32") return { command: "npm", args, shell: false };
  if (/npm-cli\.c?js$/iu.test(env.npm_execpath ?? "")) return { command: execPath, args: [env.npm_execpath, ...args], shell: false };
  return { command: "npm.cmd", args: args.map(quoteForCmd), shell: true };
}
