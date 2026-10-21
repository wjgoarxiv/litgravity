// Picks the Python interpreter an engine runtime builds its virtual environment from. The pinned packages publish wheels
// up to PYTHON_NEWEST; a newer `python3` (3.15 on a current Homebrew) fails at `pip install --only-binary` with "No matching
// distribution", so the picker walks the versioned names on PATH and uses the first supported one. An explicit
// interpreter named in the engine's own environment variable is always honoured as given.
import { spawnSync } from 'node:child_process';
import { describeSpawn } from './host-exec.mjs';

export const PYTHON_OLDEST = [3, 10];
export const PYTHON_NEWEST = [3, 14];
const VERSIONED = ['python3.14', 'python3.13', 'python3.12', 'python3.11', 'python3.10'];

const dotted = (v) => v.join('.');
const atLeast = (v, floor) => v[0] > floor[0] || (v[0] === floor[0] && v[1] >= floor[1]);

function probe(command) {
  const r = spawnSync(command, ['-c', "import sys; print('%d.%d.%d' % sys.version_info[:3])"], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return { command, found: false, detail: describeSpawn(r) };
  const version = r.stdout.trim();
  return { command, found: true, version, parts: version.split('.').map(Number) };
}

/**
 * @param {string|undefined} explicit  the engine's LITGRAVITY_*_PYTHON value
 * @param {string} envVar              its name, quoted in the fix text
 * @param {{platform?: string, probe?: Function}} [host]  stand-ins for tests; Windows has no python3 (the Store stub runs
 *   nothing), so there `python` and then the `py` launcher are tried as well
 * @returns {{ok: boolean, command: string, version?: string, detail: string}}
 */
export function pickPython(explicit, envVar, { platform = process.platform, probe: probeCommand = probe } = {}) {
  if (explicit) {
    const p = probeCommand(explicit);
    const fix = `Fix: set ${envVar} to a Python ${dotted(PYTHON_OLDEST)}-${dotted(PYTHON_NEWEST)} interpreter, or unset it so LitGravity picks one from PATH.`;
    if (!p.found) return { ok: false, command: explicit, detail: `${envVar}=${explicit} did not run (${p.detail}). ${fix}` };
    const ok = atLeast(p.parts, PYTHON_OLDEST);
    return { ok, command: explicit, version: p.version, detail: ok ? p.version : `${envVar}=${explicit} is ${p.version}, older than ${dotted(PYTHON_OLDEST)}. ${fix}` };
  }
  const inRange = (parts) => atLeast(parts, PYTHON_OLDEST) && !atLeast(parts, [PYTHON_NEWEST[0], PYTHON_NEWEST[1] + 1]);
  const base = probeCommand('python3');
  if (base.found && inRange(base.parts)) return { ok: true, command: 'python3', version: base.version, detail: base.version };
  if (platform === 'win32') {
    for (const name of ['python', 'py']) {
      const p = probeCommand(name);
      if (p.found && inRange(p.parts)) return { ok: true, command: name, version: p.version, detail: `${p.version} (${name}; python3 is ${base.found ? base.version : 'missing'})` };
    }
  }
  for (const name of VERSIONED) {
    const p = probeCommand(name);
    if (p.found && atLeast(p.parts, PYTHON_OLDEST) && !atLeast(p.parts, [PYTHON_NEWEST[0], PYTHON_NEWEST[1] + 1])) {
      return { ok: true, command: name, version: p.version, detail: `${p.version} (${name}; python3 is ${base.found ? base.version : 'missing'})` };
    }
  }
  if (!base.found) {
    const install = platform === 'win32' ? 'winget install Python.Python.3.12, or python.org' : 'brew install python@3.14';
    return { ok: false, command: 'python3', detail: `${base.detail}. Install Python ${dotted(PYTHON_OLDEST)} to ${dotted(PYTHON_NEWEST)} (${install}) or set ${envVar}.` };
  }
  if (!atLeast(base.parts, PYTHON_OLDEST)) return { ok: false, command: 'python3', version: base.version, detail: `${base.version} is older than ${dotted(PYTHON_OLDEST)}. Install python@3.14 or set ${envVar}.` };
  return {
    ok: false,
    command: 'python3',
    version: base.version,
    detail: `python3 is ${base.version}, newer than ${dotted(PYTHON_NEWEST)}, and no python3.14 to python3.10 is on PATH. The pinned wheels stop at ${dotted(PYTHON_NEWEST)}. Fix: brew install python@3.14, or set ${envVar} to a ${dotted(PYTHON_OLDEST)}-${dotted(PYTHON_NEWEST)} interpreter.`,
  };
}
