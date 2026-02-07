import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// Note: Using inline string literals instead of importing enums because
// drizzle-kit runs in a separate process that doesn't respect tsconfig paths.
// The shared/types/enums.ts file contains the corresponding TypeScript enums
// that should be kept in sync with these values.

// Logs Table (existing)

export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    level: text('level', {
      enum: ['info', 'warn', 'error', 'debug'],
    }).notNull(),
    source: text('source'),
    message: text('message').notNull(),
    meta: text('meta'), // JSON string for extra fields
  },
  (table) => [
    index('idx_logs_created_at').on(table.createdAt),
    index('idx_logs_level').on(table.level),
    index('idx_logs_source').on(table.source),
  ]
);

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;

// Media Server Configurations (Jellyfin, maybe in the future: Emby, Plex, etc.)

export const mediaServers = sqliteTable(
  'media_servers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['jellyfin'] }).notNull(),
    url: text('url').notNull(),
    apiKey: text('api_key').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_media_servers_type').on(table.type)]
);

export type MediaServerRecord = typeof mediaServers.$inferSelect;
export type NewMediaServerRecord = typeof mediaServers.$inferInsert;

// *arr Service Configurations (Radarr, Sonarr)

export const arrServices = sqliteTable(
  'arr_services',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['radarr', 'sonarr'] }).notNull(),
    url: text('url').notNull(),
    apiKey: text('api_key').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_arr_services_type').on(table.type)]
);

export type ArrServiceRecord = typeof arrServices.$inferSelect;
export type NewArrServiceRecord = typeof arrServices.$inferInsert;

// Jellyfin Users (synced from media server)

export const jellyfinUsers = sqliteTable(
  'jellyfin_users',
  {
    id: text('id').primaryKey(), // Jellyfin user ID
    mediaServerId: integer('media_server_id').references(() => mediaServers.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    lastSyncedAt: text('last_synced_at'),
  },
  (table) => [index('idx_jellyfin_users_media_server').on(table.mediaServerId)]
);

export type JellyfinUserRecord = typeof jellyfinUsers.$inferSelect;
export type NewJellyfinUserRecord = typeof jellyfinUsers.$inferInsert;

// Watched Movies

export const watchedMovies = sqliteTable(
  'watched_movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jellyfinId: text('jellyfin_id').notNull().unique(),
    mediaServerId: integer('media_server_id').references(() => mediaServers.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    year: integer('year'),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),
    posterUrl: text('poster_url'),
    filePath: text('file_path'),
    sizeBytes: integer('size_bytes'),
    lastWatchedAt: text('last_watched_at'),
    status: text('status', {
      enum: ['watched', 'pending_delete', 'deleted', 'failed'],
    }).default('watched'),
    deleteMethod: text('delete_method', {
      enum: ['radarr-api', 'jellyfin-api'],
    }),
    deletedAt: text('deleted_at'),
    radarrId: integer('radarr_id'), // Radarr movie ID for deletion (null if not found in Radarr)
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_watched_movies_media_server').on(table.mediaServerId),
    index('idx_watched_movies_status').on(table.status),
    index('idx_watched_movies_tmdb').on(table.tmdbId),
    index('idx_watched_movies_last_watched').on(table.lastWatchedAt),
  ]
);

export type WatchedMovieRecord = typeof watchedMovies.$inferSelect;
export type NewWatchedMovieRecord = typeof watchedMovies.$inferInsert;

// Movie Watchers - junction table for movies ↔ users

export const movieWatchers = sqliteTable(
  'movie_watchers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => watchedMovies.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => jellyfinUsers.id, { onDelete: 'cascade' }),
    watchedAt: text('watched_at'),
  },
  (table) => [
    index('idx_movie_watchers_movie').on(table.movieId),
    index('idx_movie_watchers_user').on(table.userId),
  ]
);

export type MovieWatcherRecord = typeof movieWatchers.$inferSelect;
export type NewMovieWatcherRecord = typeof movieWatchers.$inferInsert;

// Watched Series (parent container)

export const watchedSeries = sqliteTable(
  'watched_series',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jellyfinId: text('jellyfin_id').notNull().unique(),
    mediaServerId: integer('media_server_id').references(() => mediaServers.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    year: integer('year'),
    tmdbId: integer('tmdb_id'),
    tvdbId: integer('tvdb_id'),
    imdbId: text('imdb_id'),
    posterUrl: text('poster_url'),
    totalEpisodes: integer('total_episodes').default(0),
    watchedEpisodes: integer('watched_episodes').default(0),
    status: text('status', {
      enum: ['watched', 'pending_delete', 'deleted', 'failed'],
    }).default('watched'),
    deleteMethod: text('delete_method', {
      enum: ['sonarr-api', 'jellyfin-api'],
    }),
    deletedAt: text('deleted_at'),
    sonarrSeriesId: integer('sonarr_series_id'), // Sonarr series ID for deletion (null if not found in Sonarr)
    sonarrTitleSlug: text('sonarr_title_slug'), // Sonarr URL slug (e.g., "stranger-things")
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_watched_series_media_server').on(table.mediaServerId),
    index('idx_watched_series_status').on(table.status),
    index('idx_watched_series_tmdb').on(table.tmdbId),
  ]
);

export type WatchedSeriesRecord = typeof watchedSeries.$inferSelect;
export type NewWatchedSeriesRecord = typeof watchedSeries.$inferInsert;

// Watched Episodes

export const watchedEpisodes = sqliteTable(
  'watched_episodes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jellyfinId: text('jellyfin_id').notNull().unique(),
    seriesId: integer('series_id').references(() => watchedSeries.id, {
      onDelete: 'cascade',
    }),
    seasonNumber: integer('season_number'),
    episodeNumber: integer('episode_number'),
    title: text('title'),
    filePath: text('file_path'),
    sizeBytes: integer('size_bytes'),
    lastWatchedAt: text('last_watched_at'),
    sonarrEpisodeId: integer('sonarr_episode_id'), // Sonarr episode ID for unmonitoring
    sonarrEpisodeFileId: integer('sonarr_episode_file_id'), // Sonarr episode file ID for deletion
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_watched_episodes_series').on(table.seriesId),
    index('idx_watched_episodes_last_watched').on(table.lastWatchedAt),
  ]
);

export type WatchedEpisodeRecord = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisodeRecord = typeof watchedEpisodes.$inferInsert;

// Episode Watchers - junction table for episodes ↔ users

export const episodeWatchers = sqliteTable(
  'episode_watchers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    episodeId: integer('episode_id')
      .notNull()
      .references(() => watchedEpisodes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => jellyfinUsers.id, { onDelete: 'cascade' }),
    watchedAt: text('watched_at'),
  },
  (table) => [
    index('idx_episode_watchers_episode').on(table.episodeId),
    index('idx_episode_watchers_user').on(table.userId),
  ]
);

export type EpisodeWatcherRecord = typeof episodeWatchers.$inferSelect;
export type NewEpisodeWatcherRecord = typeof episodeWatchers.$inferInsert;

// App Settings (generic key-value store)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'), // JSON-encoded value
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export type AppSettingRecord = typeof appSettings.$inferSelect;
export type NewAppSettingRecord = typeof appSettings.$inferInsert;
