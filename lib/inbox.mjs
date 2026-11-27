import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { stateRoot } from '../plugin/hooks/lib/common.mjs';
import { codeSpan, snapshotDigest } from '../plugin/hooks/lib/autopilot.mjs';

// `litgravity inbox`: prints, straight to the terminal and without the model, what each start-work run in this folder
// has parked and exactly which steps `lit approve` and `lit approve x` would replay now. It reads only; it never
// changes a run.
export function inbox({ env = process.env, cwd = process.cwd(), flags = {}, print = console.log }) {
  let real;
  try { real = realpathSync(cwd); } catch { real = resolve(cwd); }
  const dir = join(stateRoot(env), 'sessions', createHash('sha256').update(real).digest('hex').slice(0, 16));
  let names = [];
  try { names = readdirSync(dir).filter((n) => n.endsWith('.run.json')); } catch { /* no runs here */ }
  const runs = [];
  for (const name of names) {
    try { runs.push({ conversation: name.slice(0, -'.run.json'.length), ...JSON.parse(readFileSync(join(dir, name), 'utf8')) }); } catch { /* unreadable: skipped */ }
  }
  if (flags.json) {
    print(JSON.stringify(runs.map((r) => ({ conversation: r.conversation, plan: r.plan, completed: !!r.completed, paused: !!r.paused, parked: r.parked ?? [], replayable: r.snapshot?.steps ?? [] })), null, 2));
    return 0;
  }
  if (!runs.length) {
    print(`No start-work run in ${real}.`);
    return 0;
  }
  for (const r of runs) {
    const state = r.completed ? 'complete' : r.paused ? 'paused' : 'running';
    print(`${r.plan ?? '(no plan)'} · conversation ${r.conversation} · ${state}`);
    if (r.snapshot?.steps?.length) {
      let sealed = null;
      try { sealed = readFileSync(join(dir, `${r.conversation}.seal`), 'utf8').trim(); } catch { /* no seal */ }
      const ok = sealed === r.snapshot.digest && sealed === snapshotDigest(r.snapshot.steps);
      print(`  snapshot ${snapshotDigest(r.snapshot.steps)} · ${ok ? 'matches the seal the hook wrote' : 'does NOT match the seal: the run file was edited, and an approval will refuse it'}`);
    }
    const shown = new Set((r.snapshot?.steps ?? []).map((s) => s.id));
    const parked = r.parked ?? [];
    if (!parked.length) print('  nothing parked');
    for (const s of parked) {
      const tag = s.held ? `held: ${s.held}` : shown.has(s.id) ? `[${s.tier}] replayed by ${s.tier === 'B' ? '`lit approve`' : '`lit approve x`'}` : `[${s.tier}] not in the last inbox, so no answer runs it yet`;
      print(`  ${s.id}. ${tag}\n     in ${s.cwd}: ${codeSpan(s.command)}`);
    }
  }
  print('This view comes from the hooks\' own run state, not from the model. Compare it with the inbox the model showed you before you answer.');
  return 0;
}
