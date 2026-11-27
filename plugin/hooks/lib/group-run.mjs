// node group-run.mjs <ms> <command> [args...]: runs the command with no shell in its own process group. At <ms> the
// whole group is killed and this exits 124; when the command ends first, whatever it left running in its group is
// killed too, so a Done-when check never leaves a child behind. The exit status is the command's own.
import { spawn } from 'node:child_process';

const [ms, cmd, ...args] = process.argv.slice(2);
const killGroup = (pid) => { try { process.kill(-pid, 'SIGKILL'); } catch { /* group already gone */ } };
const child = spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false });
const timer = setTimeout(() => { killGroup(child.pid); process.exit(124); }, Number(ms) || 1);
child.on('error', () => { clearTimeout(timer); process.exit(127); });
child.on('exit', (code, signal) => {
  clearTimeout(timer);
  killGroup(child.pid);
  process.exit(code ?? (signal ? 128 : 1));
});
