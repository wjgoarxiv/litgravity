import { agy, agyEfforts } from './agy.mjs';
import { splitLines } from '../plugin/lib/host-exec.mjs';

// Models come only from `agy models`, so a model the host lists tomorrow shows up here with no LitGravity release.
// Each row is `<id>\t<label>`; the header and any other line without a tab is skipped.
export function listModels(env = process.env) {
  const r = agy(env, ['models'], { timeoutMs: 30000 });
  if (!r.ok) return [];
  return splitLines(r.stdout).map((line) => line.split('\t')).filter((cols) => cols.length >= 2 && /^[\w.-]+$/.test(cols[0].trim()))
    .map(([id, label]) => ({ id: id.trim(), label: label.trim() }));
}

export async function models({ env = process.env, flags = {}, print = console.log }) {
  const probe = agy(env, ['--version'], { timeoutMs: 20000 });
  if (probe.missing) {
    print('agy was not found on PATH. Install the Antigravity CLI first, then run this again.');
    return 1;
  }
  const list = listModels(env);
  if (flags.json) {
    print(JSON.stringify(list, null, 2));
    return list.length ? 0 : 1;
  }
  if (!list.length) {
    print('`agy models` returned no models. Sign in to agy once (run `agy`), then try again.');
    return 1;
  }
  const efforts = agyEfforts(env);
  print('Models your agy install offers (from `agy models`):');
  for (const m of list) print(`  ${m.id}  ${m.label}`);
  print('');
  print(`Efforts: ${efforts.length ? efforts.join(', ') : 'see `agy --help`'}`);
  print('Pick one per run:');
  for (const m of list) print(`  agy --model ${m.id}${efforts.includes('medium') ? ' --effort medium' : ''}`);
  return 0;
}
