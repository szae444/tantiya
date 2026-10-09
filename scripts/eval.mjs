// Measures how often the local model's suggestion agrees with the labeled test set.
// Usage: npm run eval            (prompt v2)
//        TANTIYA_PROMPT=v3 npm run eval
// Output: a table in the terminal and results/eval-<date>-<prompt>.json (commit it).
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPhoto, PROMPT_VERSION, warmUp } from '../server/ai.js';
import { config } from '../server/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATS = ['TOTAL', 'PARTIAL', 'MINOR', 'NOT_A_HOUSE'];

const rows = (await fs.readFile(path.join(root, 'data', 'labels.csv'), 'utf8'))
  .trim().split(/\r?\n/).slice(1)
  .map((line) => { const [file, label] = line.split(','); return { file, label }; });

console.log(`Warming up ${config.visionModel} (not timed)…`);
await warmUp();

const results = [];
for (const [i, r] of rows.entries()) {
  const out = await assessPhoto(path.join(root, 'data', 'photos', r.file));
  results.push({ file: r.file, label: r.label, predicted: out.category, seconds: out.seconds, flags: out.flags.map((f) => f.code), reason: out.ai.reason });
  const ok = out.category === r.label;
  console.log(`${String(i + 1).padStart(2)}/${rows.length} ${r.file}  label=${r.label.padEnd(11)} ai=${out.category.padEnd(11)} ${ok ? 'agree' : 'DIFFERENT'}  ${out.seconds}s`);
}

const agree = results.filter((r) => r.label === r.predicted).length;
const confusion = Object.fromEntries(CATS.map((l) => [l, Object.fromEntries(CATS.map((p) => [p, results.filter((r) => r.label === l && r.predicted === p).length]))]));
const perClass = Object.fromEntries(CATS.map((c) => {
  const n = results.filter((r) => r.label === c).length;
  return [c, { photos: n, agreed: confusion[c][c] }];
}));
// "Damage vs no damage" view: did the model at least separate damaged houses (TOTAL/PARTIAL) from the rest?
const damaged = (c) => c === 'TOTAL' || c === 'PARTIAL';
const damageAgree = results.filter((r) => damaged(r.label) === damaged(r.predicted)).length;
const seconds = results.map((r) => r.seconds);

let gpu = 'unknown';
try { gpu = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', { encoding: 'utf8' }).trim(); } catch { /* no NVIDIA GPU */ }
let ollamaVersion = 'unknown';
try { ollamaVersion = (await (await fetch(`${config.ollamaUrl}/api/version`)).json()).version; } catch { /* ignore */ }

const report = {
  date: new Date().toISOString(),
  model: config.visionModel,
  promptVersion: PROMPT_VERSION,
  photos: results.length,
  agreement: { agreed: agree, total: results.length, percent: Number(((agree / results.length) * 100).toFixed(1)) },
  damagedVsNot: { agreed: damageAgree, total: results.length, percent: Number(((damageAgree / results.length) * 100).toFixed(1)) },
  perClass,
  confusion,
  secondsPerPhoto: {
    mean: Number((seconds.reduce((a, b) => a + b, 0) / seconds.length).toFixed(1)),
    min: Math.min(...seconds),
    max: Math.max(...seconds),
  },
  hardware: { cpu: os.cpus()[0]?.model.trim(), ramGB: Math.round(os.totalmem() / 2 ** 30), gpu, os: `${os.type()} ${os.release()}` },
  software: { node: process.version, ollama: ollamaVersion },
  labelsNote: 'Labels are draft labels from data/selection.json (made before running the model). See README for limitations.',
  results,
};

await fs.mkdir(path.join(root, 'results'), { recursive: true });
const file = path.join(root, 'results', `eval-${report.date.slice(0, 10)}-${PROMPT_VERSION}.json`);
await fs.writeFile(file, JSON.stringify(report, null, 2));

console.log(`\nAgreed with labels on ${agree} of ${results.length} photos (${report.agreement.percent}%).`);
console.log(`Damaged vs not damaged: ${damageAgree} of ${results.length} (${report.damagedVsNot.percent}%).`);
console.log('\nConfusion (rows = label, columns = AI):');
console.log(`${''.padEnd(12)}${CATS.map((c) => c.slice(0, 7).padStart(9)).join('')}`);
for (const l of CATS) console.log(`${l.padEnd(12)}${CATS.map((p) => String(confusion[l][p]).padStart(9)).join('')}`);
console.log(`\nSeconds per photo: mean ${report.secondsPerPhoto.mean}, min ${report.secondsPerPhoto.min}, max ${report.secondsPerPhoto.max}`);
console.log(`Saved ${path.relative(root, file)}`);
