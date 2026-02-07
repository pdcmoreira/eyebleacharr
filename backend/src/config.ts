import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - call this before importing any modules that use env vars
export const loadEnv = (): void => {
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: path.join(__dirname, '../../.env') });
  }
};

export const isProduction = process.env.NODE_ENV === 'production';

// In dev, cwd is 'backend/', so data is at '../data' (project root)
export const DB_DIR: string =
  process.env.DB_DIR || (isProduction ? '/app/data' : path.join(process.cwd(), '..', 'data'));

// Migrations path - resolved at runtime after dotenv is loaded
export const getMigrationsDir = (): string =>
  process.env.MIGRATIONS_DIR || path.join(__dirname, '../drizzle');

// Sync interval in milliseconds (default: 60 minutes)
export const getSyncIntervalMs = (): number =>
  parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10) * 60 * 1000;
