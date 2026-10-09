import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { ollamaStatus, warmUp } from './ai.js';
import { config } from './config.js';
import { CATEGORIES, db, queries, toAssessment, toHousehold } from './db.js';
import { findDuplicates } from './dedupe.js';
import { broadcast, subscribe } from './events.js';
import { enqueue, queueState, resumePending } from './queue.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/photos', express.static(config.uploadsDir, { maxAge: '1h', immutable: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
      cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 200 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

const badRequest = (res, message) => res.status(400).json({ error: message });

// ---------- Status ----------

let internet = { online: false, checkedAt: 0 };
function checkInternet() {
  if (Date.now() - internet.checkedAt < 5000) return Promise.resolve(internet.online);
  return new Promise((resolve) => {
    const socket = net.connect({ host: '1.1.1.1', port: 443 });
    const done = (online) => {
      socket.destroy();
      internet = { online, checkedAt: Date.now() };
      resolve(online);
    };
    socket.setTimeout(1500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

app.get('/api/health', async (_req, res) => {
  const [ollama, online] = await Promise.all([ollamaStatus(), checkInternet()]);
  res.json({ ok: true, internet: online, ollama, queue: queueState(), lanUrls: lanUrls() });
});

app.get('/api/events', (req, res) => subscribe(req, res));

// ---------- Assessments ----------

app.get('/api/assessments', (_req, res) => {
  res.json(queries.listAssessments.all().map(toAssessment));
});

app.post('/api/photos', upload.array('photos', 200), (req, res) => {
  if (!req.files?.length) return badRequest(res, 'No JPG, PNG or WebP photos were received.');
  const created = req.files.map((file) => {
    const { id } = queries.insertAssessment.get(file.filename, file.originalname);
    const assessment = toAssessment(queries.getAssessment.get(id));
    broadcast('assessment', assessment);
    enqueue(id, file.filename);
    return assessment;
  });
  res.status(201).json(created);
});

app.patch('/api/assessments/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = queries.getAssessment.get(id);
  if (!row) return res.status(404).json({ error: 'Assessment not found' });
  const { finalCategory, note, householdId } = req.body ?? {};

  if (finalCategory !== undefined) {
    if (finalCategory === null) {
      queries.undecide.run(id);
    } else {
      if (!CATEGORIES.includes(finalCategory)) return badRequest(res, 'Unknown category');
      if (row.status !== 'done') return badRequest(res, 'Wait for the AI suggestion before deciding.');
      const overridden = finalCategory !== row.ai_category;
      if (overridden && !note?.trim()) return badRequest(res, 'Please add a short reason when changing the AI suggestion.');
      queries.decide.run(finalCategory, overridden ? 1 : 0, note?.trim() || null, id);
    }
  }
  if (householdId !== undefined) {
    if (householdId !== null && !queries.getHousehold.get(householdId)) return badRequest(res, 'Household not found');
    queries.linkHousehold.run(householdId, id);
  }
  const updated = toAssessment(queries.getAssessment.get(id));
  broadcast('assessment', updated);
  res.json(updated);
});

app.post('/api/assessments/:id/retry', (req, res) => {
  const id = Number(req.params.id);
  const row = queries.getAssessment.get(id);
  if (!row) return res.status(404).json({ error: 'Assessment not found' });
  if (row.status === 'queued' || row.status === 'running') return badRequest(res, 'Already waiting for the AI.');
  queries.requeue.run(id);
  enqueue(id, row.photo_file);
  const updated = toAssessment(queries.getAssessment.get(id));
  broadcast('assessment', updated);
  res.json(updated);
});

app.delete('/api/assessments/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = queries.deleteAssessment.get(id);
  if (!row) return res.status(404).json({ error: 'Assessment not found' });
  fs.rm(path.join(config.uploadsDir, row.photo_file), { force: true }, () => {});
  broadcast('assessment-deleted', { id });
  res.status(204).end();
});

// ---------- Households ----------

app.get('/api/households', (_req, res) => {
  res.json(queries.listHouseholds.all().map(toHousehold));
});

function readHousehold(body = {}) {
  const h = {
    head_name: String(body.headName ?? '').trim(),
    barangay: String(body.barangay ?? '').trim(),
    street_purok: String(body.streetPurok ?? '').trim() || null,
    family_size: body.familySize ? Number(body.familySize) : null,
    contact: String(body.contact ?? '').trim() || null,
  };
  if (!h.head_name || !h.barangay) return { error: 'Name of family head and barangay are required.' };
  if (h.family_size !== null && !(Number.isInteger(h.family_size) && h.family_size > 0 && h.family_size < 50)) {
    return { error: 'Family size must be a whole number.' };
  }
  return { h };
}

function describeMatches(matches) {
  return matches.map((m) => ({ ...m, household: toHousehold(queries.getHousehold.get(m.id)) }));
}

app.post('/api/households/check', async (req, res) => {
  const { h, error } = readHousehold(req.body);
  if (error) return badRequest(res, error);
  const { matches } = await findDuplicates(h);
  res.json({ duplicates: describeMatches(matches) });
});

app.post('/api/households', async (req, res) => {
  const { h, error } = readHousehold(req.body);
  if (error) return badRequest(res, error);
  const { matches, vector } = await findDuplicates(h);
  if (matches.length && !req.body.confirmedDifferent) {
    return res.status(409).json({ error: 'Possible duplicate household', duplicates: describeMatches(matches) });
  }
  const { id } = queries.insertHousehold.get(
    h.head_name, h.barangay, h.street_purok, h.family_size, h.contact, vector ? JSON.stringify(vector) : null, 0,
  );
  const household = toHousehold(queries.getHousehold.get(id));
  broadcast('household', household);
  res.status(201).json(household);
});

// ---------- Report & export ----------

app.get('/api/summary', (_req, res) => {
  const one = (sql) => db.prepare(sql).get();
  const all = (sql) => db.prepare(sql).all();
  res.json({
    totals: one(`SELECT COUNT(*) AS photos,
      SUM(status = 'done') AS analyzed, SUM(status IN ('queued','running')) AS waiting, SUM(status = 'error') AS errors,
      SUM(final_category IS NOT NULL) AS decided, SUM(overridden) AS overridden,
      ROUND(AVG(CASE WHEN status = 'done' THEN seconds END), 1) AS avgSeconds FROM assessments`),
    byFinal: all(`SELECT final_category AS category, COUNT(*) AS count FROM assessments
      WHERE final_category IS NOT NULL GROUP BY final_category`),
    byBarangay: all(`SELECT h.barangay, a.final_category AS category, COUNT(*) AS count
      FROM assessments a JOIN households h ON h.id = a.household_id
      WHERE a.final_category IS NOT NULL GROUP BY h.barangay, a.final_category ORDER BY h.barangay`),
    households: one('SELECT COUNT(*) AS count FROM households').count,
    models: all(`SELECT DISTINCT model, prompt_version AS promptVersion FROM assessments WHERE model IS NOT NULL`),
  });
});

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

app.get('/api/export.csv', (_req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.original_name, h.head_name, h.barangay, h.street_purok, h.family_size,
      a.ai_category, a.final_category, a.overridden, a.note, a.decided_at, a.model, a.prompt_version
    FROM assessments a LEFT JOIN households h ON h.id = a.household_id
    WHERE a.final_category IS NOT NULL ORDER BY h.barangay, h.head_name, a.id`).all();
  const header = ['Assessment ID', 'Photo', 'Family head', 'Barangay', 'Street / Purok', 'Family size',
    'AI suggestion', 'Final category (officer)', 'Changed by officer', 'Officer note', 'Decided at', 'Model', 'Prompt version'];
  const lines = rows.map((r) => [r.id, r.original_name, r.head_name, r.barangay, r.street_purok, r.family_size,
    r.ai_category, r.final_category, r.overridden ? 'yes' : 'no', r.note, r.decided_at, r.model, r.prompt_version].map(csvCell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tantiya-masterlist-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + [header.join(','), ...lines].join('\r\n')); // BOM so Excel reads UTF-8 names correctly
});

// ---------- Web app ----------

if (fs.existsSync(config.distDir)) {
  app.use(express.static(config.distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(config.distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Something went wrong' });
});

function lanUrls() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${config.port}`);
}

app.listen(config.port, config.host, () => {
  console.log(`Tantiya running at http://localhost:${config.port}`);
  for (const url of lanUrls()) console.log(`  on this network: ${url}`);
  resumePending();
  warmUp()
    .then(() => console.log(`AI model ${config.visionModel} is loaded and ready.`))
    .catch((err) => console.warn(`Could not warm up the AI model: ${err.message}`));
});
