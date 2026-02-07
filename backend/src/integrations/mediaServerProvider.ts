/**
 * Media Server Provider Interface
 * Abstract interface for media server integrations (Jellyfin, Emby, Plex)
 */

export interface MediaServerUser {
  id: string;
  name: string;
}

export interface WatchedItem {
  id: string;
  type: 'movie' | 'series' | 'episode';
  title: string;
  year?: number;
  tmdbId?: string;
  imdbId?: string;
  posterUrl?: string;
  filePath?: string;
  sizeBytes?: number;
  lastPlayedDate?: string;
  // For episodes
  seriesId?: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface MediaServerProvider {
  /**
   * Test the connection to the media server
   */
  testConnection(): Promise<{ success: boolean; message: string; version?: string }>;

  /**
   * Get all users from the media server
   */
  getUsers(): Promise<MediaServerUser[]>;

  /**
   * Get all watched items for a specific user
   */
  getWatchedItems(userId: string): Promise<WatchedItem[]>;

  /**
   * Delete items from the media server
   * @param itemIds Array of item IDs to delete
   */
  deleteItems(itemIds: string[]): Promise<void>;
}
