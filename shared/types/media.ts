import { MediaStatus } from './enums';

export interface WatchedMovie {
  id: number;
  jellyfinId: string;
  title: string;
  year?: number;
  posterUrl?: string;
  sizeBytes?: number;
  lastWatchedAt?: string;
  watchedByUserIds: string[];
  status: MediaStatus;
}

export interface WatchedEpisode {
  id: number;
  jellyfinId: string;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  sizeBytes?: number;
  lastWatchedAt?: string;
  watchedByUserIds: string[];
}

export interface WatchedSeries {
  id: number;
  jellyfinId: string;
  title: string;
  year?: number;
  posterUrl?: string;
  totalEpisodes: number;
  watchedEpisodes: number;
  status: MediaStatus;
  episodes: WatchedEpisode[];
}

export interface JellyfinUser {
  id: string;
  name: string;
}

export interface SyncStatus {
  lastSyncAt?: string;
  isRunning: boolean;
  error?: string;
  intervalMinutes: number;
}

export interface DeleteResult {
  success: boolean;
  deletedMovies: number;
  deletedEpisodes: number;
  failures: Array<{
    id: number;
    type: 'movie' | 'episode';
    error: string;
  }>;
}

// Delete preview types

export type DeleteMethod = 'radarr' | 'sonarr' | 'jellyfin';

export interface DeletePreviewItem {
  id: number;
  type: 'movie' | 'episode';
  title: string;
  deleteMethod: DeleteMethod;
  externalUrl: string | null;
  // For episodes
  seriesTitle?: string;
  seasonEpisode?: string; // "S01E05" format
}
