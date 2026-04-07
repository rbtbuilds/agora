# Commerce Layer — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Overview

Enable AI agents to purchase products on behalf of consumers. Consumers save a payment method with Agora (via Stripe). Agents build carts and request checkout. Consumers approve purchases either inline (agent asks directly) or via SMS/email link for programmatic agents. Agora charges the card and forwards the order to the store.

## Flow: Agent + Live Consumer

1. Consumer says "buy me those hiking boots"
2. Agent calls `POST /v1/cart` to create a cart
3. Agent calls `POST /v1/cart/:id/items` to add the product
4. Agent calls `POST /v1/checkout` with cartId and consumerId
5. API returns `approval_token` + `prompt` text + `total`
6. Agent shows consumer: "Approve $89.99 at Allbirds? [Yes/No]"
7. Consumer says yes
8. Agent calls `POST /v1/checkout/:id/approve` with `approval_token`
9. API charges card via Stripe Payment Intent, creates order, dispatches webhook to store
10. Agent confirms: "Order confirmed"

## Flow: Programmatic Agent (no human)

1. Agent calls cart + checkout endpoints
2. API detects no inline approval → sends SMS/email to consumer
3. Consumer receives "Approve $89.99 at Allbirds? [link]"
4. Consumer taps link → `/approve/:token` page → confirms
5. API charges card, creates order
6. Agent receives `order.completed` webhook

## Endpoints

### Payment Methods (auth required)

- `POST /v1/payment-methods` — Save a card via Stripe Setup Intent. Body: `{ returnUrl }`. Returns Stripe client secret for frontend card collection.
- `GET /v1/payment-methods` — List consumer's saved cards (last4, brand, isDefault).
- `DELETE /v1/payment-methods/:id` — Remove a saved card.

### Cart (auth required)

- `POST /v1/cart` — Create a cart. Returns cart ID.
- `GET /v1/cart/:id` — View cart with items, prices, subtotal.
- `POST /v1/cart/:id/items` — Add item. Body: `{ productId, quantity }`. Looks up current price and store.
- `DELETE /v1/cart/:id/items/:itemId` — Remove item.

### Checkout (auth required)

- `POST /v1/checkout` — Initiate checkout. Body: `{ cartId, paymentMethodId?, approvalMode? }`. `approvalMode`: `"inline"` (default, returns token for agent) or `"async"` (sends SMS/email). Returns checkout ID, approval token, prompt text, total, expiry.
- `POST /v1/checkout/:id/approve` — Approve purchase. Body: `{ approvalToken }`. Charges card, creates order(s).
- `POST /v1/checkout/:id/deny` — Deny purchase.
- `GET /v1/checkout/:id` — Check checkout status.

### Orders (auth required)

- `GET /v1/orders` — List consumer's orders.
- `GET /v1/orders/:id` — Order detail with items, status, store info.

### Approval Page (public)

- `GET /approve/:token` — HTML page showing order summary with Approve/Deny buttons. Used for SMS/email fallback.
- `POST /approve/:token/confirm` — Form POST from approval page.

## DB Tables

### consumers
```
id                    TEXT PRIMARY KEY
user_id               TEXT REFERENCES users(id)
stripe_customer_id    TEXT
phone                 TEXT
email                 TEXT
created_at            TIMESTAMPTZ DEFAULT now()
```

### payment_methods
```
id                        TEXT PRIMARY KEY
consumer_id               TEXT REFERENCES consumers(id)
stripe_payment_method_id  TEXT NOT NULL
last4                     VARCHAR(4) NOT NULL
brand                     VARCHAR(20) NOT NULL
is_default                INTEGER DEFAULT 0
created_at                TIMESTAMPTZ DEFAULT now()
```

### carts
```
id          TEXT PRIMARY KEY
consumer_id TEXT REFERENCES consumers(id)
status      VARCHAR(20) DEFAULT 'open'  -- open, checked_out, abandoned
created_at  TIMESTAMPTZ DEFAULT now()
```

### cart_items
```
id            SERIAL PRIMARY KEY
cart_id       TEXT REFERENCES carts(id)
product_id    TEXT REFERENCES products(id)
store_id      TEXT REFERENCES stores(id)
quantity      INTEGER DEFAULT 1
price_at_add  NUMERIC(12,2) NOT NULL
created_at    TIMESTAMPTZ DEFAULT now()
```

### checkouts
```
id                       TEXT PRIMARY KEY
cart_id                  TEXT REFERENCES carts(id)
consumer_id              TEXT REFERENCES consumers(id)
status                   VARCHAR(20) DEFAULT 'pending'  -- pending, approved, denied, completed, expired
approval_token           TEXT NOT NULL UNIQUE
approval_mode            VARCHAR(10) DEFAULT 'inline'  -- inline, async
total_amount             NUMERIC(12,2) NOT NULL
stripe_payment_intent_id TEXT
payment_method_id        TEXT REFERENCES payment_methods(id)
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ DEFAULT now()
```

### orders
```
id            TEXT PRIMARY KEY
checkout_id   TEXT REFERENCES checkouts(id)
consumer_id   TEXT REFERENCES consumers(id)
store_id      TEXT REFERENCES stores(id)
status        VARCHAR(20) DEFAULT 'confirmed'  -- confirmed, shipped, delivered, cancelled
total_amount  NUMERIC(12,2) NOT NULL
items         JSONB NOT NULL  -- snapshot of cart items
created_at    TIMESTAMPTZ DEFAULT now()
```

## Stripe Integration

- Use Stripe Setup Intents to save cards (no charge at save time)
- Use Stripe Payment Intents to charge at checkout approval
- Store Stripe Customer ID on consumers table
- Store Stripe Payment Method ID on payment_methods table
- Agora is the merchant of record — stores receive order notifications via webhooks

## Webhook Events

New events for the webhook system:
- `order.created` — fired to the store when an order is confirmed
- `order.completed` — fired to the agent's webhook when payment succeeds
- `checkout.approved` — fired when consumer approves
- `checkout.denied` — fired when consumer denies
- `checkout.expired` — fired when approval window expires (15 min default)

## Security

- Approval tokens are single-use, expire in 15 minutes
- Consumers must have a saved payment method before checkout
- Agents cannot charge cards without consumer approval
- SMS/email approval includes order details so consumer knows what they're approving
- All checkout endpoints require auth (API key)
