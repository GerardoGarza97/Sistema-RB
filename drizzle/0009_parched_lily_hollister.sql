-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
ALTER TABLE `payments` ADD `payment_condition` text DEFAULT 'SIN_ESPECIFICAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `collection_channel` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `comments` text DEFAULT '' NOT NULL;