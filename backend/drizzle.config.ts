import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'drizzle-kit';

// In dev, cwd is 'backend/', so data is at '../data' (project root)
const isProduction = process.env.NODE_ENV === 'production';
const DB_DIR =
  process.env.DB_DIR || (isProduction ? '/app/data' : path.join(process.cwd(), '..', 'data'));

// Ensure data directory exists (drizzle-kit doesn't create it)
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(DB_DIR, 'app.db'),
  },
});
