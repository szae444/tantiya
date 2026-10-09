// End-to-end check of the demo flow through the real UI (headless Edge/Chrome).
// Needs the server running (npm start) with sample families seeded. Saves screenshots to <outDir>.
// Usage: node scripts/e2e.mjs <outDir> [photo files...]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [outDir, ...photos] = process.argv.slice(2);
const base = process.env.APP_URL ?? 'http://localhost:8787';
const executablePath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('status of 409') && errors.push(m.text())); // 409 = expected duplicate response
// Offline proof: the browser must never request anything outside this machine.
const external = new Set();
page.on('request', (r) => {
  const { protocol, hostname } = new URL(r.url());
  if (/^https?:$/.test(protocol) && !['localhost', '127.0.0.1'].includes(hostname)) external.add(r.url());
});
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (msg) => console.log(`• ${msg}`);
const api = (p) => page.evaluate((u) => fetch(u).then((r) => r.json()), p);

// 1. Intake: upload through the real file input
await page.goto(`${base}/#/intake`, { waitUntil: 'domcontentloaded' });
await wait(800);
const before = (await api('/api/assessments')).length;
const input = await page.$('input[type=file][multiple]');
await input.uploadFile(...photos.map((p) => path.resolve(p)));
step(`uploaded ${photos.length} photos`);
await wait(2500);
await shot('1-intake-analyzing');

// 2. Wait for the AI to finish every new photo
const deadline = Date.now() + photos.length * 30_000 + 60_000;
for (;;) {
  const list = await api('/api/assessments');
  const fresh = list.slice(0, list.length - before);
  if (fresh.length >= photos.length && fresh.every((a) => a.status === 'done' || a.status === 'error')) {
    step(`AI finished: ${fresh.map((a) => `${a.originalName}=${a.aiCategory ?? a.status}`).join(', ')}`);
    break;
  }
  if (Date.now() > deadline) throw new Error('Timed out waiting for AI results');
  await wait(2000);
}

// 3. Triage board + review drawer: confirm with Enter, then override with a reason
await page.goto(`${base}/#/triage`, { waitUntil: 'domcontentloaded' });
await wait(1200);
await shot('2-triage-board');
const startBtn = await page.$$('button');
for (const b of startBtn) if ((await b.evaluate((e) => e.textContent)).includes('Start reviewing')) { await b.click(); break; }
await wait(900);
await shot('3-drawer');
await page.keyboard.press('Enter'); // confirm AI suggestion, auto-advance
await wait(900);
step('confirmed first photo with Enter');
const firstDecided = (await api('/api/assessments')).filter((a) => a.finalCategory).length;
if (firstDecided < 1) throw new Error('Enter did not confirm the suggestion');

// Override: pick a category different from the AI suggestion, Enter must ask for a reason first
const current = await page.evaluate(() => document.querySelector('[role=dialog] .font-mono')?.textContent);
const openAi = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button[aria-pressed]')].findIndex((b) => b.textContent.includes('AI')));
const key = String(((openAi + 1) % 4) + 1);
await page.keyboard.press(key);
await page.keyboard.press('Enter');
await wait(400);
const askedReason = await page.$('#note');
if (!askedReason) throw new Error('Override did not require a reason');
await page.type('#note', 'Walls are standing; only roof sheets are missing.');
await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
await wait(900);
step(`overrode photo (${current}) with a reason`);
const overridden = (await api('/api/assessments')).filter((a) => a.overridden).length;
if (overridden < 1) throw new Error('Override was not saved');

// 4. Link a household from the drawer via search
const search = await page.$('[role=dialog] input[placeholder^="Search family"]');
if (search) {
  await search.type('Bautista');
  await wait(400);
  const option = await page.$('[role=dialog] ul button');
  if (option) { await option.click(); await wait(700); step('linked a family via search'); }
}
await shot('4-drawer-linked');
await page.keyboard.press('Escape');

// 5. Households: a planted near-duplicate must be caught
await page.goto(`${base}/#/households`, { waitUntil: 'domcontentloaded' });
await wait(900);
const fields = await page.$$('aside form input');
await fields[0].type('Rosario Villanueba');
await fields[1].type('San Jose');
await fields[2].type('Purok 2');
await page.click('aside form button[type=submit]');
await wait(2500);
const dupShown = await page.evaluate(() => document.body.innerText.includes('Possible duplicate'));
await shot('5-households-duplicate');
if (!dupShown) throw new Error('Duplicate family was not flagged');
step('duplicate family flagged (Rosario Villanueba ~ Rosario Villanueva)');

// 6. Report
await page.goto(`${base}/#/report`, { waitUntil: 'domcontentloaded' });
await wait(1500);
await shot('6-report');
const csv = await page.evaluate(() => fetch('/api/export.csv').then((r) => r.text()));
step(`CSV export has ${csv.trim().split(/\r?\n/).length - 1} decided rows`);

// 7. Phone layout
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${base}/#/intake`, { waitUntil: 'domcontentloaded' });
await wait(900);
await shot('7-phone-intake');

await browser.close();
if (external.size) { console.log('Requests left this machine:\n' + [...external].join('\n')); process.exit(1); }
step('no request left this machine (fonts, icons and AI are all local)');
if (errors.length) { console.log('Browser errors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nEnd-to-end flow passed.');
