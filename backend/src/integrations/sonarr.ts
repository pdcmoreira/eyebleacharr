/**
 * Sonarr API Client
 * Handles series/episode management and deletion via Sonarr
 */

import { logger } from '@/services/logger';

interface SonarrConfig {
  url: string;
  apiKey: string;
}

interface SonarrSeries {
  id: number;
  title: string;
  titleSlug: string;
  year: number;
  tvdbId: number;
  tmdbId?: number;
  imdbId?: string;
  path?: string;
}

interface SonarrEpisode {
  id: number;
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
  episodeFileId?: number;
  monitored: boolean;
}

interface SonarrSystemStatus {
  version: string;
  appName: string;
}

export class SonarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: SonarrConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');

    this.apiKey = config.apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v3${endpoint}`;

    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Sonarr API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const text = await response.text();

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    version?: string;
  }> {
    try {
      const status = await this.request<SonarrSystemStatus>('/system/status');

      return {
        success: true,
        message: `Connected to ${status.appName}`,
        version: status.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Sonarr connection test failed: ${message}`);

      return {
        success: false,
        message: `Connection failed: ${message}`,
      };
    }
  }

  /**
   * Get all series from Sonarr
   */
  async getSeries(): Promise<SonarrSeries[]> {
    return this.request<SonarrSeries[]>('/series');
  }

  /**
   * Find a series by TMDB ID
   */
  async findSeriesByTmdbId(tmdbId: number): Promise<SonarrSeries | null> {
    const series = await this.getSeries();

    return series.find((s) => s.tmdbId === tmdbId) || null;
  }

  /**
   * Find a series by TVDB ID
   */
  async findSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null> {
    const series = await this.getSeries();

    return series.find((s) => s.tvdbId === tvdbId) || null;
  }

  /**
   * Find a series by IMDB ID
   */
  async findSeriesByImdbId(imdbId: string): Promise<SonarrSeries | null> {
    const series = await this.getSeries();

    return series.find((s) => s.imdbId === imdbId) || null;
  }

  /**
   * Normalize a title for comparison (lowercase, remove special chars, handle "The" prefix)
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/^the\s+/i, '') // Remove leading "The "
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Find a series by title and optional year.
   * If year is provided, it must match - no fallback to title-only.
   */
  async findSeriesByTitle(title: string, year?: number): Promise<SonarrSeries | null> {
    const series = await this.getSeries();

    const normalizedTitle = this.normalizeTitle(title);

    const titleMatches = series.filter((s) => this.normalizeTitle(s.title) === normalizedTitle);

    if (titleMatches.length === 0) {
      return null;
    }

    // If year is provided, only return a match with that year
    if (year) {
      return titleMatches.find((s) => s.year === year) || null;
    }

    // If no year provided, only return if there's exactly one match (unambiguous)
    if (titleMatches.length === 1) {
      return titleMatches[0];
    }

    // Multiple matches without year to disambiguate
    return null;
  }

  /**
   * Get all episodes for a series
   */
  async getEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    return this.request<SonarrEpisode[]>(`/episode?seriesId=${seriesId}`);
  }

  /**
   * Find an episode by season and episode number
   */
  async findEpisode(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<SonarrEpisode | null> {
    const episodes = await this.getEpisodes(seriesId);

    return (
      episodes.find(
        (ep) => ep.seasonNumber === seasonNumber && ep.episodeNumber === episodeNumber
      ) || null
    );
  }

  /**
   * Unmonitor episodes (prevents re-download)
   * @param episodeIds Array of Sonarr episode IDs
   */
  async unmonitorEpisodes(episodeIds: number[]): Promise<void> {
    if (!episodeIds.length) {
      return;
    }

    await this.request('/episode/monitor', {
      method: 'PUT',
      body: JSON.stringify({
        episodeIds,
        monitored: false,
      }),
    });

    logger.info(`Unmonitored ${episodeIds.length} episodes in Sonarr`, {
      source: 'sonarr',
      meta: { episodeIds },
    });
  }

  /**
   * Delete episode files
   * @param episodeFileIds Array of Sonarr episode file IDs
   */
  async deleteEpisodeFiles(episodeFileIds: number[]): Promise<void> {
    if (!episodeFileIds.length) {
      return;
    }

    await this.request('/episodefile/bulk', {
      method: 'DELETE',
      body: JSON.stringify({
        episodeFileIds,
      }),
    });

    logger.info(`Deleted ${episodeFileIds.length} episode files from Sonarr`, {
      source: 'sonarr',
      meta: { episodeFileIds },
    });
  }

  /**
   * Process episode deletion: unmonitor + delete files
   */
  async deleteEpisodes(episodes: SonarrEpisode[]): Promise<void> {
    // Get episode IDs and file IDs
    const episodeIds = episodes.map((ep) => ep.id);

    const episodeFileIds = episodes.filter((ep) => ep.episodeFileId).map((ep) => ep.episodeFileId!);

    // First unmonitor to prevent re-download
    await this.unmonitorEpisodes(episodeIds);

    // Then delete the files
    if (episodeFileIds.length > 0) {
      await this.deleteEpisodeFiles(episodeFileIds);
    }
  }
}
