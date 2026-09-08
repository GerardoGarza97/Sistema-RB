-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
CREATE TABLE `auth_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`app_user_id` integer NOT NULL,
	`auth_user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`app_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_app_user` ON `auth_sessions` (`app_user_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `username` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `auth_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_username` ON `app_users` (`username`) WHERE "app_users"."username" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_app_users_auth_user_id` ON `app_users` (`auth_user_id`) WHERE "app_users"."auth_user_id" IS NOT NULL;