// Builds the test/demo set from data/selection.json:
//   data/photos/pNNN.jpg, data/labels.csv, ASSETS.md (credits + licenses for every photo).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const selection = JSON.parse(await fs.readFile(path.join(root, 'data', 'selection.json'), 'utf8'));
const candidates = JSON.parse(await fs.readFile(path.join(root, 'data', 'candidates.json'), 'utf8'));
const byId = new Map(candidates.map((c) => [c.id, c]));
const photosDir = path.join(root, 'data', 'photos');

await fs.rm(photosDir, { recursive: true, force: true });
await fs.mkdir(photosDir, { recursive: true });

const csv = ['file,label,note'];
const assets = [
  '# Assets',
  '',
  'All demo and test photos come from [Wikimedia Commons](https://commons.wikimedia.org) under free licenses.',
  'They were downloaded with `scripts/fetch-photos.mjs` and selected in `data/selection.json`.',
  'No photos were created or edited by the team except resizing to 1024 px.',
  '',
  '| File | Title on Commons | Author | License |',
  '|------|------------------|--------|---------|',
];

selection.photos.forEach((p, i) => {
  const c = byId.get(p.candidate);
  if (!c) throw new Error(`Unknown candidate ${p.candidate}`);
  const file = `p${String(i + 1).padStart(3, '0')}.jpg`;
  csv.push(`${file},${p.label},"${(p.note ?? '').replace(/"/g, '""')}"`);
  const title = c.title.replace(/\|/g, '\\|');
  const author = (c.author || 'Unknown').replace(/\|/g, '\\|').slice(0, 80);
  assets.push(`| ${file} | [${title}](${c.pageUrl}) | ${author} | ${c.license} |`);
});

for (const [i, p] of selection.photos.entries()) {
  await fs.copyFile(path.join(root, 'data', 'candidates', `${p.candidate}.jpg`), path.join(photosDir, `p${String(i + 1).padStart(3, '0')}.jpg`));
}
await fs.writeFile(path.join(root, 'data', 'labels.csv'), csv.join('\n') + '\n');
assets.push('', '## Software', '', 'See the Disclosures section of README.md for models, libraries and tools.', '');
await fs.writeFile(path.join(root, 'ASSETS.md'), assets.join('\n'));

const counts = selection.photos.reduce((m, p) => ({ ...m, [p.label]: (m[p.label] ?? 0) + 1 }), {});
console.log(`Built ${selection.photos.length} photos`, counts);
