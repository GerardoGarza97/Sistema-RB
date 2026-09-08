-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
ALTER TABLE `cash_outflows` ADD `items_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `notes` text DEFAULT '' NOT NULL;