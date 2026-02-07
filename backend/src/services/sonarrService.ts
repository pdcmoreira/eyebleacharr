/**
 * Sonarr Service
 *
 * Provides functions for matching series and episodes with Sonarr.
 * Used during sync to pre-resolve Sonarr IDs for faster deletion.
 */

import { SonarrClient } from '@/integrations/sonarr';
import { TmdbClient } from '@/integrations/tmdb';
import { logger } from '@/services/logger';

export interface SeriesMatchInput {
  title: string;
  tmdbId?: number | null;
  tvdbId?: number | null;
  imdbId?: string | null;
  year?: number | null;
}

export interface SonarrSeriesMatch {
  sonarrSeriesId: number | null;
  sonarrTitleSlug: string | null;
  matchMethod: string;
}

export interface SonarrEpisodeMatch {
  sonarrEpisodeId: number | null;
  sonarrEpisodeFileId: number | null;
}

/**
 * Try to find a Sonarr series using various matching strategies
 * Returns the Sonarr series ID if found, null otherwise
 */
export async function findSonarrSeries(
  series: SeriesMatchInput,
  sonarrClient: SonarrClient,
  tmdbClient: TmdbClient | null
): Promise<SonarrSeriesMatch> {
  const attemptedStrategies: string[] = [];

  // Strategy 1: Match by stored TMDB ID
  if (series.tmdbId) {
    try {
      const sonarrSeries = await sonarrClient.findSeriesByTmdbId(series.tmdbId);

      if (sonarrSeries) {
        logger.debug(`Series "${series.title}" matched via TMDB ID ${series.tmdbId}`, {
          source: 'sonarr',
        });

        return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'tmdb' };
      }

      attemptedStrategies.push(`TMDB:${series.tmdbId}`);
    } catch (error) {
      logger.warn(
        `TMDB ID lookup failed for series "${series.title}": ${(error as Error).message}`,
        { source: 'sonarr' }
      );
    }
  }

  // Strategy 2: Match by stored TVDB ID (Sonarr's native identifier)
  if (series.tvdbId) {
    try {
      const sonarrSeries = await sonarrClient.findSeriesByTvdbId(series.tvdbId);

      if (sonarrSeries) {
        logger.debug(`Series "${series.title}" matched via stored TVDB ID ${series.tvdbId}`, {
          source: 'sonarr',
        });

        return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'tvdb' };
      }

      attemptedStrategies.push(`TVDB:${series.tvdbId}`);
    } catch (error) {
      logger.warn(
        `Stored TVDB lookup failed for series "${series.title}": ${(error as Error).message}`,
        { source: 'sonarr' }
      );
    }
  }

  // Strategy 3: Match by stored IMDB ID
  if (series.imdbId) {
    try {
      const sonarrSeries = await sonarrClient.findSeriesByImdbId(series.imdbId);

      if (sonarrSeries) {
        logger.debug(`Series "${series.title}" matched via stored IMDB ID ${series.imdbId}`, {
          source: 'sonarr',
        });

        return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'imdb' };
      }

      attemptedStrategies.push(`IMDB:${series.imdbId}`);
    } catch (error) {
      logger.warn(`IMDB lookup failed for series "${series.title}": ${(error as Error).message}`, {
        source: 'sonarr',
      });
    }
  }

  // Strategy 4: Use TMDB API to fetch external IDs (fallback when stored IDs don't work)
  // Only try if we have tmdbId but are missing tvdbId (API can provide it)
  if (tmdbClient && series.tmdbId && !series.tvdbId) {
    try {
      const externalIds = await tmdbClient.getTvExternalIds(series.tmdbId);

      if (externalIds.tvdbId) {
        const sonarrSeries = await sonarrClient.findSeriesByTvdbId(externalIds.tvdbId);

        if (sonarrSeries) {
          logger.debug(
            `Series "${series.title}" matched via TMDB→TVDB lookup (TVDB: ${externalIds.tvdbId})`,
            { source: 'sonarr' }
          );

          return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'tmdb-api-tvdb' };
        }

        attemptedStrategies.push(`TMDB-API-TVDB:${externalIds.tvdbId}`);
      }

      // Try with IMDB ID from TMDB response (only if we don't have stored IMDB or it's different)
      if (externalIds.imdbId && externalIds.imdbId !== series.imdbId) {
        const sonarrSeries = await sonarrClient.findSeriesByImdbId(externalIds.imdbId);

        if (sonarrSeries) {
          logger.debug(`Series "${series.title}" matched via TMDB→IMDB lookup`, {
            source: 'sonarr',
          });

          return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'tmdb-api-imdb' };
        }

        attemptedStrategies.push(`TMDB-API-IMDB:${externalIds.imdbId}`);
      }
    } catch (error) {
      logger.warn(
        `TMDB API lookup failed for series "${series.title}": ${(error as Error).message}`,
        { source: 'sonarr' }
      );
    }
  }

  // Strategy 5: Title + year matching (last resort)
  if (series.year) {
    try {
      const sonarrSeries = await sonarrClient.findSeriesByTitle(series.title, series.year);

      if (sonarrSeries) {
        logger.debug(
          `Series "${series.title}" matched via title+year (Sonarr ID: ${sonarrSeries.id})`,
          { source: 'sonarr' }
        );

        return { sonarrSeriesId: sonarrSeries.id, sonarrTitleSlug: sonarrSeries.titleSlug, matchMethod: 'title-year' };
      }

      attemptedStrategies.push(`Title:"${series.title}",Year:${series.year}`);
    } catch (error) {
      logger.warn(`Title lookup failed for series "${series.title}": ${(error as Error).message}`, {
        source: 'sonarr',
      });
    }
  }

  // Log all attempted strategies for debugging
  logger.debug(
    `Series "${series.title}" not found in Sonarr. Attempted strategies: ${attemptedStrategies.join(', ')}`,
    { source: 'sonarr' }
  );

  return { sonarrSeriesId: null, sonarrTitleSlug: null, matchMethod: 'none' };
}

/**
 * Find an episode in Sonarr by season and episode number
 */
export async function findSonarrEpisode(
  sonarrClient: SonarrClient,
  sonarrSeriesId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<SonarrEpisodeMatch> {
  try {
    const episode = await sonarrClient.findEpisode(sonarrSeriesId, seasonNumber, episodeNumber);

    if (episode) {
      return {
        sonarrEpisodeId: episode.id,
        sonarrEpisodeFileId: episode.episodeFileId ?? null,
      };
    }
  } catch (error) {
    logger.warn(
      `Failed to find episode S${seasonNumber}E${episodeNumber} in Sonarr: ${(error as Error).message}`,
      { source: 'sonarr' }
    );
  }

  return { sonarrEpisodeId: null, sonarrEpisodeFileId: null };
}
