import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fetchBytes } from '../plugin/skills/lit-hijack/scripts/hijack.mjs';
import { fetchAssets } from '../plugin/skills/lit-typographic-motion/engine/node/assets.mjs';

// The lit-hijack capture and the motion asset fetch reach only public https hosts, on every redirect, and connect to
// the address the check approved, so a name that answers public for the check and private for the connection (DNS
// rebinding) cannot move the socket. node:https is faked at its own level: the fake calls the lookup it was handed, the
// way net.connect does, with and without `all`.

const PUBLIC = '93.184.216.34';
// Public for the first question about a name, loopback for every later one.
function rebinding() {
  const asked = new Map();
  const lookup = async (host) => {
    const n = asked.get(host) ?? 0;
    asked.set(host, n + 1);
    return [{ address: n === 0 ? PUBLIC : '127.0.0.1', family: 4 }];
  };
  return { lookup, asked };
}
const publicLookup = async () => [{ address: PUBLIC, family: 4 }];
// Each answer is { status, headers, body } in request order; `connected` gets every address the socket was given.
function fakeRequest(connected, answers) {
  let n = 0;
  return (href, options, onResponse) => {
    const req = new EventEmitter();
    req.end = () => {
      const host = new URL(href).hostname;
      options.lookup(host, { all: true }, (_e, list) => {
        connected.push(...list.map(({ address }) => address));
        options.lookup(host, {}, (_e2, address) => {
          connected.push(address);
          const a = answers[Math.min(n++, answers.length - 1)];
          const res = Readable.from([Buffer.from(a.body ?? '')]);
          res.statusCode = a.status ?? 200;
          res.headers = a.headers ?? { 'content-type': 'text/html' };
          onResponse(res);
        });
      });
    };
    return req;
  };
}

test('lit-hijack fetch: connects to the address its hop check approved, not to a second answer', async () => {
  const { lookup, asked } = rebinding();
  const connected = [];
  const { buffer, finalUrl } = await fetchBytes('https://rebind.example/page', { lookup, request: fakeRequest(connected, [{ body: 'hello' }]) });
  assert.equal(buffer.toString('utf8'), 'hello');
  assert.equal(finalUrl, 'https://rebind.example/page');
  assert.ok(connected.length >= 2);
  assert.deepEqual([...new Set(connected)], [PUBLIC], 'the socket never reaches the rebound address');
  assert.equal(asked.get('rebind.example'), 1, 'the name is resolved once, by the check');
});

test('lit-hijack fetch: http, a private host, a name that resolves private and a redirect into one are refused', async () => {
  const request = fakeRequest([], [{ body: 'x' }]);
  await assert.rejects(fetchBytes('http://example.com/', { lookup: publicLookup, request }), /https only/);
  await assert.rejects(fetchBytes('https://127.0.0.1/', { lookup: publicLookup, request }), /private host/);
  await assert.rejects(fetchBytes('https://[::ffff:169.254.169.254]/', { lookup: publicLookup, request }), /private host/);
  await assert.rejects(fetchBytes('https://inside.example/', { lookup: async () => [{ address: '10.0.0.5', family: 4 }], request }), /resolves to a private address/);
  const bounce = fakeRequest([], [{ status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } }]);
  await assert.rejects(fetchBytes('https://example.com/', { lookup: publicLookup, request: bounce }), /private host/);
});

test('lit-hijack fetch: a redirect to a public host is followed and the body is capped while it streams', async () => {
  const connected = [];
  const hop = fakeRequest(connected, [{ status: 301, headers: { location: '/moved' } }, { body: 'moved here' }]);
  const { buffer, finalUrl } = await fetchBytes('https://example.com/', { lookup: publicLookup, request: hop });
  assert.equal(buffer.toString('utf8'), 'moved here');
  assert.equal(finalUrl, 'https://example.com/moved');
  const big = fakeRequest([], [{ headers: {}, body: 'x'.repeat(2048) }]);
  await assert.rejects(fetchBytes('https://example.com/', { lookup: publicLookup, request: big, limit: 1024 }), /larger than 1024 bytes/);
});

test('motion asset fetch: connects to the address its hop check approved', async () => {
  const out = mkdtempSync(join(tmpdir(), 'motion-pin-'));
  try {
    const { lookup, asked } = rebinding();
    const connected = [];
    await fetchAssets({ out, url: 'https://rebind.example', lookup, request: fakeRequest(connected, [{ body: '<html><title>x</title></html>' }]) }).catch(() => null);
    assert.ok(connected.length >= 2, 'the page was requested through the pinned transport');
    assert.deepEqual([...new Set(connected)], [PUBLIC]);
    assert.equal(asked.get('rebind.example'), 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('motion asset fetch: an og:image on a private address or behind a private redirect is not fetched', async () => {
  const out = mkdtempSync(join(tmpdir(), 'motion-pin-'));
  try {
    const page = '<html><head><meta property="og:image" content="https://127.0.0.1/logo.png"><link rel="icon" href="https://cdn.example/i.png"></head></html>';
    const connected = [];
    const request = fakeRequest(connected, [{ body: page }, { status: 302, headers: { location: 'https://192.168.1.1/i.png' } }]);
    const r = await fetchAssets({ out, url: 'https://example.com', lookup: publicLookup, request }).catch((e) => e);
    assert.ok(!connected.includes('127.0.0.1') && !connected.includes('192.168.1.1'));
    const problems = JSON.stringify(r?.product ?? r?.message ?? r);
    assert.match(problems, /private host/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
