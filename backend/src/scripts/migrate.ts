/**
 * Production migration script.
 *
 * Uses the drizzle-orm migrate() function (NOT drizzle-kit)
 * to apply SQL migration files at container startup.
 *
 * This is the Drizzle-recommended way to run migrations in production:
 * https://orm.drizzle.team/docs/migrations
 */
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Production paths (matching docker volume mount)

const DB_DIR = process.env.DB_DIR || '/app/data';

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || '/app/backend/drizzle';

const DB_PATH = path.join(DB_DIR, 'app.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('Running database migrations...');
console.log(`- Database: ${DB_PATH}`);
console.log(`- Migrations: ${MIGRATIONS_DIR}`);

// Create connection and run migrations

const sqlite = new Database(DB_PATH);

const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  console.log('Migrations applied successfully!');
} catch (error) {
  console.error('Migration failed:', error);

  process.exit(1);
} finally {
  sqlite.close();
}
