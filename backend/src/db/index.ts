import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { DB_DIR } from '@/config';
import * as schema from '@/db/schema';

const DB_PATH = path.join(DB_DIR, 'app.db');

// Ensure database directory exists
try {
  fs.ensureDirSync(DB_DIR);
} catch (error) {
  console.error(`Failed to create database directory: ${error}`);
}

// Create SQLite connection
const sqliteConnection = new Database(DB_PATH);

// Configure SQLite for better performance and concurrency

// Write-Ahead Logging for better concurrency
sqliteConnection.pragma('journal_mode = WAL');

// Good balance for logging use case
sqliteConnection.pragma('synchronous = NORMAL');

// Wait up to 5s if database is locked
sqliteConnection.pragma('busy_timeout = 5000');

// Create Drizzle instance
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqliteConnection, { schema });

// Export raw sqlite instance (e.g. for FTS operations)
export const sqlite: Database.Database = sqliteConnection;

// Initialize FTS virtual table for log search
export function initializeFts() {
  // Create FTS virtual table for fast text search
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
      message,
      meta,
      content='logs',
      content_rowid='id'
    );
  `);

  // Create triggers to keep FTS in sync with logs table
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS logs_fts_insert AFTER INSERT ON logs BEGIN
      INSERT INTO logs_fts(rowid, message, meta)
      VALUES (new.id, new.message, COALESCE(new.meta, ''));
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS logs_fts_delete AFTER DELETE ON logs BEGIN
      DELETE FROM logs_fts WHERE rowid = old.id;
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS logs_fts_update AFTER UPDATE ON logs BEGIN
      UPDATE logs_fts 
      SET message = new.message, meta = COALESCE(new.meta, '')
      WHERE rowid = new.id;
    END;
  `);
}
