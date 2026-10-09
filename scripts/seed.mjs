// Loads the invented sample families from data/households.json (marked as sample data).
// Usage: npm run seed      (skips families that already exist)
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../server/config.js';
import { queries } from '../server/db.js';
import { embed, normalizeName, normalizePlace } from '../server/dedupe.js';

const families = JSON.parse(await fs.readFile(path.join(config.dataDir, 'households.json'), 'utf8'));
const existing = new Set(queries.allHouseholdsForDedupe.all().map((h) => `${normalizeName(h.head_name)}|${normalizePlace(h.barangay)}`));

let added = 0;
for (const f of families) {
  const h = { head_name: f.headName, barangay: f.barangay, street_purok: f.streetPurok ?? null };
  if (existing.has(`${normalizeName(h.head_name)}|${normalizePlace(h.barangay)}`)) continue;
  const vector = await embed(h);
  queries.insertHousehold.get(h.head_name, h.barangay, h.street_purok, f.familySize ?? null, null, vector ? JSON.stringify(vector) : null, 1);
  added++;
}
// Backfill embeddings that failed earlier (for example if Ollama was busy or offline).
let backfilled = 0;
for (const h of queries.allHouseholdsForDedupe.all().filter((x) => !x.embedding)) {
  const vector = await embed(h);
  if (vector) { queries.setEmbedding.run(JSON.stringify(vector), h.id); backfilled++; }
}
console.log(`Added ${added} sample families (${families.length - added} already present). Backfilled ${backfilled} embeddings.`);
