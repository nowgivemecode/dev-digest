-- Drop the old single-column PK (pr_id was the PK; PostgreSQL names it pr_brief_pkey)
ALTER TABLE "pr_brief" DROP CONSTRAINT "pr_brief_pkey";--> statement-breakpoint
-- Add new UUID primary key
ALTER TABLE "pr_brief" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_brief" ADD CONSTRAINT "pr_brief_pkey" PRIMARY KEY ("id");--> statement-breakpoint
-- pr_id stays NOT NULL (FK already exists, just loses PK role)
ALTER TABLE "pr_brief" ALTER COLUMN "pr_id" SET NOT NULL;--> statement-breakpoint
-- New columns
ALTER TABLE "pr_brief" ADD COLUMN "head_sha" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_brief" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Unique index on (pr_id, head_sha)
CREATE UNIQUE INDEX "pr_brief_pr_sha_uq" ON "pr_brief" USING btree ("pr_id","head_sha");
