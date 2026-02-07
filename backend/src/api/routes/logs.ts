import { Router, Request, Response, Router as RouterType } from 'express';
import { respondSuccess, respondError } from '@/api/utils/response';
import { LogEntry } from '@shared/types/logs';
import { db, sqlite } from '@/db';
import { logs } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { logger } from '@/services/logger';

const router: RouterType = Router();

// Build a sanitized FTS prefix-search string from the user's input.
// Split on whitespace, remove unsafe chars, append '*' for prefix search.
const buildFtsPrefixSearch = (input: string): string =>
  input
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9_]/g, ''))
    .filter(Boolean)
    .map((t) => `${t}*`)
    .join(' ');

// Get logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim();

    const levels = req.query.levels
      ? Array.isArray(req.query.levels)
        ? (req.query.levels as string[])
        : [req.query.levels as string]
      : ['INFO', 'WARNING', 'ERROR'];

    const limit = parseInt(req.query.limit as string) || 500;

    // Normalize levels to lowercase for database query
    const normalizedLevels = levels.map((level) => level.toLowerCase());

    // Query logs from database
    let logEntries;

    // Regular query without FTS
    const getRegularQuery = () =>
      db
        .select()
        .from(logs)
        .where(inArray(logs.level, normalizedLevels as ('info' | 'warn' | 'error' | 'debug')[]))
        .orderBy(desc(logs.createdAt))
        .limit(limit)
        .all();

    if (search) {
      const ftsSearch = buildFtsPrefixSearch(search);

      // Use FTS for fast text search.
      // If sanitization removed all searchable tokens, fall back to regular query.
      if (ftsSearch) {
        const ftsQuery = `
          SELECT l.id, l.created_at as createdAt, l.level, l.source, l.message, l.meta
          FROM logs l
          INNER JOIN logs_fts ON logs_fts.rowid = l.id
          WHERE logs_fts MATCH ?
          AND l.level IN (${normalizedLevels.map(() => '?').join(',')})
          ORDER BY l.created_at DESC
          LIMIT ?
        `;

        logEntries = sqlite.prepare(ftsQuery).all(ftsSearch, ...normalizedLevels, limit);
      } else {
        logEntries = getRegularQuery();
      }
    } else {
      logEntries = getRegularQuery();
    }

    return respondSuccess<LogEntry[]>(res, logEntries as LogEntry[]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return respondError(res, `Error in /api/logs: ${message}`);
  }
});

// Clear logs
router.post('/clear-log', async (req: Request, res: Response) => {
  try {
    // Delete all logs from database
    db.delete(logs).run();

    logger.info('Logs cleared manually');

    return respondSuccess(res, {
      message: 'Log cleared',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return respondError(res, `Failed to clear log: ${message}`);
  }
});

export default router;
