ALTER TABLE "users" ADD COLUMN "expertise" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "expertise_embedding" vector(1024);