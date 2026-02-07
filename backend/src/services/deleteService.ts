import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  watchedMovies,
  watchedEpisodes,
  watchedSeries,
  WatchedMovieRecord,
  WatchedEpisodeRecord,
} from '@/db/schema';
import { MediaStatus } from '@shared/types/enums';
import { DeleteResult, DeletePreviewItem, DeleteMethod } from '@shared/types/media';
import { JellyfinClient } from '@/integrations/jellyfin';
import { RadarrClient } from '@/integrations/radarr';
import { SonarrClient } from '@/integrations/sonarr';
import { getActiveMediaServer, getActiveRadarr, getActiveSonarr } from '@/services/settingsService';
import { logger } from '@/services/logger';

export async function deleteSelectedItems(
  movieIds: number[],
  episodeIds: number[]
): Promise<DeleteResult> {
  const result: DeleteResult = {
    success: true,
    deletedMovies: 0,
    deletedEpisodes: 0,
    failures: [],
  };

  logger.info(`Starting deletion: ${movieIds.length} movies, ${episodeIds.length} episodes`, {
    source: 'delete',
  });

  // Get active services
  const mediaServer = await getActiveMediaServer();
  const radarrConfig = await getActiveRadarr();
  const sonarrConfig = await getActiveSonarr();

  if (!mediaServer || mediaServer.type !== 'jellyfin') {
    result.success = false;

    result.failures.push({
      id: 0,
      type: 'movie',
      error: 'No active Jellyfin server configured',
    });

    return result;
  }

  const jellyfinClient = new JellyfinClient({
    url: mediaServer.url,
    apiKey: mediaServer.apiKey,
  });

  // Create arr clients if configured
  const radarrClient = radarrConfig
    ? new RadarrClient({ url: radarrConfig.url, apiKey: radarrConfig.apiKey })
    : null;

  const sonarrClient = sonarrConfig
    ? new SonarrClient({ url: sonarrConfig.url, apiKey: sonarrConfig.apiKey })
    : null;

  // Process Movies
  if (movieIds.length) {
    const movies = db.select().from(watchedMovies).where(inArray(watchedMovies.id, movieIds)).all();

    // Categorize by delete method using pre-resolved radarrId
    const radarrMovies: { dbMovie: WatchedMovieRecord; radarrId: number }[] = [];
    const jellyfinMovies: WatchedMovieRecord[] = [];

    for (const movie of movies) {
      // Mark as pending
      db.update(watchedMovies)
        .set({ status: MediaStatus.PENDING_DELETE })
        .where(eq(watchedMovies.id, movie.id))
        .run();

      // Use pre-resolved radarrId if available
      if (radarrClient && movie.radarrId) {
        radarrMovies.push({ dbMovie: movie, radarrId: movie.radarrId });
      } else {
        if (radarrClient && !movie.radarrId) {
          logger.debug(
            `Movie "${movie.title}" has no Radarr ID, falling back to Jellyfin deletion`,
            { source: 'delete' }
          );
        }
        jellyfinMovies.push(movie);
      }
    }

    // Delete via Radarr
    if (radarrMovies.length && radarrClient) {
      try {
        const radarrIds = radarrMovies.map((m) => m.radarrId);

        await radarrClient.deleteMovies(radarrIds);

        for (const { dbMovie } of radarrMovies) {
          db.update(watchedMovies)
            .set({
              status: MediaStatus.DELETED,
              deleteMethod: 'radarr-api',
              deletedAt: new Date().toISOString(),
            })
            .where(eq(watchedMovies.id, dbMovie.id))
            .run();

          result.deletedMovies++;
        }
      } catch (error) {
        const message = (error as Error).message;

        logger.error(`Radarr deletion failed: ${message}`, { source: 'delete' });

        for (const { dbMovie } of radarrMovies) {
          db.update(watchedMovies)
            .set({ status: MediaStatus.FAILED })
            .where(eq(watchedMovies.id, dbMovie.id))
            .run();

          result.failures.push({
            id: dbMovie.id,
            type: 'movie',
            error: message,
          });
        }
      }
    }

    // Delete via Jellyfin
    if (jellyfinMovies.length) {
      try {
        const jellyfinIds = jellyfinMovies.map((m) => m.jellyfinId);

        await jellyfinClient.deleteItems(jellyfinIds);

        for (const movie of jellyfinMovies) {
          db.update(watchedMovies)
            .set({
              status: MediaStatus.DELETED,
              deleteMethod: 'jellyfin-api',
              deletedAt: new Date().toISOString(),
            })
            .where(eq(watchedMovies.id, movie.id))
            .run();

          result.deletedMovies++;
        }
      } catch (error) {
        const message = (error as Error).message;

        logger.error(`Jellyfin movie deletion failed: ${message}`, { source: 'delete' });

        for (const movie of jellyfinMovies) {
          db.update(watchedMovies)
            .set({ status: MediaStatus.FAILED })
            .where(eq(watchedMovies.id, movie.id))
            .run();

          result.failures.push({
            id: movie.id,
            type: 'movie',
            error: message,
          });
        }
      }
    }
  }

  // Process Episodes
  if (episodeIds.length) {
    const episodes = db
      .select()
      .from(watchedEpisodes)
      .where(inArray(watchedEpisodes.id, episodeIds))
      .all();

    interface SonarrEpisodeMatch {
      dbEpisode: WatchedEpisodeRecord;
      sonarrEpisode: { id: number; episodeFileId?: number };
    }

    const sonarrEpisodes: SonarrEpisodeMatch[] = [];
    const jellyfinEpisodes: WatchedEpisodeRecord[] = [];

    // Categorize episodes using pre-resolved Sonarr IDs
    for (const episode of episodes) {
      if (sonarrClient && episode.sonarrEpisodeId) {
        sonarrEpisodes.push({
          dbEpisode: episode,
          sonarrEpisode: {
            id: episode.sonarrEpisodeId,
            episodeFileId: episode.sonarrEpisodeFileId ?? undefined,
          },
        });
      } else {
        if (sonarrClient && !episode.sonarrEpisodeId) {
          logger.debug(
            `Episode "${episode.title}" has no Sonarr ID, falling back to Jellyfin deletion`,
            { source: 'delete' }
          );
        }
        jellyfinEpisodes.push(episode);
      }
    }

    // Delete via Sonarr
    if (sonarrEpisodes.length && sonarrClient) {
      try {
        // Build full episode objects for the delete method
        const episodesToDelete = sonarrEpisodes.map((e) => ({
          id: e.sonarrEpisode.id,
          episodeFileId: e.sonarrEpisode.episodeFileId,
          seriesId: 0, // Not needed for deletion
          seasonNumber: 0,
          episodeNumber: 0,
          title: '',
          hasFile: true,
          monitored: true,
        }));

        await sonarrClient.deleteEpisodes(episodesToDelete);

        for (const { dbEpisode } of sonarrEpisodes) {
          db.delete(watchedEpisodes).where(eq(watchedEpisodes.id, dbEpisode.id)).run();

          result.deletedEpisodes++;

          // Update series watched count or delete series if empty
          if (dbEpisode.seriesId) {
            await updateSeriesAfterEpisodeDelete(dbEpisode.seriesId);
          }
        }

        logger.info(`Deleted ${sonarrEpisodes.length} episodes via Sonarr`, { source: 'delete' });
      } catch (error) {
        const message = (error as Error).message;

        logger.error(`Sonarr episode deletion failed: ${message}`, { source: 'delete' });

        // Add all to failures
        for (const { dbEpisode } of sonarrEpisodes) {
          result.failures.push({
            id: dbEpisode.id,
            type: 'episode',
            error: message,
          });
        }
      }
    }

    // Delete via Jellyfin (fallback)
    if (jellyfinEpisodes.length) {
      try {
        const jellyfinIds = jellyfinEpisodes.map((e) => e.jellyfinId);

        await jellyfinClient.deleteItems(jellyfinIds);

        for (const episode of jellyfinEpisodes) {
          db.delete(watchedEpisodes).where(eq(watchedEpisodes.id, episode.id)).run();

          result.deletedEpisodes++;

          // Update series watched count or delete series if empty
          if (episode.seriesId) {
            await updateSeriesAfterEpisodeDelete(episode.seriesId);
          }
        }
      } catch (error) {
        const message = (error as Error).message;

        logger.error(`Jellyfin episode deletion failed: ${message}`, { source: 'delete' });

        for (const episode of jellyfinEpisodes) {
          result.failures.push({
            id: episode.id,
            type: 'episode',
            error: message,
          });
        }
      }
    }
  }

  result.success = !result.failures.length;

  logger.info(
    `Deletion complete: ${result.deletedMovies} movies, ${result.deletedEpisodes} episodes, ${result.failures.length} failures`,
    { source: 'delete' }
  );

  return result;
}

/**
 * Update series after an episode is deleted - updates count or deletes series if empty
 */
async function updateSeriesAfterEpisodeDelete(seriesId: number): Promise<void> {
  const remainingEpisodes = db
    .select()
    .from(watchedEpisodes)
    .where(eq(watchedEpisodes.seriesId, seriesId))
    .all();

  if (!remainingEpisodes.length) {
    // Delete series when all episodes are deleted
    db.delete(watchedSeries).where(eq(watchedSeries.id, seriesId)).run();

    logger.info(`Deleted empty series ${seriesId}`, { source: 'delete' });
  } else {
    db.update(watchedSeries)
      .set({ watchedEpisodes: remainingEpisodes.length })
      .where(eq(watchedSeries.id, seriesId))
      .run();
  }
}

/**
 * Get a preview of what will be deleted and from which service
 */
export async function getDeletePreview(
  movieIds: number[],
  episodeIds: number[]
): Promise<DeletePreviewItem[]> {
  const items: DeletePreviewItem[] = [];

  // Get service configs for building URLs
  const mediaServer = await getActiveMediaServer();
  const radarrConfig = await getActiveRadarr();
  const sonarrConfig = await getActiveSonarr();

  // Process movies
  if (movieIds.length) {
    const movies = db.select().from(watchedMovies).where(inArray(watchedMovies.id, movieIds)).all();

    for (const movie of movies) {
      let deleteMethod: DeleteMethod;
      let externalUrl: string | null = null;

      if (movie.radarrId && radarrConfig && movie.tmdbId) {
        deleteMethod = 'radarr';
        // Radarr uses tmdbId in its web UI URLs, not the internal radarrId
        externalUrl = `${radarrConfig.url.replace(/\/$/, '')}/movie/${movie.tmdbId}`;
      } else {
        deleteMethod = 'jellyfin';
        if (mediaServer) {
          externalUrl = `${mediaServer.url.replace(/\/$/, '')}/web/index.html#!/details?id=${movie.jellyfinId}`;
        }
      }

      items.push({
        id: movie.id,
        type: 'movie',
        title: movie.title,
        deleteMethod,
        externalUrl,
      });
    }
  }

  // Process episodes
  if (episodeIds.length) {
    const episodes = db
      .select()
      .from(watchedEpisodes)
      .where(inArray(watchedEpisodes.id, episodeIds))
      .all();

    for (const episode of episodes) {
      let deleteMethod: DeleteMethod;
      let externalUrl: string | null = null;

      // Get series info
      const series = episode.seriesId
        ? db.select().from(watchedSeries).where(eq(watchedSeries.id, episode.seriesId)).get()
        : null;

      const seriesTitle = series?.title;

      if (
        episode.sonarrEpisodeId &&
        sonarrConfig &&
        series?.sonarrSeriesId &&
        series?.sonarrTitleSlug
      ) {
        deleteMethod = 'sonarr';
        externalUrl = `${sonarrConfig.url.replace(/\/$/, '')}/series/${series.sonarrTitleSlug}`;
      } else {
        deleteMethod = 'jellyfin';
        if (mediaServer) {
          externalUrl = `${mediaServer.url.replace(/\/$/, '')}/web/index.html#!/details?id=${episode.jellyfinId}`;
        }
      }

      const seasonEpisode = `S${String(episode.seasonNumber ?? 0).padStart(2, '0')}E${String(episode.episodeNumber ?? 0).padStart(2, '0')}`;

      items.push({
        id: episode.id,
        type: 'episode',
        title: episode.title || seasonEpisode,
        deleteMethod,
        externalUrl,
        seriesTitle,
        seasonEpisode,
      });
    }
  }

  return items;
}
