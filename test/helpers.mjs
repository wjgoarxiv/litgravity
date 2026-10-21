import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = join(ROOT, 'plugin');
export const FAKE_AGY = join(ROOT, 'test', 'fixtures', 'fake-agy.mjs');
chmodSync(FAKE_AGY, 0o755);

// A throwaway HOME with XDG dirs and a fake agy binary, so no test touches the real machine.
export function sandbox() {
  const home = mkdtempSync(join(tmpdir(), 'litgravity-home-'));
  const env = {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    XDG_CACHE_HOME: join(home, '.cache'),
    LITGRAVITY_AGY_BIN: FAKE_AGY,
    LITGRAVITY_NO_UPDATE_CHECK: '1',
    FAKE_AGY_LOG: join(home, 'agy-calls.jsonl'),
    PATH: process.env.PATH,
  };
  return { home, env };
}

export function agyCalls(env) {
  if (!existsSync(env.FAKE_AGY_LOG)) return [];
  return readFileSync(env.FAKE_AGY_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function walk(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    acc.push(relative(base, p));
    if (lstatSync(p).isDirectory()) walk(p, base, acc);
  }
  return acc;
}

export function collect() {
  const lines = [];
  return { lines, print: (l) => lines.push(l), text: () => lines.join('\n') };
}

// A workspace folder plus a transcript file in agy's JSONL shape (one step per line, newest USER_INPUT last).
export function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-ws-'));
  return { dir, transcript: join(dir, 'transcript_full.jsonl') };
}

export function userStep(stepIndex, prompt) {
  return JSON.stringify({
    step_index: stepIndex, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE', created_at: '2026-10-20T00:00:00Z',
    content: `<USER_REQUEST>\n${prompt}\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: 2026-10-20T09:00:00+09:00.\n</ADDITIONAL_METADATA>`,
  });
}

export function modelStep(stepIndex, text = 'ok') {
  return JSON.stringify({ step_index: stepIndex, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', content: text });
}

export function writeTranscript(ws, steps) {
  writeFileSync(ws.transcript, `${steps.join('\n')}\n`);
}

// Runs one hook script the way agy does: JSON on stdin, JSON on stdout, cwd = the plugin folder.
export function runHook(name, payload, env, { plugin = PLUGIN } = {}) {
  const r = spawnSync(process.execPath, [join(plugin, 'hooks', `${name}.mjs`)], {
    cwd: plugin, env: { ...env }, input: JSON.stringify(payload), encoding: 'utf8',
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { json = null; }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

export function basePayload(ws, extra = {}) {
  return {
    conversationId: 'conv-test-0001',
    workspacePaths: [ws.dir],
    transcriptPath: ws.transcript,
    artifactDirectoryPath: join(ws.dir, 'artifacts'),
    modelName: 'gemini-3.8-flash-medium',
    ...extra,
  };
}

// One user turn through PreInvocation: appends the prompt to the transcript, then fires invocation 0.
export function turn(ws, env, prompt, stepIndex, extra = {}) {
  const existing = existsSync(ws.transcript) ? readFileSync(ws.transcript, 'utf8') : '';
  writeFileSync(ws.transcript, `${existing}${userStep(stepIndex, prompt)}\n`);
  return runHook('pre-invocation', basePayload(ws, { invocationNum: 0, initialNumSteps: stepIndex, ...extra }), env);
}

export function injected(result) {
  return result.json?.injectSteps?.map((s) => s.ephemeralMessage ?? s.systemMessage?.systemMessage ?? '').join('\n') ?? '';
}

export function mkdirp(p) {
  mkdirSync(p, { recursive: true });
  return p;
}
