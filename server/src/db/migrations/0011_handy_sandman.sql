ALTER TABLE "pr_intent" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "risk_areas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "confidence" real;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "confidence_reason" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "classified_at" timestamp with time zone;