import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS households (
    id            INTEGER PRIMARY KEY,
    head_name     TEXT NOT NULL,
    barangay      TEXT NOT NULL,
    street_purok  TEXT,
    family_size   INTEGER,
    contact       TEXT,
    embedding     TEXT,
    is_sample     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id              INTEGER PRIMARY KEY,
    photo_file      TEXT NOT NULL,
    original_name   TEXT,
    household_id    INTEGER REFERENCES households(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | error
    ai_json         TEXT,
    ai_category     TEXT,
    flags           TEXT NOT NULL DEFAULT '[]',
    final_category  TEXT,
    overridden      INTEGER NOT NULL DEFAULT 0,
    note            TEXT,
    model           TEXT,
    prompt_version  TEXT,
    seconds         REAL,
    error           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    decided_at      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
  CREATE INDEX IF NOT EXISTS idx_households_barangay ON households(barangay);
`);

export const CATEGORIES = ['TOTAL', 'PARTIAL', 'MINOR', 'NOT_A_HOUSE'];

/** Turns a raw assessments row into the shape the API returns. */
export function toAssessment(row) {
  if (!row) return null;
  return {
    id: row.id,
    photoUrl: `/photos/${row.photo_file}`,
    originalName: row.original_name,
    householdId: row.household_id,
    household: row.h_id
      ? { id: row.h_id, headName: row.h_name, barangay: row.h_barangay, streetPurok: row.h_street }
      : null,
    status: row.status,
    ai: row.ai_json ? JSON.parse(row.ai_json) : null,
    aiCategory: row.ai_category,
    flags: JSON.parse(row.flags ?? '[]'),
    finalCategory: row.final_category,
    overridden: Boolean(row.overridden),
    note: row.note,
    model: row.model,
    promptVersion: row.prompt_version,
    seconds: row.seconds,
    error: row.error,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

const assessmentSelect = `
  SELECT a.*, h.id AS h_id, h.head_name AS h_name, h.barangay AS h_barangay, h.street_purok AS h_street
  FROM assessments a LEFT JOIN households h ON h.id = a.household_id`;

export const queries = {
  listAssessments: db.prepare(`${assessmentSelect} ORDER BY a.id DESC`),
  getAssessment: db.prepare(`${assessmentSelect} WHERE a.id = ?`),
  insertAssessment: db.prepare(
    'INSERT INTO assessments (photo_file, original_name) VALUES (?, ?) RETURNING id',
  ),
  pendingAssessments: db.prepare(
    "SELECT id, photo_file FROM assessments WHERE status IN ('queued', 'running') ORDER BY id",
  ),
  setRunning: db.prepare("UPDATE assessments SET status = 'running', error = NULL WHERE id = ?"),
  setResult: db.prepare(`
    UPDATE assessments
    SET status = 'done', ai_json = ?, ai_category = ?, flags = ?, model = ?, prompt_version = ?, seconds = ?, error = NULL
    WHERE id = ?`),
  setError: db.prepare("UPDATE assessments SET status = 'error', error = ? WHERE id = ?"),
  requeue: db.prepare(
    "UPDATE assessments SET status = 'queued', error = NULL, final_category = NULL, overridden = 0, decided_at = NULL WHERE id = ?",
  ),
  decide: db.prepare(`
    UPDATE assessments
    SET final_category = ?, overridden = ?, note = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?`),
  undecide: db.prepare(
    'UPDATE assessments SET final_category = NULL, overridden = 0, note = NULL, decided_at = NULL WHERE id = ?',
  ),
  linkHousehold: db.prepare('UPDATE assessments SET household_id = ? WHERE id = ?'),
  deleteAssessment: db.prepare('DELETE FROM assessments WHERE id = ? RETURNING photo_file'),

  listHouseholds: db.prepare(`
    SELECT h.*, (SELECT COUNT(*) FROM assessments a WHERE a.household_id = h.id) AS photo_count
    FROM households h ORDER BY h.head_name COLLATE NOCASE`),
  getHousehold: db.prepare('SELECT * FROM households WHERE id = ?'),
  allHouseholdsForDedupe: db.prepare(
    'SELECT id, head_name, barangay, street_purok, family_size, embedding FROM households',
  ),
  insertHousehold: db.prepare(`
    INSERT INTO households (head_name, barangay, street_purok, family_size, contact, embedding, is_sample)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`),
  setEmbedding: db.prepare('UPDATE households SET embedding = ? WHERE id = ?'),
};

export function toHousehold(row) {
  return {
    id: row.id,
    headName: row.head_name,
    barangay: row.barangay,
    streetPurok: row.street_purok,
    familySize: row.family_size,
    contact: row.contact,
    isSample: Boolean(row.is_sample),
    photoCount: row.photo_count ?? 0,
    createdAt: row.created_at,
  };
}
