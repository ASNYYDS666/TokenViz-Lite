import pool from '../db/connection.js';
import type { AlertStatusItem } from '../api/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_CONFIG_PATH = path.join(__dirname, '..', '..', 'alert-config.json');

const DEFAULT_CONFIG = {
  enabled: false,
  daily_limit: 5.0,
  weekly_limit: 30.0,
  monthly_limit: 100.0,
};

export function readAlertConfig(): { enabled: boolean; daily_limit: number; weekly_limit: number; monthly_limit: number } {
  try {
    if (fs.existsSync(ALERT_CONFIG_PATH)) {
      const raw = fs.readFileSync(ALERT_CONFIG_PATH, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_CONFIG };
}

export function writeAlertConfig(config: { enabled: boolean; daily_limit: number; weekly_limit: number; monthly_limit: number }): void {
  fs.writeFileSync(ALERT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function getAlertStatus(): Promise<AlertStatusItem[]> {
  const config = readAlertConfig();
  if (!config.enabled) return [];

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= $1 THEN total_cost ELSE 0 END), 0) AS daily_cost,
      COALESCE(SUM(CASE WHEN created_at >= $2 THEN total_cost ELSE 0 END), 0) AS weekly_cost,
      COALESCE(SUM(CASE WHEN created_at >= $3 THEN total_cost ELSE 0 END), 0) AS monthly_cost
    FROM usage_logs
  `, [dayStart.toISOString(), weekStart.toISOString(), monthStart.toISOString()]);

  const r = rows[0];
  const dailyCost = Number(r.daily_cost);
  const weeklyCost = Number(r.weekly_cost);
  const monthlyCost = Number(r.monthly_cost);

  return [
    {
      type: 'daily',
      limit: config.daily_limit,
      current: dailyCost,
      percentage: config.daily_limit > 0 ? Math.round(dailyCost / config.daily_limit * 1000) / 10 : 0,
      triggered: dailyCost >= config.daily_limit,
    },
    {
      type: 'weekly',
      limit: config.weekly_limit,
      current: weeklyCost,
      percentage: config.weekly_limit > 0 ? Math.round(weeklyCost / config.weekly_limit * 1000) / 10 : 0,
      triggered: weeklyCost >= config.weekly_limit,
    },
    {
      type: 'monthly',
      limit: config.monthly_limit,
      current: monthlyCost,
      percentage: config.monthly_limit > 0 ? Math.round(monthlyCost / config.monthly_limit * 1000) / 10 : 0,
      triggered: monthlyCost >= config.monthly_limit,
    },
  ];
}
