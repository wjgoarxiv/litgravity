#!/usr/bin/env node
// Stands in for the host `agy` in tests. It records every call and answers the few subcommands LitGravity uses.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (process.env.FAKE_AGY_LOG) appendFileSync(process.env.FAKE_AGY_LOG, `${JSON.stringify({ args })}\n`);
const flag = (name) => args.includes(name);

if (flag('--version')) {
  process.stdout.write(`${process.env.FAKE_AGY_VERSION || '1.4.3'}\n`);
} else if (flag('--help')) {
  process.stdout.write('Usage of agy:\n  --effort    Reasoning effort for the current CLI session (low|medium|high|xhigh|max)\n');
} else if (args[0] === 'models') {
  process.stdout.write('Fetching available models...\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\ngemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)\nargon-1-preview\tGemini 4 Argon (Preview)\n');
} else if (args[0] === 'plugin' && args[1] === 'validate') {
  const dir = args[2];
  const findings = process.env.FAKE_AGY_FINDINGS ? JSON.parse(process.env.FAKE_AGY_FINDINGS) : [];
  const count = (sub) => (existsSync(`${dir}/${sub}`) ? 1 : 0);
  process.stdout.write(`${JSON.stringify({
    dir, manifest: 'plugin.json', name: 'litgravity', agentPluginsSpec: false,
    components: { agents: count('agents'), hooks: existsSync(`${dir}/hooks.json`) ? Object.keys(JSON.parse(readFileSync(`${dir}/hooks.json`, 'utf8'))).length : 0, mcpServers: 0, rules: count('rules'), sidecars: 0, skills: count('skills') },
    findings,
  }, null, 2)}\n`);
  process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
} else if (args[0] === 'plugin' && args[1] === 'list') {
  process.stdout.write(`${process.env.FAKE_AGY_PLUGINS || '[]'}\n`);
} else {
  process.stderr.write(`fake-agy: unsupported ${args.join(' ')}\n`);
  process.exitCode = 2;
}
