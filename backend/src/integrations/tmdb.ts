import { logger } from '@/services/logger';

interface TmdbConfig {
  apiKey: string;
}

interface TmdbExternalIds {
  imdb_id: string | null;
  tvdb_id: number | null;
  freebase_mid: string | null;
  freebase_id: string | null;
  tvrage_id: number | null;
  wikidata_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

export class TmdbClient {
  private apiKey: string;

  private baseUrl = 'https://api.themoviedb.org/3';

  constructor(config: TmdbConfig) {
    this.apiKey = config.apiKey;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const separator = endpoint.includes('?') ? '&' : '?';

    const response = await fetch(`${url}${separator}api_key=${this.apiKey}`);

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`TMDB API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Use configuration endpoint to validate API key
      await this.request<{ images: unknown }>('/configuration');

      return {
        success: true,
        message: 'Connected to TMDB',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`TMDB connection test failed: ${message}`, { source: 'tmdb' });

      return {
        success: false,
        message: `Connection failed: ${message}`,
      };
    }
  }

  /**
   * Get external IDs for a TV series
   * @param tmdbId The TMDB ID of the TV series
   * @returns External IDs including tvdb_id and imdb_id
   */
  async getTvExternalIds(
    tmdbId: number
  ): Promise<{ tvdbId: number | null; imdbId: string | null }> {
    try {
      const externalIds = await this.request<TmdbExternalIds>(`/tv/${tmdbId}/external_ids`);

      return {
        tvdbId: externalIds.tvdb_id,
        imdbId: externalIds.imdb_id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.warn(`Failed to get TMDB external IDs for series ${tmdbId}: ${message}`, {
        source: 'tmdb',
      });

      return { tvdbId: null, imdbId: null };
    }
  }
}
