/**
 * Jellyfin API Client
 * Implements MediaServerProvider for Jellyfin servers
 */

import { logger } from '@/services/logger';
import {
  MediaServerProvider,
  MediaServerUser,
  WatchedItem,
} from '@/integrations/mediaServerProvider';

interface JellyfinConfig {
  url: string;
  apiKey: string;
}

interface JellyfinUserResponse {
  Id: string;
  Name: string;
}

interface JellyfinItemResponse {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Episode';
  ProductionYear?: number;
  ProviderIds?: {
    Tmdb?: string;
    Tvdb?: string;
    Imdb?: string;
  };
  ImageTags?: {
    Primary?: string;
  };
  Path?: string;
  MediaSources?: Array<{
    Size?: number;
  }>;
  UserData?: {
    LastPlayedDate?: string;
  };
  // Episode-specific
  SeriesId?: string;
  SeriesName?: string;
  ParentIndexNumber?: number; // Season number
  IndexNumber?: number; // Episode number
}

interface JellyfinItemsResponse {
  Items: JellyfinItemResponse[];
  TotalRecordCount: number;
}

export class JellyfinClient implements MediaServerProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: JellyfinConfig) {
    // Remove trailing slash from URL
    this.baseUrl = config.url.replace(/\/$/, '');

    this.apiKey = config.apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'X-Emby-Token': this.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Jellyfin API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle empty responses (e.g., DELETE)
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
      const info = await this.request<{ ServerName: string; Version: string }>('/System/Info');

      return {
        success: true,
        message: `Connected to ${info.ServerName}`,
        version: info.Version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Jellyfin connection test failed: ${message}`);

      return {
        success: false,
        message: `Connection failed: ${message}`,
      };
    }
  }

  async getUsers(): Promise<MediaServerUser[]> {
    const users = await this.request<JellyfinUserResponse[]>('/Users');

    return users.map((user) => ({
      id: user.Id,
      name: user.Name,
    }));
  }

  async getWatchedItems(userId: string): Promise<WatchedItem[]> {
    // Fetch played movies
    const moviesResponse = await this.request<JellyfinItemsResponse>(
      `/Users/${userId}/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie&Fields=ProviderIds,Path,MediaSources`
    );

    // Fetch played episodes
    const episodesResponse = await this.request<JellyfinItemsResponse>(
      `/Users/${userId}/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Episode&Fields=ProviderIds,Path,MediaSources`
    );

    const movies: WatchedItem[] = moviesResponse.Items.map((item) =>
      this.mapToWatchedItem(item, 'movie')
    );

    const episodes: WatchedItem[] = episodesResponse.Items.map((item) =>
      this.mapToWatchedItem(item, 'episode')
    );

    return [...movies, ...episodes];
  }

  private mapToWatchedItem(item: JellyfinItemResponse, type: 'movie' | 'episode'): WatchedItem {
    // Build poster URL if available
    let posterUrl: string | undefined;

    if (item.ImageTags?.Primary) {
      posterUrl = `${this.baseUrl}/Items/${item.Id}/Images/Primary`;
    }

    // Get file size from first media source
    const sizeBytes = item.MediaSources?.[0]?.Size;

    return {
      id: item.Id,
      type,
      title: item.Name,
      year: item.ProductionYear,
      tmdbId: item.ProviderIds?.Tmdb,
      imdbId: item.ProviderIds?.Imdb,
      posterUrl,
      filePath: item.Path,
      sizeBytes,
      lastPlayedDate: item.UserData?.LastPlayedDate,
      // Episode-specific
      seriesId: item.SeriesId,
      seriesName: item.SeriesName,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber,
    };
  }

  async deleteItems(itemIds: string[]): Promise<void> {
    if (!itemIds.length) {
      return;
    }

    // Jellyfin supports batch delete via comma-separated IDs
    const idsParam = itemIds.join(',');

    await this.request(`/Items?ids=${idsParam}`, {
      method: 'DELETE',
    });

    logger.info(`Deleted ${itemIds.length} items from Jellyfin`, {
      source: 'jellyfin',
      meta: { itemIds },
    });
  }

  /**
   * Get series information for grouping episodes
   * @param seriesId The Jellyfin series ID
   * @param userId A user ID for the request context (Jellyfin requires this)
   */
  async getSeries(seriesId: string, userId: string): Promise<JellyfinItemResponse | null> {
    try {
      return await this.request<JellyfinItemResponse>(
        `/Users/${userId}/Items/${seriesId}?Fields=ProviderIds,ImageTags`
      );
    } catch (error) {
      logger.warn(`Failed to get series info for ${seriesId}: ${(error as Error).message}`, {
        source: 'jellyfin',
      });

      return null;
    }
  }
}
