-- @file Migración generada de Cloudflare D1/SQLite. Mantén el orden numérico y no edites migraciones ya aplicadas.
ALTER TABLE `cash_outflows` ADD `requires_invoice_validation` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `invoice_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `validation_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `invoice_validated_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `invoice_validated_at` text;--> statement-breakpoint
CREATE INDEX `idx_cash_outflows_invoice_validation` ON `cash_outflows` (`requires_invoice_validation`,`invoice_validated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cash_outflows_supplier_invoice` ON `cash_outflows` (`supplier_id`,`invoice_number`) WHERE "cash_outflows"."invoice_number" <> '';