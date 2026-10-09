// Duplicate-household check. Step 1 is plain rules (normalised name + barangay).
// Step 2 compares local text embeddings so spelling variants like "P-3" vs "Purok 3" still match.
import { config } from './config.js';
import { queries } from './db.js';

const SUFFIXES = /\b(jr|sr|ii|iii|iv)\b/g;

export function normalizeName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // Peña -> pena
    .replace(/[.,'"`-]/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePlace(place = '') {
  return place
    .toLowerCase()
    .replace(/\bbrgy\b\.?|\bbgy\b\.?|\bbarangay\b/g, ' ')
    .replace(/\bp\s*-?\s*(\d+)\b/g, 'purok $1')
    .replace(/\bprk\b\.?/g, 'purok')
    .replace(/[.,'"`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function embeddingText(h) {
  // nomic-embed-text expects a task prefix; "clustering" suits similarity comparison.
  return `clustering: ${normalizeName(h.head_name)} | ${normalizePlace(h.barangay)} | ${normalizePlace(h.street_purok ?? '')}`;
}

export async function embed(household) {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.embedModel, input: embeddingText(household), keep_alive: '60m' }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embeddings?.[0] ?? null;
  } catch {
    return null; // embeddings are an extra signal; rules still work without them
  }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Returns households that look like the same family as `candidate`
 * ({ head_name, barangay, street_purok }), strongest match first.
 */
export async function findDuplicates(candidate, { excludeId } = {}) {
  const name = normalizeName(candidate.head_name);
  const barangay = normalizePlace(candidate.barangay);
  const vector = await embed(candidate);
  const matches = [];

  for (const h of queries.allHouseholdsForDedupe.all()) {
    if (h.id === excludeId) continue;
    const sameName = normalizeName(h.head_name) === name;
    const sameBarangay = normalizePlace(h.barangay) === barangay;
    if (sameName && sameBarangay) {
      matches.push({ id: h.id, score: 1, reason: 'Same name and barangay' });
      continue;
    }
    if (vector && h.embedding) {
      const score = cosine(vector, JSON.parse(h.embedding));
      if (score >= config.duplicateThreshold) {
        matches.push({ id: h.id, score: Number(score.toFixed(3)), reason: 'Very similar name and address' });
      }
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return { matches, vector };
}
