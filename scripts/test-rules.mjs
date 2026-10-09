// Unit tests for the safety rules applied after the model answers (server/ai.js applyRules).
// Usage: npm test
import assert from 'node:assert/strict';
import { applyRules } from '../server/ai.js';

const base = { main_subject: 'house_or_building', is_house_visible: true, roof: 'intact', walls: 'intact', structure: 'standing', category: 'MINOR' };
const codes = (r) => r.flags.map((f) => f.code);
const cases = [
  ['intact house stays Minor, no flags', { ...base }, 'MINOR', []],
  ['people photo with no house parts becomes Not a house', { ...base, main_subject: 'people', is_house_visible: false, roof: 'not_visible', walls: 'not_visible', structure: 'not_visible', category: 'PARTIAL' }, 'NOT_A_HOUSE', ['no_house']],
  // Regression: found in rehearsal. Debris of houses must keep its category, not become Not a house.
  ['debris field keeps Total and is flagged', { ...base, main_subject: 'debris_field', is_house_visible: false, roof: 'mostly_gone', walls: 'not_visible', structure: 'collapsed', category: 'TOTAL' }, 'TOTAL', ['house_unclear', 'wide_shot']],
  ['Minor with collapsed structure is flagged', { ...base, roof: 'mostly_gone', structure: 'collapsed', category: 'MINOR' }, 'MINOR', ['inconsistent']],
  ['Total with everything intact is flagged', { ...base, category: 'TOTAL' }, 'TOTAL', ['inconsistent']],
  ['leaning structure is flagged for an on-site check', { ...base, roof: 'partly_damaged', structure: 'leaning', category: 'PARTIAL' }, 'PARTIAL', ['leaning']],
  ['Not a house while a house is visible is flagged', { ...base, category: 'NOT_A_HOUSE' }, 'NOT_A_HOUSE', ['check_subject']],
];

for (const [name, input, category, flags] of cases) {
  const r = applyRules(input);
  assert.equal(r.category, category, name);
  assert.deepEqual(codes(r), flags, name);
  console.log(`ok  ${name}`);
}
console.log(`\n${cases.length} rule tests passed.`);
