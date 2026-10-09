// Copies the stage demo photos into data/demo/ so they can be dropped into Intake in one go.
// Usage: node scripts/demo-set.mjs p001 p010 ...   (defaults to the list below)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Chosen for a 5-minute demo: clear cases from every category plus one honest edge case to override.
const DEFAULT = ['p002', 'p004', 'p009', 'p010', 'p011', 'p014', 'p016', 'p024', 'p029', 'p031'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

const dir = path.join(root, 'data', 'demo');
await fs.rm(dir, { recursive: true, force: true });
await fs.mkdir(dir, { recursive: true });
for (const [i, id] of ids.entries()) {
  await fs.copyFile(path.join(root, 'data', 'photos', `${id}.jpg`), path.join(dir, `${String(i + 1).padStart(2, '0')}-${id}.jpg`));
}
console.log(`Copied ${ids.length} demo photos to data/demo/`);
