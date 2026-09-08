-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
ALTER TABLE `orders` ADD `delivery_zone` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_location` text;