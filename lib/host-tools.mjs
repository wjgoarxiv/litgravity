import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveOnPath, runSync } from '../plugin/lib/host-exec.mjs';

// Host programs the engines and skills call. A missing one is reported with its fix and never installed here; Python
// and Node packages come from the pinned engine runtimes instead. Each entry names the commands it needs (`all`) or any
// one of which will do (`any`), plus absolute places to look when the command is not on PATH (`files`, per platform).
// Looking is done in JavaScript, never through `sh`, so the same table works on Windows.
export const HOST_TOOLS = [
  { label: 'python3', python: true, fix: 'install Python 3.10 or newer (python.org, winget install Python.Python.3.12, or your package manager)', skills: 'lit-docx, lit-pptx, lit-scientific-visualization, autoresearch' },
  { label: 'Poppler (pdftoppm, pdftotext)', all: ['pdftoppm', 'pdftotext'], fix: 'brew install poppler (or your package manager\'s poppler-utils)', skills: 'lit-docx, lit-pptx' },
  { label: 'LibreOffice (soffice)', any: ['soffice'], files: { darwin: ['/Applications/LibreOffice.app/Contents/MacOS/soffice'], win32: ['%ProgramFiles%\\LibreOffice\\program\\soffice.exe', '%ProgramFiles(x86)%\\LibreOffice\\program\\soffice.exe'] }, fix: 'install LibreOffice so documents can be rendered for checking', skills: 'lit-docx, lit-pptx' },
  { label: 'pandoc', any: ['pandoc'], fix: 'brew install pandoc (or your package manager)', skills: 'lit-docx' },
  { label: 'Chrome or Chromium', any: ['google-chrome', 'chromium', 'chromium-browser'], envSet: 'CHROME_PATH', files: { darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'], win32: ['%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe', '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe', '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe'] }, fix: 'install Google Chrome or Chromium, or set CHROME_PATH', skills: 'frontend-ui-ux, visual-qa, browser-drive, lit-typographic-motion' },
  { label: 'ffmpeg', any: ['ffmpeg'], fix: 'brew install ffmpeg (winget install Gyan.FFmpeg on Windows, or your package manager)', skills: 'lit-typographic-motion' },
  { label: 'ast-grep', any: ['ast-grep', 'sg'], fix: 'npm i -g @ast-grep/cli', skills: 'structural-search' },
  { label: 'libwebp (img2webp, dwebp)', all: ['img2webp', 'dwebp'], fix: 'brew install webp (or your package manager\'s libwebp tools)', skills: 'lit-typographic-motion, readme-studio' },
  { label: 'XeLaTeX (xelatex)', any: ['xelatex'], fix: 'install MacTeX, TeX Live or MiKTeX; without it lit-docx falls back to the soffice route for publisher PDFs', skills: 'lit-docx' },
  { label: 'Pretendard font', font: 'pretendard', fix: 'install the Pretendard family (OFL) so document and slide previews render in it; the skills fall back to a substitute without it', skills: 'lit-docx, lit-pptx (previews)' },
  { label: 'ripgrep (rg)', any: ['rg'], fix: 'brew install ripgrep (or your package manager)', skills: 'debugging, refactor, structural-search, lit-code' },
  { label: 'uv', any: ['uv'], fix: 'brew install uv (or pipx install uv)', skills: 'lit-code' },
  { label: 'Bun', any: ['bun'], fix: 'brew install oven-sh/bun/bun', skills: 'lit-code' },
  { label: 'agent-browser', any: ['agent-browser'], fix: 'npm i -g agent-browser (browser-drive falls back to Playwright or Chrome)', skills: 'browser-drive, lit-diagram-drawer' },
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
const defaultListDir = (dir) => readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));

function fontDirs(platform, env) {
  const home = envValue(env, 'HOME') || envValue(env, 'USERPROFILE') || '';
  if (platform === 'win32') return [join(envValue(env, 'WINDIR') || envValue(env, 'SystemRoot') || 'C:\\Windows', 'Fonts'), join(envValue(env, 'LOCALAPPDATA') || '', 'Microsoft', 'Windows', 'Fonts')];
  if (platform === 'darwin') return ['/Library/Fonts', '/System/Library/Fonts', join(home, 'Library', 'Fonts')];
  return ['/usr/share/fonts', '/usr/local/share/fonts', join(home, '.local', 'share', 'fonts'), join(home, '.fonts')];
}

function hasFont(name, { platform, env, listDir }) {
  const walk = (dir, depth) => {
    let entries;
    try { entries = listDir(dir); } catch { return false; }
    return entries.some((e) => (e.isDirectory ? depth < 3 && walk(join(dir, e.name), depth + 1) : e.name.toLowerCase().includes(name)));
  };
  return fontDirs(platform, env).some((dir) => walk(dir, 0));
}

/**
 * Whether a host tool is present. `platform`, `env`, `isFile` and `listDir` are stand-ins for tests; by default they are the
 * real machine.
 */
export function hostToolOk(tool, { env = process.env, platform = process.platform, isFile = defaultIsFile, listDir = defaultListDir } = {}) {
  const ctx = { env, platform, isFile };
  const on = (name) => resolveOnPath(name, ctx) !== null;
  if (tool.python) {
    return ['python3', 'python', 'py'].some((name) => runSync(name, ['-c', 'import sys; sys.exit(sys.version_info < (3, 10))'], { env, stdio: 'ignore' }, ctx).status === 0);
  }
  if (tool.font) return hasFont(tool.font, { platform, env, listDir });
  if (tool.envSet && envValue(env, tool.envSet)) return true;
  if (tool.all) return tool.all.every(on);
  const places = (tool.files?.[platform] ?? []).map((template) => expand(template, env)).filter((file) => !file.includes('\0'));
  return tool.any.some(on) || places.some(isFile);
}
