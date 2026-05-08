ALTER TABLE "carts" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "checkouts" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_carts_owner" ON "carts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_checkouts_owner" ON "checkouts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_orders_owner" ON "orders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_stores_owner" ON "stores" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_owner" ON "webhooks" USING btree ("owner_id");