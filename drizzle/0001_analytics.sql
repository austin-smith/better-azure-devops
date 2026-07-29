CREATE TABLE `jobs` (
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`available_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`lease_expires_at` text,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`payload` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`progress_current` integer DEFAULT 0 NOT NULL,
	`progress_total` integer DEFAULT 0 NOT NULL,
	`resource_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`started_at` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`type` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_available_idx` ON `jobs` (`status`,`priority`,`available_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `jobs_resource_idx` ON `jobs` (`resource_type`,`resource_id`,`status`);--> statement-breakpoint
CREATE TABLE `pull_request_file_metrics` (
	`additions` integer DEFAULT 0 NOT NULL,
	`change_type` text NOT NULL,
	`deletions` integer DEFAULT 0 NOT NULL,
	`measured_at` text NOT NULL,
	`measurement_status` text NOT NULL,
	`original_path` text,
	`path` text NOT NULL,
	`pull_request_id` integer NOT NULL,
	`repository_id` text NOT NULL,
	PRIMARY KEY(`repository_id`, `pull_request_id`, `path`),
	FOREIGN KEY (`repository_id`,`pull_request_id`) REFERENCES `pull_requests`(`repository_id`,`pull_request_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pull_request_file_metrics_pull_request_idx` ON `pull_request_file_metrics` (`repository_id`,`pull_request_id`);--> statement-breakpoint
CREATE INDEX `pull_request_file_metrics_path_idx` ON `pull_request_file_metrics` (`repository_id`,`path`);--> statement-breakpoint
CREATE TABLE `pull_request_metrics` (
	`additions` integer DEFAULT 0 NOT NULL,
	`deletions` integer DEFAULT 0 NOT NULL,
	`eligible_file_count` integer DEFAULT 0 NOT NULL,
	`measured_at` text NOT NULL,
	`measured_file_count` integer DEFAULT 0 NOT NULL,
	`measurement_version` integer DEFAULT 0 NOT NULL,
	`measurement_status` text NOT NULL,
	`pull_request_id` integer NOT NULL,
	`repository_id` text NOT NULL,
	`unmeasured_file_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`repository_id`, `pull_request_id`),
	FOREIGN KEY (`repository_id`,`pull_request_id`) REFERENCES `pull_requests`(`repository_id`,`pull_request_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pull_request_metrics_status_idx` ON `pull_request_metrics` (`repository_id`,`measurement_status`);--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`closed_at` text NOT NULL,
	`creator_display_name` text NOT NULL,
	`creator_id` text,
	`creator_image_url` text,
	`merge_commit_id` text,
	`merge_strategy` text,
	`pull_request_id` integer NOT NULL,
	`repository_id` text NOT NULL,
	`source_ref_name` text NOT NULL,
	`target_ref_name` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`web_url` text,
	PRIMARY KEY(`repository_id`, `pull_request_id`),
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pull_requests_repository_closed_idx` ON `pull_requests` (`repository_id`,`target_ref_name`,`closed_at`);--> statement-breakpoint
CREATE INDEX `pull_requests_creator_idx` ON `pull_requests` (`creator_id`);--> statement-breakpoint
CREATE TABLE `repositories` (
	`default_branch` text,
	`id` text PRIMARY KEY NOT NULL,
	`is_disabled` integer DEFAULT false NOT NULL,
	`is_tracked` integer DEFAULT true NOT NULL,
	`history_sync_completed_at` text,
	`last_pull_request_sync_at` text,
	`name` text NOT NULL,
	`next_pull_request_sync_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`organization_url` text NOT NULL,
	`project_id` text NOT NULL,
	`project_name` text NOT NULL,
	`pull_requests_synced_from` text,
	`pull_requests_synced_through` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`web_url` text
);
--> statement-breakpoint
CREATE INDEX `repositories_project_idx` ON `repositories` (`project_id`);--> statement-breakpoint
CREATE INDEX `repositories_sync_due_idx` ON `repositories` (`is_tracked`,`is_disabled`,`history_sync_completed_at`,`next_pull_request_sync_at`);--> statement-breakpoint
CREATE INDEX `repositories_history_sync_idx` ON `repositories` (`is_tracked`,`is_disabled`,`history_sync_completed_at`,`updated_at`);