// Playwright skeleton for browser-drive. Copy to .litgravity/evidence/<slug>/drive.cjs and fill in STEPS.
//   TARGET_URL=<url> node drive.cjs <out-dir>
// CommonJS on purpose: NODE_PATH="$(npm root -g)" then finds a global Playwright install.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const out = process.argv[2];
const target = process.env.TARGET_URL;
if (!out || !target) {
  console.error('usage: TARGET_URL=<url> node drive.cjs <out-dir>');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const log = [];
const note = (text) => { log.push(text); console.log(text); };

// Fill in one function per step. Each step ends with a screenshot, so a failure leaves the page state behind.
const STEPS = [
  async (page) => {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(out, 'step-01.png'), fullPage: true });
    note(`step 1: opened ${page.url()} title=${JSON.stringify(await page.title())}`);
  },
  // async (page) => { await page.getByRole('button', { name: 'Save' }).click(); ... },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const extracted = {};
  let failed = null;
  try {
    for (const [i, step] of STEPS.entries()) {
      try { await step(page, extracted); } catch (error) {
        failed = { step: i + 1, message: String(error && error.message || error).split('\n')[0] };
        await page.screenshot({ path: path.join(out, `fail-step-${i + 1}.png`), fullPage: true }).catch(() => {});
        break;
      }
    }
  } finally {
    await context.tracing.stop({ path: path.join(out, 'trace.zip') }).catch(() => {});
    await browser.close();
    fs.writeFileSync(path.join(out, 'extracted.json'), JSON.stringify(extracted, null, 2));
    fs.writeFileSync(path.join(out, 'run.log'), log.join('\n') + '\n');
  }
  if (failed) { console.error(`FAIL step ${failed.step}: ${failed.message}`); process.exit(1); }
  console.log('PASS: all steps ran');
})();
