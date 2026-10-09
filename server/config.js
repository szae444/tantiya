import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  ollamaUrl: (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
  visionModel: process.env.TANTIYA_MODEL ?? 'gemma3:4b',
  embedModel: process.env.TANTIYA_EMBED_MODEL ?? 'nomic-embed-text',
  // Cosine similarity above which two households are flagged as a possible duplicate.
  // Measured on the sample families: different families max 0.91 (median 0.81); a one-letter
  // typo duplicate scored 0.99. 0.95 sits between them. Run scripts/test-dedupe.mjs after changing.
  duplicateThreshold: Number(process.env.TANTIYA_DUP_THRESHOLD ?? 0.95),
  storageDir: path.join(root, 'storage'),
  uploadsDir: path.join(root, 'storage', 'uploads'),
  dbFile: path.join(root, 'storage', 'tantiya.db'),
  distDir: path.join(root, 'dist'),
  dataDir: path.join(root, 'data'),
};
