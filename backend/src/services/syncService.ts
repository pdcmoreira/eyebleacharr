import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  jellyfinUsers,
  watchedMovies,
  watchedSeries,
  watchedEpisodes,
  movieWatchers,
  episodeWatchers,
  NewJellyfinUserRecord,
  NewWatchedMovieRecord,
  NewWatchedSeriesRecord,
  NewWatchedEpisodeRecord,
} from '@/db/schema';
import { SyncStatus } from '@shared/types/media';
import { JellyfinClient } from '@/integrations/jellyfin';
import { RadarrClient } from '@/integrations/radarr';
import { SonarrClient } from '@/integrations/sonarr';
import { TmdbClient } from '@/integrations/tmdb';
import { WatchedItem } from '@/integrations/mediaServerProvider';
import {
  getActiveMediaServer,
  getActiveRadarr,
  getActiveSonarr,
  getTmdbApiKey,
} from '@/services/settingsService';
import { findSonarrSeries, findSonarrEpisode } from '@/services/sonarrService';
import { logger } from '@/services/logger';
import { getSyncIntervalMs } from '@/config';

// Sync state

let syncInterval: ReturnType<typeof setInterval> | null = null;

let lastSyncAt: string | null = null;

let isSyncing = false;

let lastSyncError: string | null = null;

// Sync status

export function getSyncStatus(): SyncStatus {
  return {
    lastSyncAt: lastSyncAt ?? undefined,
    isRunning: isSyncing,
    error: lastSyncError ?? undefined,
    intervalMinutes: getSyncIntervalMs() / 60000,
  };
}

// Sync logic

export async function syncWatchedContent(): Promise<void> {
  if (isSyncing) {
    logger.warn('Sync already in progress, skipping', { source: 'sync' });

    return;
  }

  isSyncing = true;

  lastSyncError = null;

  try {
    const mediaServer = await getActiveMediaServer();

    if (!mediaServer) {
      logger.warn('No active media server configured', { source: 'sync' });

      return;
    }

    logger.info('Starting watched content sync', { source: 'sync' });

    // Currently only Jellyfin is supported
    if (mediaServer.type !== 'jellyfin') {
      throw new Error(`Unsupported media server type: ${mediaServer.type}`);
    }

    const client = new JellyfinClient({
      url: mediaServer.url,
      apiKey: mediaServer.apiKey,
    });

    // Get all users
    const users = await client.getUsers();

    logger.info(`Found ${users.length} users`, { source: 'sync' });

    // Sync users to database
    for (const user of users) {
      await upsertUser({
        id: user.id,
        mediaServerId: mediaServer.id,
        name: user.name,
        lastSyncedAt: new Date().toISOString(),
      });
    }

    // Collect all watched items from all users
    const moviesByJellyfinId = new Map<string, WatchedItem & { watchedByUserIds: string[] }>();

    const episodesByJellyfinId = new Map<string, WatchedItem & { watchedByUserIds: string[] }>();

    const seriesMap = new Map<
      string,
      {
        id: string;
        name: string;
        year?: number;
        tmdbId?: number;
        tvdbId?: number;
        imdbId?: string;
        posterUrl?: string;
      }
    >();

    for (const user of users) {
      const watchedItems = await client.getWatchedItems(user.id);

      for (const item of watchedItems) {
        if (item.type === 'movie') {
          const existing = moviesByJellyfinId.get(item.id);

          if (existing) {
            existing.watchedByUserIds.push(user.id);
          } else {
            moviesByJellyfinId.set(item.id, {
              ...item,
              watchedByUserIds: [user.id],
            });
          }
        } else if (item.type === 'episode') {
          const existing = episodesByJellyfinId.get(item.id);

          if (existing) {
            existing.watchedByUserIds.push(user.id);
          } else {
            episodesByJellyfinId.set(item.id, {
              ...item,
              watchedByUserIds: [user.id],
            });
          }

          // Track series for grouping
          if (item.seriesId && item.seriesName) {
            if (!seriesMap.has(item.seriesId)) {
              // Fetch series info for TMDB ID
              const seriesInfo = await client.getSeries(item.seriesId, user.id);

              // Build poster URL - Jellyfin serves poster images via standard URL pattern
              const posterUrl = `${mediaServer.url.replace(/\/$/, '')}/Items/${item.seriesId}/Images/Primary`;

              seriesMap.set(item.seriesId, {
                id: item.seriesId,
                name: item.seriesName,
                year: item.year,
                tmdbId: seriesInfo?.ProviderIds?.Tmdb
                  ? parseInt(seriesInfo.ProviderIds.Tmdb, 10)
                  : undefined,
                tvdbId: seriesInfo?.ProviderIds?.Tvdb
                  ? parseInt(seriesInfo.ProviderIds.Tvdb, 10)
                  : undefined,
                imdbId: seriesInfo?.ProviderIds?.Imdb,
                posterUrl,
              });
            }
          }
        }
      }
    }

    // Upsert movies
    for (const movie of moviesByJellyfinId.values()) {
      await upsertMovie(mediaServer.id, movie);
    }

    logger.info(`Synced ${moviesByJellyfinId.size} movies`, { source: 'sync' });

    // Upsert series and episodes
    for (const [seriesId, seriesInfo] of seriesMap) {
      const seriesEpisodes = Array.from(episodesByJellyfinId.values()).filter(
        (ep) => ep.seriesId === seriesId
      );

      await upsertSeriesWithEpisodes(mediaServer.id, seriesInfo, seriesEpisodes);
    }

    logger.info(`Synced ${seriesMap.size} series with ${episodesByJellyfinId.size} episodes`, {
      source: 'sync',
    });

    // Resolve Radarr/Sonarr IDs for deletion
    await resolveArrIds();

    // Cleanup: delete any series that have no remaining episodes

    const allSeries = db.select().from(watchedSeries).all();

    for (const series of allSeries) {
      const episodeCount = db
        .select()
        .from(watchedEpisodes)
        .where(eq(watchedEpisodes.seriesId, series.id))
        .all().length;

      if (!episodeCount) {
        db.delete(watchedSeries).where(eq(watchedSeries.id, series.id)).run();

        logger.info(`Deleted empty series "${series.title}" (id: ${series.id})`, {
          source: 'sync',
        });
      }
    }

    lastSyncAt = new Date().toISOString();

    logger.info('Sync completed successfully', { source: 'sync' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    lastSyncError = message;

    logger.error(`Sync failed: ${message}`, { source: 'sync' });

    throw error;
  } finally {
    isSyncing = false;
  }
}

// Database upsert helpers

async function upsertUser(user: NewJellyfinUserRecord): Promise<void> {
  const existing = db.select().from(jellyfinUsers).where(eq(jellyfinUsers.id, user.id)).get();

  if (existing) {
    db.update(jellyfinUsers)
      .set({ name: user.name, lastSyncedAt: user.lastSyncedAt })
      .where(eq(jellyfinUsers.id, user.id))
      .run();
  } else {
    db.insert(jellyfinUsers).values(user).run();
  }
}

async function upsertMovie(
  mediaServerId: number,
  item: WatchedItem & { watchedByUserIds: string[] }
): Promise<void> {
  const existing = db
    .select()
    .from(watchedMovies)
    .where(eq(watchedMovies.jellyfinId, item.id))
    .get();

  const data: NewWatchedMovieRecord = {
    jellyfinId: item.id,
    mediaServerId,
    title: item.title,
    year: item.year,
    tmdbId: item.tmdbId ? parseInt(item.tmdbId, 10) : undefined,
    imdbId: item.imdbId,
    posterUrl: item.posterUrl,
    filePath: item.filePath,
    sizeBytes: item.sizeBytes,
    lastWatchedAt: item.lastPlayedDate,
  };

  let movieId: number;

  if (existing) {
    // Don't overwrite status/deleteMethod if already set
    db.update(watchedMovies)
      .set({
        title: data.title,
        year: data.year,
        tmdbId: data.tmdbId,
        imdbId: data.imdbId,
        posterUrl: data.posterUrl,
        filePath: data.filePath,
        sizeBytes: data.sizeBytes,
        lastWatchedAt: data.lastWatchedAt,
      })
      .where(eq(watchedMovies.jellyfinId, item.id))
      .run();

    movieId = existing.id;
  } else {
    const result = db.insert(watchedMovies).values(data).run();

    movieId = Number(result.lastInsertRowid);
  }

  // Sync watchers - delete existing and re-add
  db.delete(movieWatchers).where(eq(movieWatchers.movieId, movieId)).run();

  for (const userId of item.watchedByUserIds) {
    db.insert(movieWatchers)
      .values({
        movieId,
        userId,
        watchedAt: item.lastPlayedDate,
      })
      .run();
  }
}

async function upsertSeriesWithEpisodes(
  mediaServerId: number,
  seriesInfo: {
    id: string;
    name: string;
    year?: number;
    tmdbId?: number;
    tvdbId?: number;
    imdbId?: string;
    posterUrl?: string;
  },
  episodes: Array<WatchedItem & { watchedByUserIds: string[] }>
): Promise<void> {
  // Upsert series
  let existingSeries = db
    .select()
    .from(watchedSeries)
    .where(eq(watchedSeries.jellyfinId, seriesInfo.id))
    .get();

  const seriesData: NewWatchedSeriesRecord = {
    jellyfinId: seriesInfo.id,
    mediaServerId,
    title: seriesInfo.name,
    year: seriesInfo.year,
    tmdbId: seriesInfo.tmdbId,
    tvdbId: seriesInfo.tvdbId,
    imdbId: seriesInfo.imdbId,
    posterUrl: seriesInfo.posterUrl,
    totalEpisodes: episodes.length,
    watchedEpisodes: episodes.length,
  };

  if (existingSeries) {
    db.update(watchedSeries)
      .set({
        title: seriesData.title,
        year: seriesData.year,
        tmdbId: seriesData.tmdbId,
        tvdbId: seriesData.tvdbId,
        imdbId: seriesData.imdbId,
        posterUrl: seriesData.posterUrl,
        totalEpisodes: seriesData.totalEpisodes,
        watchedEpisodes: seriesData.watchedEpisodes,
      })
      .where(eq(watchedSeries.jellyfinId, seriesInfo.id))
      .run();
  } else {
    db.insert(watchedSeries).values(seriesData).run();

    existingSeries = db
      .select()
      .from(watchedSeries)
      .where(eq(watchedSeries.jellyfinId, seriesInfo.id))
      .get();
  }

  if (!existingSeries) {
    return;
  }

  // Upsert episodes
  for (const episode of episodes) {
    const existingEpisode = db
      .select()
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.jellyfinId, episode.id))
      .get();

    const episodeData: NewWatchedEpisodeRecord = {
      jellyfinId: episode.id,
      seriesId: existingSeries.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      filePath: episode.filePath,
      sizeBytes: episode.sizeBytes,
      lastWatchedAt: episode.lastPlayedDate,
    };

    let episodeId: number;

    if (existingEpisode) {
      db.update(watchedEpisodes)
        .set({
          seasonNumber: episodeData.seasonNumber,
          episodeNumber: episodeData.episodeNumber,
          title: episodeData.title,
          filePath: episodeData.filePath,
          sizeBytes: episodeData.sizeBytes,
          lastWatchedAt: episodeData.lastWatchedAt,
        })
        .where(eq(watchedEpisodes.jellyfinId, episode.id))
        .run();

      episodeId = existingEpisode.id;
    } else {
      const result = db.insert(watchedEpisodes).values(episodeData).run();

      episodeId = Number(result.lastInsertRowid);
    }

    // Sync watchers - delete existing and re-add
    db.delete(episodeWatchers).where(eq(episodeWatchers.episodeId, episodeId)).run();

    for (const userId of episode.watchedByUserIds) {
      db.insert(episodeWatchers)
        .values({
          episodeId,
          userId,
          watchedAt: episode.lastPlayedDate,
        })
        .run();
    }
  }
}

// Resolve Radarr/Sonarr IDs for all watched items
// This enables faster deletion by pre-caching external IDs

async function resolveArrIds(): Promise<void> {
  // Get service configurations
  const radarrConfig = await getActiveRadarr();
  const sonarrConfig = await getActiveSonarr();
  const tmdbApiKey = await getTmdbApiKey();

  // Skip if no arr services configured
  if (!radarrConfig && !sonarrConfig) {
    logger.debug('No Radarr/Sonarr configured, skipping arr ID resolution', { source: 'sync' });
    return;
  }

  // Create clients
  const radarrClient = radarrConfig
    ? new RadarrClient({ url: radarrConfig.url, apiKey: radarrConfig.apiKey })
    : null;

  const sonarrClient = sonarrConfig
    ? new SonarrClient({ url: sonarrConfig.url, apiKey: sonarrConfig.apiKey })
    : null;

  const tmdbClient = tmdbApiKey ? new TmdbClient({ apiKey: tmdbApiKey }) : null;

  // Resolve Radarr IDs for movies
  if (radarrClient) {
    const movies = db.select().from(watchedMovies).all();
    let resolved = 0;

    for (const movie of movies) {
      // Skip if already resolved or no TMDB ID
      if (movie.radarrId || !movie.tmdbId) {
        continue;
      }

      try {
        const radarrMovie = await radarrClient.findMovieByTmdbId(movie.tmdbId);

        if (radarrMovie) {
          db.update(watchedMovies)
            .set({ radarrId: radarrMovie.id })
            .where(eq(watchedMovies.id, movie.id))
            .run();

          resolved++;
        }
      } catch (error) {
        logger.debug(`Failed to find movie "${movie.title}" in Radarr: ${(error as Error).message}`, {
          source: 'sync',
        });
      }
    }

    logger.info(`Resolved ${resolved} Radarr IDs for movies`, { source: 'sync' });
  }

  // Resolve Sonarr IDs for series and episodes
  if (sonarrClient) {
    const allSeries = db.select().from(watchedSeries).all();
    let seriesResolved = 0;
    let episodesResolved = 0;

    for (const series of allSeries) {
      // Try to find series in Sonarr if not already resolved
      let sonarrSeriesId = series.sonarrSeriesId;

      if (!sonarrSeriesId) {
        const match = await findSonarrSeries(series, sonarrClient, tmdbClient);

        if (match.sonarrSeriesId) {
          sonarrSeriesId = match.sonarrSeriesId;

          db.update(watchedSeries)
            .set({ sonarrSeriesId, sonarrTitleSlug: match.sonarrTitleSlug })
            .where(eq(watchedSeries.id, series.id))
            .run();

          seriesResolved++;
        } else {
          // Series not found in Sonarr, skip episode resolution
          continue;
        }
      }

      // Resolve episode IDs for this series
      const episodes = db
        .select()
        .from(watchedEpisodes)
        .where(eq(watchedEpisodes.seriesId, series.id))
        .all();

      for (const episode of episodes) {
        // Skip if already resolved or missing season/episode numbers
        if (episode.sonarrEpisodeId || episode.seasonNumber == null || episode.episodeNumber == null) {
          continue;
        }

        const episodeMatch = await findSonarrEpisode(
          sonarrClient,
          sonarrSeriesId,
          episode.seasonNumber,
          episode.episodeNumber
        );

        if (episodeMatch.sonarrEpisodeId) {
          db.update(watchedEpisodes)
            .set({
              sonarrEpisodeId: episodeMatch.sonarrEpisodeId,
              sonarrEpisodeFileId: episodeMatch.sonarrEpisodeFileId,
            })
            .where(eq(watchedEpisodes.id, episode.id))
            .run();

          episodesResolved++;
        }
      }
    }

    logger.info(`Resolved ${seriesResolved} Sonarr series IDs and ${episodesResolved} episode IDs`, {
      source: 'sync',
    });
  }
}

// Sync scheduler

export function startSyncScheduler(): void {
  if (syncInterval) {
    logger.warn('Sync scheduler already running', { source: 'sync' });

    return;
  }

  logger.info(`Starting sync scheduler (interval: ${getSyncIntervalMs() / 60000} minutes)`, {
    source: 'sync',
  });

  // Run initial sync after a short delay
  setTimeout(() => {
    syncWatchedContent().catch((err) => {
      logger.error(`Initial sync failed: ${err.message}`, { source: 'sync' });
    });
  }, 5000);

  // Schedule periodic syncs
  syncInterval = setInterval(() => {
    syncWatchedContent().catch((err) => {
      logger.error(`Scheduled sync failed: ${err.message}`, { source: 'sync' });
    });
  }, getSyncIntervalMs());
}

export function stopSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);

    syncInterval = null;

    logger.info('Sync scheduler stopped', { source: 'sync' });
  }
}
