// One-at-a-time AI job queue. A single laptop GPU can only run one vision request efficiently,
// so photos are processed in upload order and progress is broadcast to the browser.
import path from 'node:path';
import { assessPhoto } from './ai.js';
import { config } from './config.js';
import { queries, toAssessment } from './db.js';
import { broadcast } from './events.js';

const pending = [];
let running = false;
let batch = { total: 0, done: 0 };

function progress() {
  return { total: batch.total, done: batch.done, queued: pending.length, running };
}

export function enqueue(id, photoFile) {
  if (!running && pending.length === 0) batch = { total: 0, done: 0 };
  pending.push({ id, photoFile });
  batch.total += 1;
  broadcast('progress', progress());
  void drain();
}

export function queueState() {
  return progress();
}

async function drain() {
  if (running) return;
  running = true;
  while (pending.length) {
    const job = pending.shift();
    if (!queries.getAssessment.get(job.id)) {
      batch.done += 1; // deleted while waiting
      continue;
    }
    queries.setRunning.run(job.id);
    broadcast('assessment', toAssessment(queries.getAssessment.get(job.id)));
    broadcast('progress', progress());
    try {
      const r = await assessPhoto(path.join(config.uploadsDir, job.photoFile));
      queries.setResult.run(JSON.stringify(r.ai), r.category, JSON.stringify(r.flags), r.model, r.promptVersion, r.seconds, job.id);
    } catch (err) {
      const message = /ECONNREFUSED|fetch failed/.test(err.message)
        ? 'The AI engine (Ollama) is not running on this laptop.'
        : err.message;
      queries.setError.run(message, job.id);
    }
    batch.done += 1;
    const row = queries.getAssessment.get(job.id);
    if (row) broadcast('assessment', toAssessment(row));
    broadcast('progress', progress());
  }
  running = false;
  broadcast('progress', progress());
}

/** On server start, put back any photos that were waiting when the app last stopped. */
export function resumePending() {
  for (const row of queries.pendingAssessments.all()) enqueue(row.id, row.photo_file);
}
