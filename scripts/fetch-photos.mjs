// Downloads candidate demo/test photos from Wikimedia Commons with their author and license.
// Usage: node scripts/fetch-photos.mjs  -> data/candidates/*.jpg + data/candidates.json
// Only freely licensed files (public domain, CC0, CC BY, CC BY-SA) are kept.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'data', 'candidates');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TantiyaHackathon/0.1 (offline damage triage demo; contact via GitHub repo)';

const SOURCES = [
  { category: 'Aftermath of Typhoon Haiyan in Tacloban City', limit: 60 },
  { category: 'Aftermath of Typhoon Haiyan in Guiuan', limit: 20 },
  { category: 'Aftermath of Typhoon Haiyan (2013)', limit: 20 },
  { category: 'Effects of Typhoon Fung-wong (2025) in the Philippines', limit: 40 },
  { category: 'Nipa huts in the Philippines', limit: 20 },
  { search: 'house damaged typhoon Philippines roof', limit: 30 },
  { search: 'FEMA hurricane damaged home roof', limit: 30 },
];

const FREE = /^(public domain|pd|cc0|cc by(-sa)? [\d.]+|cc by(-sa)?)/i;
const stripHtml = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

async function listFiles(source) {
  const base = source.category
    ? { generator: 'categorymembers', gcmtitle: `Category:${source.category}`, gcmtype: 'file', gcmlimit: String(source.limit) }
    : { generator: 'search', gsrsearch: `${source.search} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(source.limit) };
  const data = await api({
    action: 'query', ...base, prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime', iiurlwidth: '1024',
    iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription',
  });
  return Object.values(data.query?.pages ?? {}).map((p) => {
    const ii = p.imageinfo?.[0] ?? {};
    const meta = ii.extmetadata ?? {};
    return {
      title: p.title.replace(/^File:/, ''),
      source: source.category ?? `search: ${source.search}`,
      mime: ii.mime,
      thumbUrl: ii.thumburl,
      pageUrl: ii.descriptionurl,
      license: meta.LicenseShortName?.value ?? '',
      author: stripHtml(meta.Artist?.value),
      description: stripHtml(meta.ImageDescription?.value).slice(0, 300),
    };
  });
}

await fs.mkdir(outDir, { recursive: true });
const seen = new Set();
const kept = [];
for (const source of SOURCES) {
  const files = await listFiles(source);
  for (const f of files) {
    if (seen.has(f.title) || f.mime !== 'image/jpeg' || !f.thumbUrl || !FREE.test(f.license)) continue;
    seen.add(f.title);
    const id = `c${String(kept.length + 1).padStart(3, '0')}`;
    const res = await fetch(f.thumbUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    await fs.writeFile(path.join(outDir, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
    kept.push({ id, ...f });
    process.stdout.write(`${id} ${f.license.padEnd(14)} ${f.title.slice(0, 70)}\n`);
  }
}
await fs.writeFile(path.join(root, 'data', 'candidates.json'), JSON.stringify(kept, null, 2));
console.log(`\nSaved ${kept.length} candidates to data/candidates/`);
