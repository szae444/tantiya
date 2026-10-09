// Loads the vision model into memory before a demo so the first photo is fast.
// Usage: npm run warmup
import { ollamaStatus, warmUp } from '../server/ai.js';

const before = await ollamaStatus();
if (!before.reachable) {
  console.error('Ollama is not running. Start the Ollama app, then run this again.');
  process.exit(1);
}
if (!before.visionInstalled) {
  console.error(`Model ${before.visionModel} is not installed. Run: ollama pull ${before.visionModel}`);
  process.exit(1);
}
const t = performance.now();
await warmUp();
console.log(`${before.visionModel} is loaded (${((performance.now() - t) / 1000).toFixed(1)} s). Ready for the demo.`);
