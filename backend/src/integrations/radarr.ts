/**
 * Radarr API Client
 * Handles movie management and deletion via Radarr
 */

import { logger } from '@/services/logger';

interface RadarrConfig {
  url: string;
  apiKey: string;
}

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  path?: string;
  sizeOnDisk?: number;
  hasFile: boolean;
}

interface RadarrSystemStatus {
  version: string;
  appName: string;
}

export class RadarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: RadarrConfig) {
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

      throw new Error(`Radarr API error: ${response.status} ${response.statusText} - ${errorText}`);
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
      const status = await this.request<RadarrSystemStatus>('/system/status');

      return {
        success: true,
        message: `Connected to ${status.appName}`,
        version: status.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Radarr connection test failed: ${message}`);

      return {
        success: false,
        message: `Connection failed: ${message}`,
      };
    }
  }

  /**
   * Get all movies from Radarr
   */
  async getMovies(): Promise<RadarrMovie[]> {
    return this.request<RadarrMovie[]>('/movie');
  }

  /**
   * Find a movie by TMDB ID
   */
  async findMovieByTmdbId(tmdbId: number): Promise<RadarrMovie | null> {
    const movies = await this.getMovies();

    return movies.find((movie) => movie.tmdbId === tmdbId) || null;
  }

  /**
   * Batch delete movies with file deletion and import exclusion
   * @param movieIds Array of Radarr movie IDs
   */
  async deleteMovies(movieIds: number[]): Promise<void> {
    if (!movieIds.length) {
      return;
    }

    await this.request('/movie/editor', {
      method: 'DELETE',
      body: JSON.stringify({
        movieIds,
        deleteFiles: true,
        addImportExclusion: true,
      }),
    });

    logger.info(`Deleted ${movieIds.length} movies from Radarr`, {
      source: 'radarr',
      meta: { movieIds },
    });
  }
}
