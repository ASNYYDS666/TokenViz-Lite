import cron from 'node-cron';
import pool from '../db/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aggregationSQL = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'aggregation.sql'),
  'utf8',
);

export function startScheduler() {
  cron.schedule('5 * * * *', async () => {
    try {
      await pool.query(aggregationSQL);
      console.log('[scheduler] hourly aggregation completed');
    } catch (err) {
      console.error('[scheduler] aggregation failed:', err);
    }
  });

  console.log('[scheduler] started (runs at :05 each hour)');
}
