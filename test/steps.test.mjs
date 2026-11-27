import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classify, isOutward, charterAllows } from '../plugin/hooks/lib/steps.mjs';

// The S-SEC table of plans/2026-11-27-autopilot-port/scenarios.md through LitGravity's step classifier. The hooks
// run it on every parked step and again on every replay, so a tier here is what `lit approve` may later run.

function project() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'litgravity-steps-')));
  const ws = join(root, 'proj');
  const home = join(root, 'home');
  const outside = join(root, 'outside');
  for (const d of [ws, join(ws, 'src'), join(ws, '.git', 'hooks'), home, join(home, 'Desktop'), join(home, '.ssh'), join(home, '.aws'), join(home, '.gemini'), outside]) mkdirSync(d, { recursive: true });
  writeFileSync(join(ws, 'src', 'a.mjs'), 'a\n');
  writeFileSync(join(ws, 'ok.mjs'), 'ok\n');
  writeFileSync(join(ws, '.git', 'HEAD'), 'ref: refs/heads/feat/qa\n');
  symlinkSync(join(outside, 'target'), join(ws, 'notes.txt'));
  symlinkSync(join(outside, 'touched'), join(ws, 'dangling.txt'));
  symlinkSync(join(outside, 'gone-dir'), join(ws, 'dlink'));
  symlinkSync(join(ws, '.git'), join(ws, 'gitlink'));
  symlinkSync(outside, join(ws, 'outlink'));
  symlinkSync(join(home, '.gemini'), join(ws, 'gem'));
  symlinkSync(join(home, '.ssh'), join(ws, 'sshlink'));
  symlinkSync(join(home, '.gemini', 'config'), join(ws, 'dgem'));
  symlinkSync(join(home, '.ssh', 'id_new'), join(ws, 'dkey'));
  symlinkSync(join(ws, 'loopb'), join(ws, 'loopa'));
  symlinkSync(join(ws, 'loopa'), join(ws, 'loopb'));
  symlinkSync(join(ws, 'hop2'), join(ws, 'hop1'));
  symlinkSync(join(home, '.gemini', 'plugins'), join(ws, 'hop2'));
  const env = { ...process.env, HOME: home };
  const ctx = (cwd = ws, extra = {}) => ({ workspace: ws, cwd, env, stateDir: join(root, 'state'), ...extra });
  return { ws, home, outside, ctx };
}

const P = project();
const tier = (cmd, cwd, extra) => classify(cmd, P.ctx(cwd, extra)).tier;

test('S-A2-04 tier B is the allowlist only: cd, touch, mkdir, cp and mv onto new paths, git add of named files', () => {
  for (const cmd of ['touch fresh.txt', 'mkdir -p out/dir', 'cp src/a.mjs src/copy.mjs', 'mv src/a.mjs src/renamed.mjs', 'cd src && touch x.txt', 'git add src/a.mjs', 'cp -r src src2']) {
    assert.equal(tier(cmd), 'B', cmd);
  }
  assert.equal(tier('git add -A'), 'X');
  assert.equal(tier('git add .'), 'X');
});

test('S-SEC-01/02/03 a dangling link counts as present: cp, touch and mkdir through one are X', () => {
  assert.equal(tier('cp src/a.mjs notes.txt'), 'X');
  assert.equal(tier('touch dangling.txt'), 'X');
  assert.equal(tier('mkdir -p dlink/x'), 'X');
});

test('S-SEC-04/05/06 S-A4-06 anything landing in .git, by any case or through a link, is never B', () => {
  for (const cmd of ['touch .GIT/hooks/pre-commit', 'cp src/a.mjs .Git/hooks/pre-commit', 'touch .git/x', 'cp -r src .git', 'cp src/a.mjs gitlink/hooks/pre-commit', 'mkdir -p gitlink/x', 'touch .git/config', 'mkdir .git/worktrees/x']) {
    assert.equal(tier(cmd), 'refused', cmd);
  }
  assert.notEqual(tier('mv a.mjs ../.git/HEAD', join(P.ws, 'src')), 'B');
});

test('S-SEC-07/08/09 outside the project or an overwrite is X', () => {
  assert.equal(tier('touch outlink/probe.txt'), 'X');
  assert.equal(tier(`touch ${P.outside}/f2.txt`), 'X');
  assert.equal(tier('cp src/a.mjs ../x'), 'X');
  assert.equal(tier('mv src/a.mjs ok.mjs'), 'X');
  assert.equal(tier('cp src/a.mjs ok.mjs'), 'X');
});

test('S-SEC-10..16 prefixes, unfollowed verbs, globs, expansion and broken quoting are held', () => {
  const held = [
    'time pushd .. && touch s4b-time.txt', 'A=1 cd .. && touch s4b-assign.txt', '! touch x', 'nice cd .. && touch x', 'nohup touch x',
    'timeout 5 touch x', 'stdbuf -o0 touch x', 'ionice touch x', 'chroot / touch x', 'doas touch x', 'pushd .. && touch x', 'popd',
    'builtin cd .. && touch x', 'command touch x', 'exec touch x', "eval 'touch x'", 'source x.sh', '. x.sh', 'env X=1 touch x', 'sudo touch x',
    'xargs touch', 'alias', 'set', 'shopt', 'trap', 'enable', 'touch glob*.txt', 'touch {a,b}.txt', 'touch x > other.txt', 'touch a\\ b',
    'touch ~/x', 'echo dG91Y2g= | base64 -d | sh', 'xxd -r x', 'openssl enc -d -in x', "sh -c 'x'", 'bash -lc x', 'echo $HOME', 'echo `id`',
    "printf '\\x41'", "printf '\\101'", 'echo "unclosed', 'touch a &&  && touch b', 'cd -',
  ];
  for (const cmd of held) assert.equal(tier(cmd), 'held', cmd);
});

test('S-SEC-28 a new file under an in-workspace link to the agy home or a secret folder is refused, dangling links too', () => {
  for (const cmd of ['touch gem/config/x.json', 'mkdir -p gem/config/plugins', 'cp ok.mjs gem/new.json', 'touch sshlink/new_key', 'cd gem && touch fresh.json', 'touch dgem/x.json', 'mkdir dgem', 'cp ok.mjs dkey']) {
    assert.equal(tier(cmd), 'refused', cmd);
  }
  assert.equal(tier('touch dangling.txt'), 'X', 'a dangling link outside every protected folder stays X');
});

test('S-SEC-17 cd is followed: out of the project the next step is X; a bare cd is refused', () => {
  assert.equal(tier('cd .. && touch x'), 'X');
  assert.equal(tier('cd .. && cd .. && touch x'), 'X');
  assert.equal(tier('cd'), 'refused');
});

test('S-SEC-18..21 runners, package scripts and outward verbs are X', () => {
  for (const cmd of ['node ok.mjs --write x', 'python3 x.py', 'bash run.sh', 'sh run.sh', './run.sh', 'perl x.pl', 'deno run x.ts',
    'npm run clean', 'npm run build', 'npm test', 'npm start', 'npx x', 'pnpm run build', 'yarn build', 'bun run x', 'make all',
    'gh pr merge 12', 'npm unpublish x', 'npm deprecate x old', 'curl -X POST https://example.invalid/a', 'wget https://example.invalid', 'ssh host ls',
    'scp a host:b', 'docker push x', 'aws s3 rm s3://b/k', 'rm -rf build', 'git push origin b', 'git tag v1', 'npm publish', 'git reset --hard',
    'git clean -fd', 'git config x y', 'npm version patch', 'git pu', 'git frobnicate']) {
    assert.equal(tier(cmd), 'X', cmd);
  }
});

test('S-SEC-22..24 outward steps keep a run open; local ones do not', () => {
  for (const cmd of ['git pu', 'git frobnicate', 'make ship', 'npm run clean', 'pnpm exec x', 'yarn dlx x', 'bun x y', 'npm run-script x', 'rm -rf ../dist-old', 'find .. -delete', 'unlink /x', 'git push origin main', 'curl https://example.invalid']) {
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
  for (const cmd of ['node ok.mjs > out.txt', 'touch later.txt', 'git add src/a.mjs', 'git commit -m x']) assert.equal(isOutward(cmd, P.ctx()), false, cmd);
});

test('S-SEC-25..28 secrets, shell rc files and the agy home are refused, after quotes and cd are followed', () => {
  const h = P.home;
  for (const cmd of [
    `cd ${h} && cat .aws/credentials`, `cat ${h}/.ge""mini/settings.json`, `cat ${h}/.g'e'mini/settings.json`,
    `cd ${h}/Desktop && cd .. && cat .ssh/config`, 'cd ~someone && ls', `cat ${h}/.ssh/id_ed25519`, `cat ${h}/.npmrc`, `cat ${h}/.zshrc`,
    'cat .env', 'cat config/.env.production', 'cat .envrc', 'cat server.pem', 'cat .mcp.json', `touch ${h}/.gemini/probe.txt`,
    `cat ${join(P.ctx().stateDir, 'x.json')}`,
  ]) {
    assert.equal(tier(cmd), 'refused', cmd);
  }
  assert.notEqual(tier('cat .env.example'), 'refused');
  assert.notEqual(tier('cat .env.template'), 'refused');
});

test('S-SEC-28 the account\'s real home is protected even when HOME is replaced', () => {
  const real = process.env.HOME;
  if (!real) return;
  const c = { ...P.ctx(), env: { ...process.env, HOME: P.home } };
  assert.equal(classify(`cat ${real}/.ssh/config`, c).tier, 'refused');
  assert.equal(classify(`cat ${real}/.gemini/settings.json`, c).tier, 'refused');
});

test('S-A2-08/09 the split hint covers readers and the Done-when check only', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of ['node check.mjs; echo "exit=$?"', 'node check.mjs 2>&1; echo $?', 'cat src/a.mjs || true']) {
    assert.equal(classify(cmd, c).tier, 'split', cmd);
  }
  assert.equal(classify('node check.mjs || git push', c).tier, 'X');
  assert.equal(classify('node check.mjs; rm -rf ../zz', c).tier, 'X');
  assert.equal(classify(`cd ${P.home} && cat .aws/credentials`, c).tier, 'refused');
});

test('S-SEC-35 the split hint never covers a reader with a writing or running form, nor drops a mutating part', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of [
    "sed 'w ../out' src/a.mjs || true", "sed 's/a/b/w ../out' src/a.mjs || true", "sed 'W ../out' src/a.mjs || true",
    "sed 'e date' src/a.mjs || true", "sed 'r ../in' src/a.mjs || true", 'sed -i s/a/b/ src/a.mjs || true',
    'sort -o ../out src/a.mjs || true', 'sort --output=../out src/a.mjs || true', 'sort -o../out src/a.mjs || true',
    'uniq src/a.mjs ../out || true', 'rg --pre ./evil x || true', 'rg --pre=./evil x || true', 'grep --output=x y || true',
    'find . -fprint0 ../out || true', 'find . -fprint ../out || true', 'find . -fls ../out || true', 'find . -ok rm {} ; || true',
    'git branch -D main || true', 'git branch -f main HEAD~1 || true', 'git diff --output=../out || true', 'git log --output ../out || true',
    'cat src/a.mjs; echo x > ../f', 'node check.mjs; echo pwned >> ../f', 'node check.mjs; printf x > ../f',
  ]) {
    assert.notEqual(classify(cmd, c).tier, 'split', cmd);
  }
  assert.equal(classify('sed -n 1p src/a.mjs || true', c).tier, 'split', 'sed with p only stays a reader');
  assert.equal(classify('uniq src/a.mjs || true', c).tier, 'split', 'uniq with one operand stays a reader');
});

test('S-SEC-36 writing and destroying forms of readers and git keep a run open', () => {
  for (const cmd of [
    "sed 'w ../out' src/a.mjs", 'sed -i s/a/b/ src/a.mjs', "sed 'e date' src/a.mjs", 'sort -o ../out src/a.mjs', 'sort --output=../out src/a.mjs',
    'uniq src/a.mjs ../out', 'rg --pre ./evil x', 'find . -fprint0 ../out', 'git branch -D main', 'git branch -f main HEAD~1',
    'git branch --delete --force main', 'git diff --output=../out', 'echo x > ../f',
  ]) {
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
});

test('C-3 awk, tree -o, git grep -O and every git branch change are not readers; a name=value operand is a path', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of ["awk '{print}' src/a.mjs || true", 'tree -o ../out || true', 'git grep -O x || true', 'git grep --open-files-in-pager x || true', 'git branch -c a b || true']) {
    assert.notEqual(classify(cmd, c).tier, 'split', cmd);
  }
  for (const cmd of ["awk '{print > \"../out\"}' src/a.mjs", 'tree -o ../out', 'git grep -O x', 'git branch -d old', 'git branch -c a b', 'node ok.mjs --out=../dist', 'make DESTDIR=../stage']) {
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
  assert.equal(tier(`node ok.mjs --config=${P.home}/.gemini/x.json`), 'refused', 'the value after = is checked as a path');
});

test('C-1 unknown verbs and writing tools are X: never B, never a split hint, so nothing replays them without lit approve x', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of ['dd if=src/a.mjs of=out.bin', 'tar -C out -xf a.tar', 'ln -s src/a.mjs l', 'chmod +x ok.mjs', 'truncate -s 0 ok.mjs', 'install ok.mjs bin/ok', 'patch -p1 x.diff', 'go run .', 'cargo run', 'uv run x.py', 'frobnicate now']) {
    assert.equal(classify(cmd, c).tier, 'X', cmd);
    assert.equal(classify(`${cmd} || true`, c).tier, 'X', `${cmd} || true`);
  }
});

test('readers that run code or print env: less/more +cmd, jq env, rg --hostname-bin are X, never a split hint', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  const forms = ['less +!id ok.mjs', 'more +!id ok.mjs', "jq -n env", "jq -n '$ENV'", 'jq input_filename ok.json', 'rg --hostname-bin=id x', 'rg --hostname-bin id x'];
  for (const cmd of forms) {
    assert.equal(tier(cmd), 'X', cmd);
    assert.notEqual(classify(`${cmd} || true`, c).tier, 'split', cmd);
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
  assert.equal(classify('rg x ok.mjs || true', c).tier, 'split', 'plain rg stays a reader');
});

test('cross-port: a write whose target contains the run state folder is refused; ~/ operands are home paths', () => {
  const state = join(P.ws, '..', 'state');
  for (const cmd of [`rm -rf ${join(P.ws, '..')}`, 'mv .. /tmp/elsewhere', `cp -r src ${join(P.ws, '..')}`, `rm -r ${state}`]) assert.equal(tier(cmd), 'refused', cmd);
  // Case folding follows the file system the guard runs on (steps.mjs CASE_FOLD): the upper-cased folder is the same folder on macOS and Windows, and a different, absent one on Linux.
  const folded = tier(`rm -rf ${state.toUpperCase()}`);
  if (process.platform === 'darwin' || process.platform === 'win32') assert.equal(folded, 'refused', 'upper-cased state folder');
  else assert.notEqual(folded, 'refused', 'a case-sensitive file system keeps the upper-cased path distinct');
  assert.notEqual(tier('ls ..'), 'refused', 'reading the parent stays allowed');
  for (const cmd of ['cat ~/.ssh/config', 'touch ~/.zshrc', 'cp ok.mjs ~/.gemini/x', 'rm -rf ~/.gemini']) assert.equal(tier(cmd), 'refused', cmd);
  const underHome = { stateDir: join(P.home, '.local', 'state', 'litgravity', 'sessions') };
  for (const cmd of ['rm -rf ~/.local', 'rm -rf ~', 'mv ~/.local/state /tmp/x', 'cp ok.mjs ~']) assert.equal(tier(cmd, P.ws, underHome), 'refused', cmd);
  assert.notEqual(tier('cp ok.mjs ~/Desktop/new.txt', P.ws, underHome), 'refused', 'a home file next to the state folder is not refused for it');
});

test('cross-port: git show REV:path is secret-checked; grep -f and sort --compress-program are X, not split', () => {
  for (const cmd of ['git show HEAD:.env', 'git show main:config/.env.local', 'git show HEAD~1:secrets/id_rsa']) assert.equal(tier(cmd), 'refused', cmd);
  assert.notEqual(tier('git show HEAD:.env.example'), 'refused');
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of [`grep -f ${join(P.outside, 'pats')} x ok.mjs`, 'grep --file=/etc/hosts x ok.mjs', 'sort --compress-program=id ok.mjs']) {
    assert.equal(tier(cmd), 'X', cmd);
    assert.notEqual(classify(`${cmd} || true`, c).tier, 'split', cmd);
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
});

test('round 5: abbreviated and clustered write options count like the full forms', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of ['sort -uo out.txt ok.mjs', 'sort --out=out.txt ok.mjs', 'sort --o out.txt ok.mjs', 'sort --compress-prog=sh ok.mjs', 'sort --co=sh ok.mjs', 'file --comp x.magic', 'file --com x.magic']) {
    assert.equal(tier(cmd), 'X', cmd);
    assert.notEqual(classify(`${cmd} || true`, c).tier, 'split', cmd);
    assert.equal(isOutward(cmd, P.ctx()), true, cmd);
  }
  assert.equal(classify('sort -u ok.mjs || true', c).tier, 'split', 'plain sort stays a reader');
});

test('round 5: the protected check follows cd across parts and from a stored replay folder', () => {
  for (const cmd of ['cd ~/.config && cat gh/hosts.yml', 'cd ~ && cat .ssh/config', 'cd ~/.config/gh && cat hosts.yml', 'cd ~ && cd .config && cat gh/hosts.yml']) assert.equal(tier(cmd), 'refused', cmd);
  assert.equal(tier('cat gh/hosts.yml', join(P.home, '.config')), 'refused', 'a replay from the stored folder');
  assert.notEqual(tier('cd ~/Desktop && cat notes.md'), 'refused');
});

test('round 5: writes into any .git internal are refused, reads are not', () => {
  for (const cmd of ['echo x > .git/HEAD', 'cp ok.mjs .git/refs/heads/main', 'rm .git/index', 'touch .git/packed-refs', 'rm -rf .git', 'mv .git/HEAD moved']) assert.equal(tier(cmd), 'refused', cmd);
  for (const cmd of ['cat .git/HEAD', 'git status', 'ls .git']) assert.notEqual(tier(cmd), 'refused', cmd);
});

test('round 5: a recursive reader on a folder that holds a protected place is refused', () => {
  for (const cmd of ['grep -r token ~', 'grep --recursive token ~/', 'rg token ~', 'find ~ -name "id_*"', 'ls -R ~', `grep -R token ${P.home}`]) assert.equal(tier(cmd), 'refused', cmd);
  for (const cmd of ['grep -r token src', 'find ~/Desktop -name x', 'ls ~', 'rg token src']) assert.notEqual(tier(cmd), 'refused', cmd);
});

test('read-only git remote forms are local; git remote show, add and fetch stay outward', () => {
  for (const cmd of ['git remote', 'git remote -v', 'git remote --verbose', 'git remote get-url origin', 'git remote get-url --push origin']) assert.equal(isOutward(cmd, P.ctx()), false, cmd);
  for (const cmd of ['git remote show origin', 'git remote add up https://example.invalid/x.git', 'git remote set-url origin x', 'git fetch', 'git remote update', 'git remote -v show']) assert.equal(isOutward(cmd, P.ctx()), true, cmd);
});

test('review-final: a recursive reader checks every operand, and its folder when it names none', () => {
  for (const [cmd, cwd] of [['grep -r foo', P.home], ['grep -r token Desktop/..', P.home], [`cd ${P.home} && grep -r foo`, P.ws], [`cd ${join(P.home, '..')} && grep -r token home`, P.ws], ['find', P.home], ['ls -R', P.home], ['rg token', P.home]]) assert.equal(tier(cmd, cwd), 'refused', `${cmd} in ${cwd}`);
  for (const cmd of ['git show :.env', 'git show :0:.env', 'diff -r ~ x', 'find -L ~ -name x', 'grep -d recurse token ~', 'grep -r -eKEY ~']) assert.equal(tier(cmd), 'refused', `sibling form: ${cmd}`);
  for (const [cmd, cwd] of [['grep -r foo', join(P.ws, 'src')], ['grep -r foo src', P.ws], [`cd ${P.home} && grep -r foo Desktop`, P.ws], ['find . -name x', join(P.home, 'Desktop')]]) assert.notEqual(tier(cmd, cwd), 'refused', `${cmd} in ${cwd}`);
});

test('L6 file -C compiles a magic file, so it is not a reader; L7 writes into .git/worktrees are refused', () => {
  const c = P.ctx(P.ws, { doneCheck: 'node check.mjs' });
  for (const cmd of ['file -C -m x.magic || true', 'file --compile x || true']) assert.notEqual(classify(cmd, c).tier, 'split', cmd);
  assert.equal(isOutward('file -C -m x.magic', P.ctx()), true);
  assert.equal(classify('file ok.mjs || true', c).tier, 'split', 'plain file stays a reader');
  for (const cmd of ['touch .git/worktrees/w/HEAD', 'echo x > .git/worktrees/w/gitdir', 'cd .git && mkdir -p worktrees/w']) assert.equal(tier(cmd), 'refused', cmd);
  assert.notEqual(tier('cat .git/worktrees/w/HEAD'), 'refused', 'reading stays allowed');
});

test('C-4 a write into .git/hooks or .git/config is refused, never parked', () => {
  for (const cmd of ['echo x > .git/hooks/pre-commit', 'cp ok.mjs .git/hooks/pre-push', 'touch .git/config', 'cat ok.mjs >> .git/config', 'cd .git && touch hooks/post-checkout', 'cp ok.mjs gitlink/hooks/pre-commit']) {
    assert.equal(tier(cmd), 'refused', cmd);
  }
  assert.notEqual(tier('cat .git/config'), 'refused', 'reading .git/config is not a write');
});

test('C-5 link chains resolve fully: a loop is protected, and a two-hop chain into the agy home is refused', () => {
  for (const cmd of ['touch loopa/x', 'mkdir loopb', 'touch hop1/new.json', 'cp ok.mjs hop1']) assert.equal(tier(cmd), 'refused', cmd);
});

test('S-A4-05 the charter allows git add of named files and a plain commit on its branch only', () => {
  const ch = { branch: 'feat/qa', repo: '.' };
  const c = P.ctx();
  assert.equal(charterAllows('git add src/a.mjs && git commit -m "row 1"', c, ch), true);
  assert.equal(charterAllows('git commit -q -F msg.txt', c, ch), true);
  assert.equal(charterAllows('git commit -a -m x', c, ch), true);
  for (const bad of ['git commit --amend -m x', 'git commit -n -m x', 'git commit --no-verify -m x', 'git -c a=b commit -m x', `git -C ${P.outside} commit -m x`,
    'git ci -m x', 'A=1 git commit -m x', 'git commit -m "$(id)"', 'git commit -m "`id`"', 'git add -A && git commit -m x', 'git add . && git commit -m x',
    'git commit -m x && git push', 'git push', 'git tag v1', 'git reset --hard']) {
    assert.equal(charterAllows(bad, c, ch), false, bad);
  }
  assert.equal(charterAllows('git commit -m x', c, { branch: 'main', repo: '.' }), false, 'another branch');
  assert.equal(charterAllows('git commit -m x', c, { branch: 'feat/qa', repo: P.outside }), false, 'another repo');
});

test('S-A4-05 a linked worktree .git file is read for the branch', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'litgravity-wt-')));
  const gitdir = join(root, 'main.git', 'worktrees', 'wt');
  mkdirSync(gitdir, { recursive: true });
  writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/feat/qa\n');
  const wt = join(root, 'wt');
  mkdirSync(wt);
  writeFileSync(join(wt, '.git'), `gitdir: ${gitdir}\n`);
  const c = { workspace: wt, cwd: wt, env: process.env };
  assert.equal(charterAllows('git commit -m x', c, { branch: 'feat/qa', repo: '.' }), true);
  writeFileSync(join(gitdir, 'HEAD'), 'ref: refs/heads/other\n');
  assert.equal(charterAllows('git commit -m x', c, { branch: 'feat/qa', repo: '.' }), false);
});
