// Checks the duplicate detector: every planted near-duplicate must be caught,
// and every distinct family must not be flagged. Needs the sample families seeded.
// Usage: node scripts/test-dedupe.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../server/config.js';
import { queries } from '../server/db.js';
import { findDuplicates } from '../server/dedupe.js';

const demo = JSON.parse(await fs.readFile(path.join(config.dataDir, 'demo-duplicates.json'), 'utf8'));
const names = new Map(queries.allHouseholdsForDedupe.all().map((h) => [h.id, h.head_name]));
let failures = 0;

for (const d of demo.duplicates) {
  const { matches } = await findDuplicates({ head_name: d.headName, barangay: d.barangay, street_purok: d.streetPurok });
  const top = matches[0];
  const ok = top && names.get(top.id) === d.duplicateOf;
  if (!ok) failures++;
  console.log(`${ok ? 'CAUGHT ' : 'MISSED '} "${d.headName}" -> ${top ? `${names.get(top.id)} (${top.reason}, ${top.score})` : 'no match'}`);
}
for (const d of demo.distinct) {
  const { matches } = await findDuplicates({ head_name: d.headName, barangay: d.barangay, street_purok: d.streetPurok });
  const ok = matches.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'CLEAR  ' : 'FALSE+ '} "${d.headName}"${ok ? '' : ` -> ${names.get(matches[0].id)} (${matches[0].score})`}`);
}
console.log(failures ? `\n${failures} problem(s). Threshold is ${config.duplicateThreshold}.` : '\nAll duplicate checks passed.');
process.exit(failures ? 1 : 0);
