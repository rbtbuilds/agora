# agora-sdk

TypeScript SDK for the [Agora API](https://github.com/rbtbuilds/agora) — the open protocol for AI agent commerce. Search products, build carts, and run consumer-approved checkouts across 22,500+ items on 52 stores through one unified interface.

Protocol v1.0 · MIT licensed · Zero dependencies · Full TypeScript types.

**Checkout is a prototype:** approval records an order but does not charge a card or complete a real purchase. Do not use it for live transactions.

## Install

```bash
npm install agora-sdk
```

## Usage

### Discovery

```typescript
import { Agora } from 'agora-sdk'

const agora = new Agora({ apiKey: 'ak_your_key' })

const results = await agora.search('waterproof hiking boots under $100')
const product = await agora.product('agr_abc123')
const similar = await agora.similar('agr_abc123')
const categories = await agora.categories()
```

### Cart + checkout (consumer-approved)

```typescript
// 1. Create a cart for a consumer
const { data: cart } = await agora.createCart('consumer_alice')

// 2. Add items
await agora.addToCart(cart.id, 'agr_abc123', 2)

// 3. Begin checkout — returns approval token + URL
const { data: checkout } = await agora.createCheckout({
  cartId: cart.id,
  consumerId: 'consumer_alice',
  approvalMode: 'inline',
})

// 4. Show the user the approval URL
const url = agora.approvalUrl(checkout.approvalToken!)
console.log(`Tell user to visit: ${url}`)

// 5a. Either: agent approves on consumer's behalf after they say "yes"
const { data: completed } = await agora.approveCheckout(checkout.id, checkout.approvalToken!)
console.log(`Orders created: ${completed.orders.map(o => o.id).join(', ')}`)

// 5b. Or: poll status if consumer approves via the web URL
const { data: status } = await agora.getCheckout(checkout.id)
// status.status === 'completed' | 'pending' | 'denied' | 'expired'
```

Get an API key at [agora-portal.vercel.app](https://agora-portal.vercel.app).

## API surface

### Discovery

| Method | Description |
|---|---|
| `agora.search(query, options?)` | Search products. Options: `source`, `minPrice`, `maxPrice`, `availability`, `category`, `page`, `perPage`. |
| `agora.product(id)` | Fetch a single product by Agora ID. |
| `agora.similar(id)` | Find products similar to a given product. |
| `agora.categories(parentId?)` | List product categories. |

### Cart

| Method | Description |
|---|---|
| `agora.createCart(consumerId)` | Create a new cart for a consumer. |
| `agora.getCart(cartId)` | Fetch a cart with items and subtotal. Bypasses cache. |
| `agora.addToCart(cartId, productId, quantity?)` | Add a product to a cart. Default quantity = 1. |
| `agora.removeFromCart(cartId, itemId)` | Remove an item from a cart by numeric item id. |

### Checkout

| Method | Description |
|---|---|
| `agora.createCheckout(opts)` | Begin a checkout. `opts`: `{ cartId, consumerId, paymentMethodId?, approvalMode? }`. Returns approval token (inline mode) and total. |
| `agora.approveCheckout(checkoutId, token)` | Approve a pending checkout using the token. Returns order(s). |
| `agora.denyCheckout(checkoutId, token)` | Deny a pending checkout. No charge. |
| `agora.getCheckout(checkoutId)` | Poll a checkout's status. Bypasses cache. |
| `agora.approvalUrl(token)` | Build the human-facing approval URL — visit in a browser to approve out-of-band. |

### Orders

| Method | Description |
|---|---|
| `agora.listOrders(consumerId)` | List orders for a consumer. |
| `agora.getOrder(orderId)` | Fetch a single order with line items. |

### Utility

| Method | Description |
|---|---|
| `agora.clearCache()` | Clear the in-memory response cache. |

## Configuration

```typescript
new Agora({
  apiKey: 'ak_your_key',
  baseUrl: 'https://api.agora.dev', // override for self-hosted or staging
  cacheTtl: 60_000,                  // milliseconds; default 60s
})
```

## Behavior

- **Response caching.** GETs cache in-memory for 60s by default. Cart and checkout reads bypass the cache automatically. POST/DELETE clear the cache.
- **Auth.** Bearer token in the `Authorization` header.
- **Errors.** Non-2xx responses throw with the API's error message.

## Consent model

Card charging is not connected. Approval tokens expire in 15 minutes; the authenticated API uses timing-safe comparison when checking a token.

## License

MIT.

---

Built by [Bento Labs](https://github.com/rbtbuilds/agora) · [Protocol spec](https://github.com/rbtbuilds/agora/blob/main/docs/protocol/spec.md) · [Live API](https://agora-ecru-chi.vercel.app)
