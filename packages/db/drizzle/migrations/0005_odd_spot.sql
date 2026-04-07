CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"product_id" text NOT NULL,
	"store_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_at_add" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"consumer_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"consumer_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approval_token" text NOT NULL,
	"approval_mode" varchar(10) DEFAULT 'inline' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"payment_method_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkouts_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
CREATE TABLE "consumers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"stripe_customer_id" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"checkout_id" text NOT NULL,
	"consumer_id" text NOT NULL,
	"store_id" text,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"consumer_id" text NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"last4" varchar(4) NOT NULL,
	"brand" varchar(20) NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cart_items_cart" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "idx_carts_consumer" ON "carts" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "idx_carts_status" ON "carts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_checkouts_consumer" ON "checkouts" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "idx_checkouts_status" ON "checkouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_checkouts_token" ON "checkouts" USING btree ("approval_token");--> statement-breakpoint
CREATE INDEX "idx_consumers_user" ON "consumers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_consumer" ON "orders" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_store" ON "orders" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_orders_checkout" ON "orders" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "idx_payment_methods_consumer" ON "payment_methods" USING btree ("consumer_id");