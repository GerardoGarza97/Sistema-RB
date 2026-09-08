-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
ALTER TABLE `order_items` ADD `ordered_boxes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `ordered_units` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `units_per_box` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `units_per_box` integer DEFAULT 1 NOT NULL;