// Local vision AI: asks a model running in Ollama on this machine to describe a house photo
// and suggest a damage category. Nothing here talks to the internet.
import fs from 'node:fs/promises';
import { config } from './config.js';

// Prompt versions are kept side by side so `npm run eval` can compare them on the labeled set.
// v2 is the default: it was the best version in testing. v3 (more context) did worse on 2 of 3 photos.
export const PROMPT_VERSION = process.env.TANTIYA_PROMPT ?? 'v2';

const PART_STATE = ['intact', 'partly_damaged', 'mostly_gone', 'not_visible'];

// Field order matters: the model writes JSON top to bottom, so it describes the photo
// before it commits to a category. This "describe first" order fixed invented damage in testing.
export const SCHEMA = {
  type: 'object',
  properties: {
    photo_description: { type: 'string' },
    main_subject: {
      type: 'string',
      enum: ['house_or_building', 'people', 'debris_field', 'vehicle_or_aircraft', 'landscape', 'other'],
    },
    is_house_visible: { type: 'boolean' },
    roof: { type: 'string', enum: PART_STATE },
    walls: { type: 'string', enum: PART_STATE },
    structure: { type: 'string', enum: ['standing', 'leaning', 'collapsed', 'not_visible'] },
    category: { type: 'string', enum: ['TOTAL', 'PARTIAL', 'MINOR', 'NOT_A_HOUSE'] },
    reason: { type: 'string' },
  },
  required: ['photo_description', 'main_subject', 'is_house_visible', 'roof', 'walls', 'structure', 'category', 'reason'],
};

const PROMPT_V2 = `You help a municipal social welfare officer triage photos of houses after a typhoon.
First write photo_description: one plain sentence about what the photo actually shows. Then choose main_subject. If main_subject is not house_or_building or debris_field, the category MUST be NOT_A_HOUSE and roof/walls/structure MUST be not_visible. Otherwise suggest a category:
- TOTAL: the house is destroyed or no longer safe to live in (roof, walls, posts, floor or beams unusable).
- PARTIAL: only part of the house is damaged; it can still be lived in safely and repaired.
- MINOR: little or no visible damage.
- NOT_A_HOUSE: no house is clearly visible in the photo.
Give a one-sentence reason that names the visible damage. The officer makes the final decision.
Answer as JSON matching this schema: ${JSON.stringify(SCHEMA)}`;

const PROMPT_V3 = `You help a municipal social welfare officer in the Philippines sort photos of houses after a typhoon.
Houses may be concrete, wood, bamboo or nipa, often with corrugated metal (yero) roofs.

Work in this order:
1. photo_description: one plain sentence about what the photo actually shows. Do not guess beyond what is visible.
2. main_subject: what the photo is mainly of.
3. is_house_visible: true only if at least one house or its remains are clearly visible.
4. roof, walls, structure: the visible condition of the main house. Use not_visible if you cannot see that part.
5. category, using the DSWD Emergency Shelter Assistance meanings:
   - TOTAL: the house is destroyed or no longer safe to live in. Roof, walls, posts, floor or beams are unusable, or the structure collapsed.
   - PARTIAL: only part of the house is damaged. It still stands, can still be lived in safely, and can be repaired.
   - MINOR: little or no visible damage.
   - NOT_A_HOUSE: no house is clearly visible (for example people, tents, vehicles, relief goods, landscapes).
6. reason: one short sentence naming the visible evidence for the category.

The officer makes the final decision; give your honest best suggestion.
Answer only with JSON matching this schema: ${JSON.stringify(SCHEMA)}`;

// v4 = v2 plus one sentence on Philippine building materials. Added after the v2 evaluation showed
// intact nipa huts being called "partially damaged" (thatch and bamboo read as damage).
const PROMPT_V4 = PROMPT_V2.replace(
  'Otherwise suggest a category:',
  'Nipa (thatched palm) roofs, bamboo or woven walls, wooden houses and houses on stilts are normal Philippine building styles, not damage; judge damage only by parts that are missing, broken, collapsed or displaced. Otherwise suggest a category:',
);

const PROMPTS = { v2: PROMPT_V2, v3: PROMPT_V3, v4: PROMPT_V4 };
if (!PROMPTS[PROMPT_VERSION]) throw new Error(`Unknown TANTIYA_PROMPT "${PROMPT_VERSION}". Use one of: ${Object.keys(PROMPTS).join(', ')}`);
const PROMPT = PROMPTS[PROMPT_VERSION];

/** Rules applied in code after the model answers, so safety never depends on the prompt alone. */
export function applyRules(ai) {
  const flags = [];
  let category = ai.category;

  const partsSeen = [ai.roof, ai.walls, ai.structure].some((v) => v !== 'not_visible');
  const buildingSubject = ai.main_subject === 'house_or_building' || ai.main_subject === 'debris_field';
  if (!ai.is_house_visible && category !== 'NOT_A_HOUSE') {
    if (!partsSeen && !buildingSubject) {
      flags.push({ code: 'no_house', message: 'Model says no house is visible, so the suggestion was set to Not a house.' });
      category = 'NOT_A_HOUSE';
    } else {
      // e.g. a debris field: no standing house, but these are the remains of houses. Keep the category.
      flags.push({ code: 'house_unclear', message: 'No standing house is clearly visible. Check whether this shows the remains of a house.' });
    }
  }
  const severe = ai.roof === 'mostly_gone' || ai.walls === 'mostly_gone' || ai.structure === 'collapsed';
  const allIntact = ai.roof === 'intact' && ai.walls === 'intact' && ai.structure === 'standing';
  if (category === 'MINOR' && severe) {
    flags.push({ code: 'inconsistent', message: 'Severe damage noted but category is Minor. Check this one.' });
  }
  if (category === 'TOTAL' && allIntact) {
    flags.push({ code: 'inconsistent', message: 'Roof, walls and structure look intact but category is Total. Check this one.' });
  }
  if (category === 'NOT_A_HOUSE' && ai.is_house_visible) {
    flags.push({ code: 'check_subject', message: 'A house may be visible. Check whether it should be assessed.' });
  }
  if (ai.main_subject === 'debris_field') {
    flags.push({ code: 'wide_shot', message: 'Wide shot. It may show several houses; one category covers all of them.' });
  }
  if (ai.structure === 'leaning') {
    flags.push({ code: 'leaning', message: 'Structure looks leaning. Safety to live in needs an on-site check.' });
  }
  return { category, flags };
}

function validate(ai) {
  for (const key of SCHEMA.required) {
    if (!(key in ai)) throw new Error(`Model answer is missing "${key}"`);
  }
  for (const [key, spec] of Object.entries(SCHEMA.properties)) {
    if (spec.enum && !spec.enum.includes(ai[key])) throw new Error(`Unexpected value for ${key}: ${ai[key]}`);
  }
  return ai;
}

async function chat(imageBase64, signal) {
  const res = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: config.visionModel,
      stream: false,
      format: SCHEMA,
      keep_alive: '60m',
      options: { temperature: 0 },
      messages: [{ role: 'user', content: PROMPT, images: [imageBase64] }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return validate(JSON.parse(data.message.content));
}

/** Assesses one photo file. Retries once if the model returns invalid JSON. */
export async function assessPhoto(filePath) {
  const image = (await fs.readFile(filePath)).toString('base64');
  const started = performance.now();
  let ai;
  for (let attempt = 1; ; attempt++) {
    try {
      ai = await chat(image, AbortSignal.timeout(240_000));
      break;
    } catch (err) {
      if (attempt >= 2 || err.name === 'TimeoutError' || /ECONNREFUSED|fetch failed/.test(err.message)) throw err;
    }
  }
  const { category, flags } = applyRules(ai);
  return {
    ai,
    category,
    flags,
    model: config.visionModel,
    promptVersion: PROMPT_VERSION,
    seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
  };
}

/** Loads the model into memory so the first real photo does not pay the cold-start cost. */
export async function warmUp() {
  const res = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.visionModel, prompt: 'Reply with OK.', stream: false, keep_alive: '60m', options: { num_predict: 2 } }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`Warm-up failed: ${res.status}`);
}

/** Reports whether Ollama is reachable, which models exist, and whether the vision model is loaded. */
export async function ollamaStatus() {
  try {
    const [tags, ps] = await Promise.all([
      fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json()),
      fetch(`${config.ollamaUrl}/api/ps`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json()),
    ]);
    const has = (name) => tags.models?.some((m) => m.name === name || m.name === `${name}:latest`);
    const loaded = ps.models?.some((m) => m.name === config.visionModel || m.model === config.visionModel);
    return {
      reachable: true,
      visionModel: config.visionModel,
      visionInstalled: has(config.visionModel),
      embedModel: config.embedModel,
      embedInstalled: has(config.embedModel),
      warm: Boolean(loaded),
    };
  } catch {
    return { reachable: false, visionModel: config.visionModel, embedModel: config.embedModel, warm: false };
  }
}
