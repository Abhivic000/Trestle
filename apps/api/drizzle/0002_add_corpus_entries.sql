-- Hand-added after generation: the vector type must exist before the table uses
-- it. No-op when the extension was already enabled from the Supabase dashboard.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "corpus_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"pattern_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"when_to_use" text NOT NULL,
	"when_not_to_use" text NOT NULL,
	"tradeoffs" jsonb NOT NULL,
	"source_note" text NOT NULL,
	"source_url" text,
	"embedding" vector(768),
	"content_hash" text NOT NULL,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corpus_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "corpus_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "corpus_entries_pattern_type_idx" ON "corpus_entries" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "corpus_entries_embedding_idx" ON "corpus_entries" USING hnsw ("embedding" vector_cosine_ops);