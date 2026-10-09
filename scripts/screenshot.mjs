// Dev helper: screenshots app routes with the locally installed Edge/Chrome (no browser download).
// Usage: node scripts/screenshot.mjs <outDir> triage intake ...   (add "open:<n>" to open the nth card)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [outDir, ...routes] = process.argv.slice(2);
const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const executablePath = browsers.find((p) => fs.existsSync(p));
const base = process.env.APP_URL ?? 'http://localhost:8787';

const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
fs.mkdirSync(outDir, { recursive: true });
for (const spec of routes) {
  const [route, action] = spec.split('+');
  await page.goto(`${base}/#/${route}`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1500));
  if (action?.startsWith('open')) {
    const n = Number(action.split(':')[1] ?? 0);
    const cards = await page.$$('section button.card-in');
    if (cards[n]) { await cards[n].click(); await new Promise((r) => setTimeout(r, 900)); }
  }
  const file = path.join(outDir, `${spec.replace(/[^\w-]+/g, '_')}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
