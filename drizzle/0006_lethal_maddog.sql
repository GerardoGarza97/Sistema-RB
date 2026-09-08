-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
CREATE TABLE `cash_outflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer,
	`beneficiary` text NOT NULL,
	`concept` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`movement_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cash_outflows_date` ON `cash_outflows` (`movement_date`);
--> statement-breakpoint
PRAGMA optimize;
