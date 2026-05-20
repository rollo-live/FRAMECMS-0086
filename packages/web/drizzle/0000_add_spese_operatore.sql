CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_name` text NOT NULL,
	`client_email` text NOT NULL,
	`client_phone` text,
	`event_type` text NOT NULL,
	`event_type_custom` text,
	`services` text DEFAULT '[]' NOT NULL,
	`event_date` integer NOT NULL,
	`event_location` text,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`booking_token` text NOT NULL,
	`google_calendar_event_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_booking_token_unique` ON `appointments` (`booking_token`);--> statement-breakpoint
CREATE TABLE `client_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`token` text NOT NULL,
	`label` text,
	`expires_at` integer,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_tokens_token_unique` ON `client_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`company` text,
	`type` text DEFAULT 'client' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`tags` text DEFAULT '[]',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contabilita_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`socio_a_name` text DEFAULT 'Alessio Rollo' NOT NULL,
	`socio_b_name` text DEFAULT 'Gianluca Distante' NOT NULL,
	`accantonamento_rate` real DEFAULT 20 NOT NULL,
	`forfettario_base` real DEFAULT 78 NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contabilita_settings_tenant_id_unique` ON `contabilita_settings` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`quote_id` text,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`signed_at` integer,
	`signer_ip` text,
	`signer_name` text,
	`signer_email` text,
	`share_token` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contracts_share_token_unique` ON `contracts` (`share_token`);--> statement-breakpoint
CREATE TABLE `entrate` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`descrizione` text NOT NULL,
	`importo` real NOT NULL,
	`acconto` real DEFAULT 0,
	`saldo_ricevuto` real DEFAULT 0,
	`client_id` text,
	`beneficiario` text DEFAULT 'split' NOT NULL,
	`fattura` integer DEFAULT false NOT NULL,
	`spese_operatore` real DEFAULT 0,
	`categoria` text DEFAULT 'Altro' NOT NULL,
	`note` text,
	`data` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `face_persone` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`nome` text DEFAULT 'Persona sconosciuta' NOT NULL,
	`embedding_medio` text,
	`cover_photo_id` text,
	`visibile_a_soci` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `foto_persone` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`embedding` text,
	`face_box` text,
	`created_at` integer,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`persona_id`) REFERENCES `face_persone`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`watermark_enabled` integer DEFAULT true NOT NULL,
	`download_enabled` integer DEFAULT false NOT NULL,
	`download_with_watermark` integer DEFAULT true NOT NULL,
	`share_token` text,
	`access_gate` integer DEFAULT false NOT NULL,
	`access_approval` text DEFAULT 'auto' NOT NULL,
	`like_limit` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `galleries_share_token_unique` ON `galleries` (`share_token`);--> statement-breakpoint
CREATE TABLE `gallery_access` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`access_token` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_access_access_token_unique` ON `gallery_access` (`access_token`);--> statement-breakpoint
CREATE TABLE `google_calendar_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`calendar_id` text DEFAULT 'primary' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_calendar_tokens_tenant_id_unique` ON `google_calendar_tokens` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `pareggi` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`tipo` text NOT NULL,
	`importo` real NOT NULL,
	`debitore` text NOT NULL,
	`creditore` text NOT NULL,
	`entrata_id` text,
	`note` text,
	`data` integer,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entrata_id`) REFERENCES `entrate`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photo_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`client_id` text,
	`author_name` text,
	`text` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`thumbnail_key` text,
	`width` integer,
	`height` integer,
	`order` integer DEFAULT 0 NOT NULL,
	`likes` text DEFAULT '[]' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text,
	`contract_id` text,
	`name` text NOT NULL,
	`type` text DEFAULT 'photo' NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`location` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`number` text NOT NULL,
	`title` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 22 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`valid_until` integer,
	`intro_text` text,
	`closing_text` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_id` text,
	`due_date` integer,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`permissions` text DEFAULT 'null',
	`token` text NOT NULL,
	`invited_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_token_unique` ON `team_invites` (`token`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`primary_color` text DEFAULT '#F5A623' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `uscite` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`descrizione` text NOT NULL,
	`importo` real NOT NULL,
	`categoria` text DEFAULT 'Altro' NOT NULL,
	`divisi_per_meta` integer DEFAULT false NOT NULL,
	`pagato_da` text DEFAULT 'studio' NOT NULL,
	`note` text,
	`data` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`role` text DEFAULT 'owner' NOT NULL,
	`permissions` text DEFAULT 'null',
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `video_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`client_id` text,
	`author_name` text,
	`timecode_ms` integer NOT NULL,
	`text` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`version` text DEFAULT 'v1' NOT NULL,
	`r2_key` text DEFAULT '' NOT NULL,
	`duration` real,
	`share_token` text,
	`allow_download` integer DEFAULT true NOT NULL,
	`watermark_enabled` integer DEFAULT false NOT NULL,
	`watermark_text` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_share_token_unique` ON `videos` (`share_token`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);