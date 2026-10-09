// Clears all photos, assessments and households (for a fresh demo). Stop the server first.
// Usage: npm run reset        then optionally: npm run seed
import fs from 'node:fs';
import { config } from '../server/config.js';

for (const f of [config.dbFile, `${config.dbFile}-wal`, `${config.dbFile}-shm`]) fs.rmSync(f, { force: true });
fs.rmSync(config.uploadsDir, { recursive: true, force: true });
console.log('Cleared all Tantiya data. Run "npm run seed" to load the sample families.');
