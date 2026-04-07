CREATE TYPE "public"."store_source" AS ENUM('native', 'scraped');--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"agora_json_url" text,
	"source" "store_source" NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb,
	"product_count" integer DEFAULT 0 NOT NULL,
	"validation_score" integer,
	"last_synced_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "store_id" text;--> statement-breakpoint
CREATE INDEX "idx_stores_source" ON "stores" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_stores_status" ON "stores" USING btree ("status");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_products_store" ON "products" USING btree ("store_id");