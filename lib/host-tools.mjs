import { statSync } from 'node:fs';
import { resolveOnPath, runSync } from '../plugin/lib/host-exec.mjs';

// Host programs the skills call. A missing one is reported with its fix and never installed here. Each entry names the
// commands any one of which will do (`any`), plus absolute places to look when the command is not on PATH (`files`, per
// platform).
// Looking is done in JavaScript, never through `sh`, so the same table works on Windows.
export const HOST_TOOLS = [
  { label: 'python3', python: true, fix: 'install Python 3.10 or newer (python.org, winget install Python.Python.3.12, or your package manager)', skills: 'autoresearch, autoconference' },
  { label: 'Chrome or Chromium', any: ['google-chrome', 'chromium', 'chromium-browser'], envSet: 'CHROME_PATH', files: { darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'], win32: ['%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe', '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe', '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe'] }, fix: 'install Google Chrome or Chromium, or set CHROME_PATH', skills: 'browser-drive' },
  { label: 'ast-grep', any: ['ast-grep', 'sg'], fix: 'npm i -g @ast-grep/cli', skills: 'structural-search' },
  { label: 'ripgrep (rg)', any: ['rg'], fix: 'brew install ripgrep (or your package manager)', skills: 'debugging, refactor, structural-search, lit-code' },
  { label: 'uv', any: ['uv'], fix: 'brew install uv (or pipx install uv)', skills: 'lit-code' },
  { label: 'Bun', any: ['bun'], fix: 'brew install oven-sh/bun/bun', skills: 'lit-code' },
  { label: 'agent-browser', any: ['agent-browser'], fix: 'npm i -g agent-browser (browser-drive falls back to Playwright or Chrome)', skills: 'browser-drive' },
];

const envValue = (env, name) => env[Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase())];
const expand = (template, env) => template.replace(/%([^%]+)%/gu, (_, name) => envValue(env, name) ?? '\0');

const defaultIsFile = (file) => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

/**
 * Whether a host tool is present. `platform`, `env` and `isFile` are stand-ins for tests; by default they are the
 * real machine.
 */
export function hostToolOk(tool, { env = process.env, platform = process.platform, isFile = defaultIsFile } = {}) {
  const ctx = { env, platform, isFile };
  const on = (name) => resolveOnPath(name, ctx) !== null;
  if (tool.python) {
    return ['python3', 'python', 'py'].some((name) => runSync(name, ['-c', 'import sys; sys.exit(sys.version_info < (3, 10))'], { env, stdio: 'ignore' }, ctx).status === 0);
  }
  if (tool.envSet && envValue(env, tool.envSet)) return true;
  const places = (tool.files?.[platform] ?? []).map((template) => expand(template, env)).filter((file) => !file.includes('\0'));
  return tool.any.some(on) || places.some(isFile);
}
