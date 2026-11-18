#!/usr/bin/env node
// The launch question's cost line for an ultra-brainstorm run on agy: idea agents on the flash_lite tier, one reducer
// on the flash tier per 30 idea agents, one judge on the pro tier, and this conversation's own orchestrating turn.
// Calibration: one real 100-agent run on agy 1.5.10 (2026-11-18), summed from every step's input and output tokens in
// the run's conversation records. Idea agents: median 27,939 each (2,614 to 54,315), 2,852,779 together. Reducers:
// 60k to 95k each. Judge: 98k (the pro tier ran as gemini-3.8-flash-tiered on that account). Orchestrating turn:
// 149,844. Total 3,444,698, plus 936,469 cache-read tokens not counted here. The range brackets that run; `/usage`
// (agy's quota view) stays the real number.
// Usage: node estimate.mjs <agents> [--json]
//        node estimate.mjs --answer <<'LIT_REPLY_END_9Q7'  the user's reply on stdin only (a quoted heredoc, so $(...)
//        <the reply>                                        and backticks stay data; an argument after --answer is an
//        LIT_REPLY_END_9Q7                                  error); prints launch <n>, stop, split <n> or ask-again
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MEASURED_RUN = Object.freeze({ agents: 100, ideaMedian: 27_939, ideas: 2_852_779, reducers: 343_712, judge: 98_363, orchestrator: 149_844 });
export const PER_AGENT = Object.freeze({ idea: [25_000, 40_000], reduce: [60_000, 100_000], judge: [80_000, 120_000], orchestrator: [150_000, 250_000] });
export const PER_REDUCER = 30;
export const MIN_AGENTS = 1;
export const MAX_AGENTS = 900;
export const TIERS = Object.freeze({ idea: 'flash_lite', reduce: 'flash', judge: 'pro' });

export const estimate = (agents) => {
  if (!Number.isInteger(agents) || agents < MIN_AGENTS) throw new Error('agents must be a positive whole number');
  if (agents > MAX_AGENTS) throw new Error(`at most ${MAX_AGENTS} idea agents per run; split a larger run`);
  const reducers = Math.ceil(agents / PER_REDUCER);
  const at = (i) => agents * PER_AGENT.idea[i] + reducers * PER_AGENT.reduce[i] + PER_AGENT.judge[i] + PER_AGENT.orchestrator[i];
  return { agents, reducers, judges: 1, tiers: TIERS, tokens: { low: at(0), high: at(1) } };
};

export const costLine = (agents) => {
  const { reducers, tokens } = estimate(agents);
  return `${agents} idea agents (${TIERS.idea}) + ${reducers} reducers (${TIERS.reduce}) + 1 judge (${TIERS.judge}) ≈ ${(tokens.low / 1_000_000).toFixed(1)}M-${(tokens.high / 1_000_000).toFixed(1)}M tokens of agy quota`;
};

// The user's reply to the launch question. A plain no ends the run at once; a number (or a listed option) launches;
// above the cap asks to split; anything else (silence, "ok", a question) is no answer and launches nothing.
const NO = /^(?:no|nope|nah|cancel|stop|never ?mind|아니|아니요|아니오|아뇨|취소|그만|안 ?해)[.!\s]*$/iu;
export const launchAnswer = (reply) => {
  const text = String(reply ?? '').trim();
  if (NO.test(text)) return { action: 'stop' };
  // The dialog hands back the picked option's label ("(Recommended) 100 (recommended minimum)", "2. 300"): drop the
  // option number and the label words, then exactly one number must remain.
  const bare = text.replace(/^\d+\.\s+(?=\d)/u, '').replace(/\((?:recommended)(?: minimum)?\)/giu, ' ')
    .replace(/\b(?:recommended|minimum|idea|agents?)\b|개/giu, ' ').trim();
  const m = /^(\d{1,5})[.!\s]*$/u.exec(bare);
  if (!m) return { action: 'ask-again' };
  const agents = Number(m[1]);
  if (agents < MIN_AGENTS) return { action: 'ask-again' };
  return agents > MAX_AGENTS ? { action: 'split', agents } : { action: 'launch', agents };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [raw, flag, ...extra] = process.argv.slice(2);
  if (raw === '--answer') {
    // The reply arrives only on stdin; a reply on the command line could carry $(...) into a shell.
    if (flag !== undefined) {
      process.stderr.write('estimate: --answer takes no argument; pass the reply on stdin through a quoted heredoc\n');
      process.exitCode = 64;
    } else {
      let reply = '';
      try { reply = readFileSync(0, 'utf8'); } catch { /* no stdin: no answer */ }
      const a = launchAnswer(reply);
      process.stdout.write(`${a.action}${a.agents ? ` ${a.agents}` : ''}\n`);
    }
  } else if (extra.length || (flag !== undefined && flag !== '--json')) {
    process.stderr.write('estimate: unknown argument\n');
    process.exitCode = 64;
  } else try {
    const agents = Number(raw);
    process.stdout.write(`${flag === '--json' ? JSON.stringify(estimate(agents)) : costLine(agents)}\n`);
  } catch (error) {
    process.stderr.write(`estimate: ${error.message}\n`);
    process.exitCode = 64;
  }
}
