import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChromeSession } from '../plugin/skills/frontend-ui-ux/scripts/chrome-driver.mjs';

// A browser started with its own profile but the real keychain makes macOS ask for a keychain
// that does not exist, over and over. The stand-in records the arguments it was given.
test('ChromeSession starts the browser with a mock keychain and basic password store', { skip: process.platform === 'win32' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chrome-args-'));
  try {
    const fake = join(dir, 'chrome');
    const record = join(dir, 'args.txt');
    writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$@" > '${record}'\necho 'DevTools listening on ws://127.0.0.1:9/devtools/browser/x' >&2\nexec sleep 30\n`);
    chmodSync(fake, 0o755);
    const session = new ChromeSession(fake);
    await session.start();
    const args = readFileSync(record, 'utf8').split('\n');
    assert.equal(await session.stop(), true);
    assert.ok(args.includes('--use-mock-keychain'), args.join(' '));
    assert.ok(args.includes('--password-store=basic'), args.join(' '));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
