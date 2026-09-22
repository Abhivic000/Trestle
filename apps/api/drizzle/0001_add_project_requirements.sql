-- Hand-edited after generation: add the column with a temporary default so any
-- existing rows get a value, then drop the default (the app always supplies one).
ALTER TABLE "projects" ADD COLUMN "requirements" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "requirements" DROP DEFAULT;
