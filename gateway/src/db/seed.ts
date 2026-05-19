import pool from './connection.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pricing = JSON.parse(readFileSync(resolve(__dirname, 'pricing.json'), 'utf8'));

async function seed() {
  for (const [provider, models] of Object.entries(pricing)) {
    for (const [model, prices] of Object.entries(models as Record<string, any>)) {
      const { input, output, cache_read = 0, cache_write = 0 } = prices;
      await pool.query(
        `INSERT INTO model_pricing (provider, model, input_price, output_price, cache_read_price, cache_write_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (provider, model) DO UPDATE SET
           input_price = EXCLUDED.input_price,
           output_price = EXCLUDED.output_price,
           cache_read_price = EXCLUDED.cache_read_price,
           cache_write_price = EXCLUDED.cache_write_price,
           updated_at = NOW()`,
        [provider, model, input, output, cache_read, cache_write],
      );
    }
  }

  const { rows } = await pool.query('SELECT COUNT(*) FROM model_pricing');
  console.log(`[seed] imported ${rows[0].count} model pricing records`);

  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
