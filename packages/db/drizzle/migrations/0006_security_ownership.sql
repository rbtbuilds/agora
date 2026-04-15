ALTER TABLE carts ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE checkouts ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_carts_owner ON carts(owner_id);
CREATE INDEX idx_checkouts_owner ON checkouts(owner_id);
CREATE INDEX idx_orders_owner ON orders(owner_id);
