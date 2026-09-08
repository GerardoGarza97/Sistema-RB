-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
CREATE TABLE `order_reschedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`previous_date` text NOT NULL,
	`new_date` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_order_reschedules_order` ON `order_reschedules` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipment_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shipment_reviews_order` ON `shipment_reviews` (`order_id`);--> statement-breakpoint
CREATE TABLE `shipment_review_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_id` integer NOT NULL,
	`order_item_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `shipment_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_shipment_review_lots_review` ON `shipment_review_lots` (`review_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shipment_review_lots_review_lot` ON `shipment_review_lots` (`review_id`,`lot_id`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `scheduled_send_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `send_delay_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `sent_at` text;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `lot_id` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `minimum_stock` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
PRAGMA optimize;
