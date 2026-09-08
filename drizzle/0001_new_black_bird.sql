-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
CREATE TABLE `order_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`order_item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_returns_order_item` ON `order_returns` (`order_id`,`order_item_id`);--> statement-breakpoint
PRAGMA optimize;
