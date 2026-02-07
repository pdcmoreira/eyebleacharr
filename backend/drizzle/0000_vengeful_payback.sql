CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `arr_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_arr_services_type` ON `arr_services` (`type`);--> statement-breakpoint
CREATE TABLE `episode_watchers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`watched_at` text,
	FOREIGN KEY (`episode_id`) REFERENCES `watched_episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `jellyfin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_episode_watchers_episode` ON `episode_watchers` (`episode_id`);--> statement-breakpoint
CREATE INDEX `idx_episode_watchers_user` ON `episode_watchers` (`user_id`);--> statement-breakpoint
CREATE TABLE `jellyfin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`media_server_id` integer,
	`name` text NOT NULL,
	`last_synced_at` text,
	FOREIGN KEY (`media_server_id`) REFERENCES `media_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_jellyfin_users_media_server` ON `jellyfin_users` (`media_server_id`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`level` text NOT NULL,
	`source` text,
	`message` text NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `idx_logs_created_at` ON `logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_logs_level` ON `logs` (`level`);--> statement-breakpoint
CREATE INDEX `idx_logs_source` ON `logs` (`source`);--> statement-breakpoint
CREATE TABLE `media_servers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_media_servers_type` ON `media_servers` (`type`);--> statement-breakpoint
CREATE TABLE `movie_watchers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movie_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`watched_at` text,
	FOREIGN KEY (`movie_id`) REFERENCES `watched_movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `jellyfin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_watchers_movie` ON `movie_watchers` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_watchers_user` ON `movie_watchers` (`user_id`);--> statement-breakpoint
CREATE TABLE `watched_episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jellyfin_id` text NOT NULL,
	`series_id` integer,
	`season_number` integer,
	`episode_number` integer,
	`title` text,
	`file_path` text,
	`size_bytes` integer,
	`last_watched_at` text,
	`sonarr_episode_id` integer,
	`sonarr_episode_file_id` integer,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`series_id`) REFERENCES `watched_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watched_episodes_jellyfin_id_unique` ON `watched_episodes` (`jellyfin_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_episodes_series` ON `watched_episodes` (`series_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_episodes_last_watched` ON `watched_episodes` (`last_watched_at`);--> statement-breakpoint
CREATE TABLE `watched_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jellyfin_id` text NOT NULL,
	`media_server_id` integer,
	`title` text NOT NULL,
	`year` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`poster_url` text,
	`file_path` text,
	`size_bytes` integer,
	`last_watched_at` text,
	`status` text DEFAULT 'watched',
	`delete_method` text,
	`deleted_at` text,
	`radarr_id` integer,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`media_server_id`) REFERENCES `media_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watched_movies_jellyfin_id_unique` ON `watched_movies` (`jellyfin_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_movies_media_server` ON `watched_movies` (`media_server_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_movies_status` ON `watched_movies` (`status`);--> statement-breakpoint
CREATE INDEX `idx_watched_movies_tmdb` ON `watched_movies` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_movies_last_watched` ON `watched_movies` (`last_watched_at`);--> statement-breakpoint
CREATE TABLE `watched_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jellyfin_id` text NOT NULL,
	`media_server_id` integer,
	`title` text NOT NULL,
	`year` integer,
	`tmdb_id` integer,
	`tvdb_id` integer,
	`imdb_id` text,
	`poster_url` text,
	`total_episodes` integer DEFAULT 0,
	`watched_episodes` integer DEFAULT 0,
	`status` text DEFAULT 'watched',
	`delete_method` text,
	`deleted_at` text,
	`sonarr_series_id` integer,
	`sonarr_title_slug` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`media_server_id`) REFERENCES `media_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watched_series_jellyfin_id_unique` ON `watched_series` (`jellyfin_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_series_media_server` ON `watched_series` (`media_server_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_series_status` ON `watched_series` (`status`);--> statement-breakpoint
CREATE INDEX `idx_watched_series_tmdb` ON `watched_series` (`tmdb_id`);