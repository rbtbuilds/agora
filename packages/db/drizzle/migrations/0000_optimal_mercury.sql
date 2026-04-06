CREATE TYPE "public"."availability" AS ENUM('in_stock', 'out_of_stock', 'unknown');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"parent_id" integer,
	"source" varchar(50),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_embeddings" (
	"product_id" text PRIMARY KEY NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_amount" numeric(12, 2),
	"price_currency" varchar(3) DEFAULT 'USD',
	"images" jsonb DEFAULT '[]'::jsonb,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"availability" "availability" DEFAULT 'unknown',
	"seller_name" text,
	"seller_url" text,
	"seller_rating" numeric(3, 2),
	"last_crawled" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_product" ON "price_history" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_recorded" ON "price_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_embeddings_vector" ON "product_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_products_source" ON "products" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_products_availability" ON "products" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "idx_products_source_url" ON "products" USING btree ("source_url");