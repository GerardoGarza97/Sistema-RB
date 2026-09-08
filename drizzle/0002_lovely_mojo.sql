-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
CREATE TABLE `drivers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_drivers_name` ON `drivers` (`name`);--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer,
	`driver_id` integer NOT NULL,
	`customer` text NOT NULL,
	`invoice_number` text NOT NULL,
	`contents` text NOT NULL,
	`delivery_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deliveries_date` ON `deliveries` (`delivery_date`);--> statement-breakpoint
CREATE INDEX `idx_deliveries_driver` ON `deliveries` (`driver_id`);--> statement-breakpoint
PRAGMA optimize;
