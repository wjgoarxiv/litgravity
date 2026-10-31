#!/usr/bin/env node
// Wraps `agy plugin validate --json --strict` on plugin/: prints the report and exits non-zero on any finding.
import { runSync } from '../plugin/lib/host-exec.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugin');
const bin = process.env.LITGRAVITY_AGY_BIN || 'agy';
const r = runSync(bin, ['plugin', 'validate', plugin, '--json', '--strict'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (r.error) {
  // CI runners have no agy: a missing host is a clean skip with the reason, not a failure.
  // Any test that needs the real host skips the same way (see the `skip` on the host-validator test).
  console.log(`validate: SKIP (agy is not on PATH: ${bin} could not run (${r.error.code ?? r.error.message}); install the Antigravity CLI to validate the plugin)`);
  process.exit(0);
}
let report = null;
try { report = JSON.parse(r.stdout); } catch { /* printed below */ }
if (!report) {
  console.error(`validate: no JSON report (exit ${r.status}): ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  process.exit(2);
}
console.log(JSON.stringify({ name: report.name, components: report.components, findings: report.findings }, null, 2));
const errors = report.findings.filter((f) => f.severity === 'error').length;
console.log(errors || report.findings.length ? `validate FAIL (${errors} errors, ${report.findings.length - errors} warnings)` : 'validate OK (0 errors, 0 warnings)');
process.exitCode = report.findings.length || r.status ? 1 : 0;
