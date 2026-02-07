import { Router, Request, Response } from 'express';
import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  watchedMovies,
  watchedSeries,
  watchedEpisodes,
  movieWatchers,
  episodeWatchers,
} from '@/db/schema';
import { syncWatchedContent, getSyncStatus } from '@/services/syncService';
import { deleteSelectedItems, getDeletePreview } from '@/services/deleteService';
import { getHiddenUserIds } from '@/services/settingsService';
import { respondSuccess, respondError } from '@/api/utils/response';
import { MediaStatus } from '@shared/types/enums';
import { WatchedMovie, WatchedSeries, WatchedEpisode } from '@shared/types/media';

const router: Router = Router();

// Movies

// GET /api/media/movies
router.get('/movies', async (req: Request, res: Response) => {
  try {
    const { status, userIds, sort = 'lastWatchedAt', order = 'desc' } = req.query;

    // Build conditions array
    const conditions: SQL[] = [];

    if (status && typeof status === 'string') {
      conditions.push(eq(watchedMovies.status, status as MediaStatus));
    }

    // Get all movies matching base conditions
    const movies = conditions.length
      ? db
          .select()
          .from(watchedMovies)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .all()
      : db.select().from(watchedMovies).all();

    // Get hidden user IDs to filter out
    const hiddenIds = await getHiddenUserIds();

    // Get all watchers for these movies, excluding hidden users at DB level
    const movieIds = movies.map((m) => m.id);

    const watchers = movieIds.length
      ? hiddenIds.length
        ? db
            .select()
            .from(movieWatchers)
            .where(
              and(
                inArray(movieWatchers.movieId, movieIds),
                notInArray(movieWatchers.userId, hiddenIds)
              )
            )
            .all()
        : db.select().from(movieWatchers).where(inArray(movieWatchers.movieId, movieIds)).all()
      : [];

    // Group watchers by movie
    const watchersByMovie = new Map<number, string[]>();

    for (const watcher of watchers) {
      const list = watchersByMovie.get(watcher.movieId) || [];

      list.push(watcher.userId);

      watchersByMovie.set(watcher.movieId, list);
    }

    // Filter by user if specified
    const userIdList =
      userIds && typeof userIds === 'string' ? userIds.split(',').filter(Boolean) : [];

    // Filter movies: exclude those with no visible watchers, and optionally filter by selected users
    const filteredMovies = movies.filter((movie) => {
      const movieUserIds = watchersByMovie.get(movie.id) || [];

      // Exclude movies with no visible watchers
      if (movieUserIds.length === 0) {
        return false;
      }

      // If filtering by specific users, ensure at least one matches
      if (userIdList.length) {
        return userIdList.some((uid) => movieUserIds.includes(uid));
      }

      return true;
    });

    // Sort results in JS (simpler than building dynamic orderBy)
    const sortedMovies = filteredMovies.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sort) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'year':
          aVal = a.year || 0;
          bVal = b.year || 0;
          break;
        case 'sizeBytes':
          aVal = a.sizeBytes || 0;
          bVal = b.sizeBytes || 0;
          break;
        case 'lastWatchedAt':
        default:
          aVal = a.lastWatchedAt || '';
          bVal = b.lastWatchedAt || '';
          break;
      }

      if (order === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    // Map DB records to shared WatchedMovie type
    const result: WatchedMovie[] = sortedMovies.map((movie) => ({
      id: movie.id,
      jellyfinId: movie.jellyfinId,
      title: movie.title,
      year: movie.year ?? undefined,
      posterUrl: movie.posterUrl ?? undefined,
      sizeBytes: movie.sizeBytes ?? undefined,
      lastWatchedAt: movie.lastWatchedAt ?? undefined,
      watchedByUserIds: watchersByMovie.get(movie.id) || [],
      status: (movie.status ?? MediaStatus.WATCHED) as MediaStatus,
    }));

    respondSuccess(res, result);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// Series (with nested episodes)

// GET /api/media/series
router.get('/series', async (req: Request, res: Response) => {
  try {
    const { status, userIds, sort = 'title', order = 'asc' } = req.query;

    // Get all series (with optional status filter)
    const allSeries =
      status && typeof status === 'string'
        ? db
            .select()
            .from(watchedSeries)
            .where(eq(watchedSeries.status, status as MediaStatus))
            .all()
        : db.select().from(watchedSeries).all();

    // Get all episodes
    const allEpisodes = db.select().from(watchedEpisodes).all();

    // Get hidden user IDs to filter out
    const hiddenIds = await getHiddenUserIds();

    // Get all episode watchers, excluding hidden users at DB level
    const episodeIds = allEpisodes.map((e) => e.id);

    const allWatchers = episodeIds.length
      ? hiddenIds.length
        ? db
            .select()
            .from(episodeWatchers)
            .where(
              and(
                inArray(episodeWatchers.episodeId, episodeIds),
                notInArray(episodeWatchers.userId, hiddenIds)
              )
            )
            .all()
        : db
            .select()
            .from(episodeWatchers)
            .where(inArray(episodeWatchers.episodeId, episodeIds))
            .all()
      : [];

    // Group watchers by episode
    const watchersByEpisode = new Map<number, string[]>();

    for (const wacher of allWatchers) {
      const list = watchersByEpisode.get(wacher.episodeId) || [];

      list.push(wacher.userId);

      watchersByEpisode.set(wacher.episodeId, list);
    }

    // Parse user filter
    const userIdList =
      userIds && typeof userIds === 'string' ? userIds.split(',').filter(Boolean) : [];

    // Build result with episodes and filter
    const result = allSeries
      .map((series) => {
        // Get episodes for this series
        const episodes = allEpisodes.filter((ep) => ep.seriesId === series.id);

        // Filter episodes: exclude those with no visible watchers, optionally filter by users
        const filteredEpisodes = episodes.filter((ep) => {
          const epUserIds = watchersByEpisode.get(ep.id) || [];

          // Exclude episodes with no visible watchers
          if (epUserIds.length === 0) {
            return false;
          }

          // If filtering by specific users, ensure at least one matches
          if (userIdList.length) {
            return userIdList.some((uid) => epUserIds.includes(uid));
          }

          return true;
        });

        // Map episodes to shared WatchedEpisode type
        const parsedEpisodes: WatchedEpisode[] = filteredEpisodes.map((ep) => ({
          id: ep.id,
          jellyfinId: ep.jellyfinId,
          seasonNumber: ep.seasonNumber ?? 0,
          episodeNumber: ep.episodeNumber ?? 0,
          title: ep.title ?? undefined,
          sizeBytes: ep.sizeBytes ?? undefined,
          lastWatchedAt: ep.lastWatchedAt ?? undefined,
          watchedByUserIds: watchersByEpisode.get(ep.id) || [],
        }));

        // Map series to shared WatchedSeries type
        const mappedSeries: WatchedSeries = {
          id: series.id,
          jellyfinId: series.jellyfinId,
          title: series.title,
          year: series.year ?? undefined,
          posterUrl: series.posterUrl ?? undefined,
          totalEpisodes: series.totalEpisodes ?? 0,
          watchedEpisodes: series.watchedEpisodes ?? 0,
          status: (series.status ?? MediaStatus.WATCHED) as MediaStatus,
          episodes: parsedEpisodes,
        };

        return mappedSeries;
      })
      // Exclude series with no visible episodes
      .filter((series) => series.episodes.length > 0);

    // Sort results
    const sortedResult = result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sort) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'year':
          aVal = a.year || 0;
          bVal = b.year || 0;
          break;
        case 'watchedEpisodes':
          aVal = a.episodes.length;
          bVal = b.episodes.length;
          break;
        default:
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
      }

      if (order === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    respondSuccess(res, sortedResult);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// Delete

// POST /api/media/delete/preview
router.post('/delete/preview', async (req: Request, res: Response) => {
  try {
    const { movieIds = [], episodeIds = [] } = req.body;

    if (!Array.isArray(movieIds) || !Array.isArray(episodeIds)) {
      return respondError(res, 'movieIds and episodeIds must be arrays', 400);
    }

    if (!movieIds.length && !episodeIds.length) {
      return respondError(res, 'No items specified', 400);
    }

    const preview = await getDeletePreview(movieIds, episodeIds);

    respondSuccess(res, preview);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// DELETE /api/media/delete
router.delete('/delete', async (req: Request, res: Response) => {
  try {
    const { movieIds = [], episodeIds = [] } = req.body;

    if (!Array.isArray(movieIds) || !Array.isArray(episodeIds)) {
      return respondError(res, 'movieIds and episodeIds must be arrays', 400);
    }

    if (!movieIds.length && !episodeIds.length) {
      return respondError(res, 'No items specified for deletion', 400);
    }

    const result = await deleteSelectedItems(movieIds, episodeIds);

    respondSuccess(res, result);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// Sync

// POST /api/media/sync
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    // Don't await - return immediately and let sync run in background
    syncWatchedContent().catch(() => {
      // Error is logged in syncService
    });

    respondSuccess(res, { message: 'Sync started' });
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

// GET /api/media/sync/status
router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const status = getSyncStatus();

    respondSuccess(res, status);
  } catch (error) {
    respondError(res, (error as Error).message);
  }
});

export default router;
