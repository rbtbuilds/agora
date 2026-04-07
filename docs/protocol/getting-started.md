# Getting Started with the Agora Protocol

This guide walks store operators through implementing the Agora Protocol from scratch. Most stores can be compliant in under an hour.

---

## Prerequisites

- A store with an accessible HTTP server
- The ability to serve a static JSON file at a well-known path
- An existing product API, or the ability to create one

---

## Step 1: Create Your `agora.json` File

The `agora.json` manifest is the entry point to your store for AI agents. It declares what your store sells and how agents can access it.

Start with the minimal required fields:

```json
{
  "$schema": "https://protocol.agora.dev/v1/schema.json",
  "version": "1.0",
  "store": {
    "name": "Your Store Name",
    "url": "https://yourstore.com"
  },
  "capabilities": {
    "products": "/api/products",
    "product": "/api/products/{id}"
  }
}
```

That is a valid, complete Agora manifest. You can add authentication, rate limits, search, and other capabilities later.

### Tips for the Manifest

**Start with `auth.type: none`.** Public read access is the fastest path to compliance and lets agents discover your products immediately. Add authentication later if you need to gate access.

**Be precise with your store URL.** Use the canonical URL — the one you'd canonicalize to in your `<link rel="canonical">` tags. Include the protocol (`https://`), exclude trailing slashes.

**Add a description.** The `store.description` field helps agents understand your catalog at a glance before fetching products. Keep it to one or two sentences.

---

## Step 2: Serve the Manifest

Place your `agora.json` at the well-known path:

```
https://yourstore.com/.well-known/agora.json
```

The file must be:
- Accessible via HTTP GET without authentication
- Served with `Content-Type: application/json`
- Accessible from the store's root domain (not a subdomain, unless your store is on a subdomain)

### Platform-Specific Instructions

**Static site / CDN:** Place `agora.json` in a directory called `.well-known` at the root of your deploy target.

**Next.js:** Add the file to `public/.well-known/agora.json`. Next.js serves everything in `public/` statically.

**Express / Node.js:** Serve the file explicitly:

```javascript
app.get('/.well-known/agora.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'agora.json'));
});
```

**Nginx:** Add to your server config:

```nginx
location = /.well-known/agora.json {
  alias /var/www/agora.json;
  add_header Content-Type application/json;
}
```

**Shopify:** Use a custom theme file or an app proxy to serve the manifest. Place it in your theme's `assets/` directory and configure a route via the Shopify Admin API or a custom app.

**CORS:** If your store is accessed by agents running in browser contexts, add the appropriate CORS headers:

```
Access-Control-Allow-Origin: *
```

---

## Step 3: Implement the Required Endpoints

The Agora Protocol requires exactly two endpoints to be compliant. Every other capability is optional.

### `products` — Paginated Product Feed

Return a paginated list of products with this response shape:

```json
{
  "data": [
    {
      "id": "prod_001",
      "url": "https://yourstore.com/products/widget",
      "name": "Classic Widget",
      "pricing": {
        "amount": "29.99",
        "currency": "USD"
      },
      "availability": {
        "status": "in_stock"
      }
    }
  ],
  "meta": {
    "total": 500,
    "page": 1,
    "per_page": 50
  }
}
```

Support `?page=N` and `?per_page=N` query parameters. A `per_page` of 50 is a sensible default; cap it at 100.

### `product` — Single Product by ID

Return a single product by ID:

```json
{
  "data": {
    "id": "prod_001",
    "url": "https://yourstore.com/products/widget",
    "name": "Classic Widget",
    "description": "The original Widget, refined over 20 years.",
    "pricing": {
      "amount": "29.99",
      "currency": "USD"
    },
    "availability": {
      "status": "in_stock",
      "quantity": 84
    }
  }
}
```

Return HTTP 404 with a meaningful error body if the product ID does not exist.

### Minimum Required Product Fields

Every product object in both endpoints MUST include:

| Field | Description |
|---|---|
| `id` | Unique, stable product identifier |
| `url` | Canonical product page URL |
| `name` | Full product name |
| `pricing.amount` | Current price as a string |
| `pricing.currency` | ISO 4217 currency code |
| `availability.status` | One of: `in_stock`, `out_of_stock`, `preorder`, `backorder`, `discontinued` |

All other fields are optional, but agents will return richer results and better answers when more fields are provided. See [product-schema.md](./product-schema.md) for the full field reference.

---

## Step 4: Validate

Run the official Agora validator against your store:

```bash
npx @agora/validator https://yourstore.com
```

The validator fetches your manifest, tests each declared capability, and verifies that responses conform to the expected schema. Fix any reported errors before proceeding.

Common issues caught by the validator:

- Missing required fields in product responses
- Incorrect `Content-Type` header on the manifest
- Unreachable capability endpoint paths
- Non-string pricing amounts (e.g., `29.99` instead of `"29.99"`)
- Invalid `availability.status` values

---

## Step 5: Register with Agora

Once your store is validated, register it in the Agora directory so agents can discover it.

**Registration is coming soon.** In the meantime, your store is discoverable by any agent that fetches `/.well-known/agora.json` from your domain.

---

## Adding Optional Capabilities

After the required endpoints are working, consider adding:

### Search

If your store has more than a few hundred products, `search` dramatically improves agent experience. Agents use search to answer specific product queries without paginating your entire catalog.

Add to your manifest:

```json
"capabilities": {
  "products": "/api/products",
  "product": "/api/products/{id}",
  "search": "/api/products/search"
}
```

Implement `GET /api/products/search?q=<query>` with the same response shape as the `products` endpoint.

### Inventory

Expose real-time stock levels so agents can check availability without fetching the full product record:

```json
"capabilities": {
  ...
  "inventory": "/api/inventory"
}
```

Implement `GET /api/inventory?ids=prod_001,prod_002`.

### Data Policy

Tell agents how to handle your data:

```json
"data_policy": {
  "cache_ttl": 3600,
  "attribution_required": false,
  "commercial_use": true
}
```

A `cache_ttl` of 3600 (one hour) is reasonable for most stores. Inventory-sensitive stores should use shorter TTLs.

---

## Minimal Working Implementation

The following is a complete, minimal implementation in Node.js/Express that satisfies the Agora Protocol with a hardcoded catalog:

```javascript
const express = require('express');
const path = require('path');
const app = express();

const products = [
  {
    id: 'prod_001',
    url: 'https://yourstore.com/products/widget',
    name: 'Classic Widget',
    pricing: { amount: '29.99', currency: 'USD' },
    availability: { status: 'in_stock', quantity: 84 }
  }
];

// Serve the manifest
app.get('/.well-known/agora.json', (req, res) => {
  res.json({
    '$schema': 'https://protocol.agora.dev/v1/schema.json',
    version: '1.0',
    store: {
      name: 'Your Store',
      url: 'https://yourstore.com'
    },
    capabilities: {
      products: '/api/products',
      product: '/api/products/{id}'
    }
  });
});

// Products feed
app.get('/api/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = Math.min(parseInt(req.query.per_page) || 50, 100);
  const start = (page - 1) * perPage;
  const data = products.slice(start, start + perPage);

  res.json({
    data,
    meta: { total: products.length, page, per_page: perPage }
  });
});

// Single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json({ data: product });
});

app.listen(3000);
```

---

## Summary

| Step | What | Time |
|---|---|---|
| 1 | Create `agora.json` | 5 minutes |
| 2 | Serve at `/.well-known/agora.json` | 5 minutes |
| 3 | Implement `/products` and `/product/{id}` | 30–60 minutes |
| 4 | Run `npx @agora/validator` | 2 minutes |
| 5 | Register (coming soon) | — |

If you run into issues, see the [full specification](./spec.md) or open an issue at https://github.com/agora-protocol/spec.
