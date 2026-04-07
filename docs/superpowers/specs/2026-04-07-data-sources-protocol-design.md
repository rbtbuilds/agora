# Agora Protocol & Data Sources Expansion — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Goal:** Establish the Agora Protocol as a defensible, acquisition-worthy standard for agent-to-store communication, then bulk up the demo catalog to 50k+ products.

---

## Context

Agora is an infrastructure layer that makes the internet agent-friendly, starting with e-commerce. Currently at 8k products from 12 Shopify stores via scraping. The scraped catalog is proof-of-concept — the real product is the **protocol** that stores implement so AI agents can discover, search, and transact with them natively.

**Strategy:** Protocol-first, then scrape. Build the standard, validator, and ingestion engine. Then bulk up demo data to make the pitch undeniable. Stores see their products already indexed and think "I should control this" — that's the adoption hook.

---

## Phase 1: Protocol Foundation

### agora.json Manifest

Served at `/.well-known/agora.json` on merchant sites. Follows well-known URI convention (like `robots.txt`, `security.txt`, `ai-plugin.json`).

```jsonc
{
  "$schema": "https://protocol.agora.dev/v1/schema.json",
  "version": "1.0",
  "store": {
    "name": "Example Store",
    "url": "https://example.com",
    "description": "Premium outdoor gear",
    "logo": "https://example.com/logo.png",
    "categories": ["outdoor", "apparel", "footwear"],
    "currency": "USD",
    "locale": "en-US"
  },
  "capabilities": {
    "search": "/api/agora/search",
    "products": "/api/agora/products",
    "product": "/api/agora/products/{id}",
    "inventory": "/api/agora/inventory",
    "cart": "/api/agora/cart",
    "checkout": "/api/agora/checkout"
  },
  "auth": {
    "type": "bearer",
    "registration": "https://example.com/developers"
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "burst": 10
  },
  "data_policy": {
    "cache_ttl": 3600,
    "attribution_required": true,
    "commercial_use": true
  }
}
```

**Capability tiers:**
- **Required:** `products`, `product` — minimum viable adoption (a JSON feed)
- **Optional:** `search`, `inventory`, `cart`, `checkout` — progressive enhancement toward full agent transactions

**Auth types:** `"none"` (public catalog), `"api_key"`, `"bearer"`, `"oauth2"`

### Product Schema

The standardized product format every agent and store agrees on.

```jsonc
{
  "id": "sku-hiking-boot-001",
  "url": "https://example.com/products/hiking-boot",
  "name": "Alpine Pro Waterproof Hiking Boot",
  "description": "Full-grain leather hiking boot with...",
  "brand": "TrailMaster",

  "pricing": {
    "amount": "189.99",
    "currency": "USD",
    "compare_at": "229.99",
    "unit_pricing": {
      "amount": "9.50",
      "unit": "oz"
    }
  },

  "availability": {
    "status": "in_stock",
    "quantity": 47,
    "lead_time_days": null,
    "regions": ["US", "CA", "EU"]
  },

  "images": [
    {
      "url": "https://example.com/img/boot-1.jpg",
      "alt": "Alpine Pro boot side view",
      "role": "primary"
    }
  ],

  "categories": [
    { "name": "Footwear", "slug": "footwear" },
    { "name": "Hiking", "slug": "hiking", "parent": "footwear" }
  ],

  "attributes": {
    "color": ["Brown", "Black"],
    "size": ["8", "9", "10", "11", "12"],
    "material": "Full-grain leather",
    "weight": "1.8 lbs"
  },

  "variants": [
    {
      "id": "sku-hiking-boot-001-brown-10",
      "attributes": { "color": "Brown", "size": "10" },
      "pricing": { "amount": "189.99", "currency": "USD" },
      "availability": { "status": "in_stock", "quantity": 12 }
    }
  ],

  "identifiers": {
    "gtin": "0123456789012",
    "upc": "012345678901",
    "isbn": null,
    "asin": "B001EXAMPLE",
    "mpn": "AP-WP-HB-001"
  },

  "reviews": {
    "average_rating": 4.6,
    "count": 342,
    "url": "https://example.com/products/hiking-boot/reviews"
  },

  "shipping": {
    "free_shipping": true,
    "free_shipping_minimum": "50.00",
    "estimated_days": { "min": 3, "max": 7 }
  },

  "metadata": {
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2026-04-06T14:30:00Z",
    "tags": ["waterproof", "hiking", "bestseller"]
  }
}
```

**Why this schema is acquisition-worthy:**
- `identifiers` (GTIN/UPC/ASIN/MPN) enables cross-store product matching — makes Agora a graph, not just a feed
- `variants` with per-variant pricing/availability — real commerce needs this
- `compare_at` pricing — agents can surface deals, drives store adoption
- `regions` on availability — international commerce from day one
- Nested categories with parent slugs — builds universal taxonomy as stores adopt

### JSON Schema Files

Formal JSON Schema for both the manifest and product format. Used by the validator.

- `packages/validator/src/schema/agora-manifest.schema.json`
- `packages/validator/src/schema/agora-product.schema.json`

### @agora/validator Package

CLI + programmatic validator.

```bash
# CLI usage
npx @agora/validator https://example.com
# Discovers /.well-known/agora.json, validates manifest, fetches products endpoint, validates product schema

# Programmatic
import { validateManifest, validateProduct, validateStore } from '@agora/validator';
const result = await validateStore('https://example.com');
```

**Validation checks:**
1. `/.well-known/agora.json` exists and is valid JSON
2. Manifest conforms to schema (required fields, valid capability URLs)
3. Required capability endpoints (`products`, `product`) are reachable
4. Product feed returns valid products matching the product schema
5. Rate limit headers are respected
6. Report: pass/fail per check, warnings for optional fields, overall score

### Dogfooding

Agora's own API serves `/.well-known/agora.json` — proving the protocol by implementing it ourselves. The existing `/v1/products/search` and `/v1/products/:id` endpoints map to the `search` and `product` capabilities.

### Deliverables

- Protocol spec document at `docs/protocol/spec.md`
- Product schema doc at `docs/protocol/product-schema.md`
- Example agora.json files at `docs/protocol/examples/`
- JSON Schema files in `packages/validator/src/schema/`
- `@agora/validator` package (CLI + library)
- Agora's own `agora.json` manifest served by the API

---

## Phase 2: Ingestion Engine

### New Endpoints

**`POST /v1/stores/register`** — Merchant submits their URL.
- Agora discovers `/.well-known/agora.json`
- Validates using `@agora/validator`
- If valid: creates store record, begins initial product sync
- Returns store ID, validation report, product count

**`GET /v1/stores`** — List all registered stores.
- Shows adoption/network size
- Filterable by capabilities, categories, status

**`GET /v1/stores/:id`** — Store details.
- Capabilities, product count, last sync, validation status

### Database Changes

New `stores` table:

```sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  agora_json_url TEXT,
  source TEXT NOT NULL,              -- "native" | "scraped"
  capabilities JSONB DEFAULT '{}',
  product_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  validation_score INTEGER,          -- 0-100
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stores_source ON stores USING btree (source);
CREATE INDEX idx_stores_status ON stores USING btree (status);
```

Add `store_id` foreign key to `products` table linking products to their store.

### Sync Worker

Periodic re-fetch of registered stores' product feeds:
- Respects `data_policy.cache_ttl` from the store's `agora.json`
- Upserts products, tracks price changes in `price_history`
- Updates `stores.last_synced_at` and `stores.product_count`
- For v1: triggered by a cron endpoint (`/api/cron/sync-stores`)

### Deliverables

- Store registration + listing endpoints on the API
- `stores` table migration
- `store_id` column on products
- Cron-based sync worker
- Pre-seed `stores` table with existing 12 Shopify stores as `source: "scraped"`

---

## Phase 3: Demo Data Sprint

### Shopify Expansion

Add ~40 curated high-volume Shopify stores across diverse categories:

**Fashion/Apparel:** Gymshark, Fashion Nova, MVMT, Chubbies, Outdoor Voices, Bombas, Kotn, Marine Layer, Buck Mason, Vuori, Rhone, True Classic, Cuts Clothing, Everlane, Reformation

**Beauty/Personal Care:** Glossier, Kylie Cosmetics, Drunk Elephant, Function of Beauty, The Ordinary (DECIEM), Fenty Beauty, Rare Beauty

**Home/Lifestyle:** Ruggable, Caraway, Our Place, Blueland, Package Free, Public Goods

**Food/Beverage:** Liquid Death, Athletic Brewing, Magic Spoon, Mudwater, OLIPOP

**Accessories/Other:** Away, Bellroy, Moment, Peak Design, Nomad Goods, Pela Case

Target: 40k+ additional products from Shopify alone.

Implementation: Add store URLs to `crawl_new.py`, run once. Each store uses the existing `/products.json` endpoint. Pre-seed each as a `stores` row with `source: "scraped"`.

### Amazon Spider

**ASIN sourcing:** Hybrid approach.
1. Download filtered Kaggle ASIN dataset (target categories: electronics, fashion, home, outdoor)
2. Supplement with Best Sellers page scrapes for trending products

**Anti-bot strategy (free tier):**
- `playwright-stealth` plugin for fingerprint randomization
- Free rotating proxy lists (rotated per-request)
- Randomized delays (2-8 seconds between requests)
- Randomized User-Agent headers
- Session rotation (new browser context every 50 requests)
- Retry with exponential backoff on CAPTCHA/block detection

**Implementation:**
- Extend existing `AmazonSpider` with category/search crawling
- Add proxy middleware to Scrapy settings
- Add stealth configuration to Playwright launch
- ASIN list loader (reads from CSV/JSON file)
- Target: 10-15k Amazon products

### Deliverables

- ~40 new Shopify stores added to crawler
- Amazon spider with anti-bot strategy
- ASIN dataset loader
- All products linked to `stores` table
- Total catalog: 50k+ products across 50+ stores and 2 sources

---

## Phase 4: Polish & Positioning

### README Rewrite

Reposition from "product search API" to "the open protocol for agent commerce." Structure:
1. What is Agora? (protocol + API + tools)
2. For AI agents (SDK, MCP server, API)
3. For stores (protocol spec, validator, adoption guide)
4. For developers (quickstart, API docs)

### Protocol Documentation

- Versioned spec at `docs/protocol/spec.md`
- Getting started guide for stores
- Integration examples (Shopify app, generic Node.js, Python)

### Adoption Metrics

Surface on demo/portal:
- Total stores (native vs scraped)
- Total products indexed
- Protocol adoption rate
- Capability coverage (how many stores support search, cart, checkout)

### Deliverables

- README rewrite
- Protocol docs published
- Validator on npm
- Adoption metrics on portal dashboard

---

## File Structure

```
agora/
├── packages/
│   ├── validator/              # NEW — @agora/validator
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── agora-manifest.schema.json
│   │   │   │   └── agora-product.schema.json
│   │   │   ├── validate.ts
│   │   │   ├── cli.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/                     # Existing — add stores table migration
│   ├── sdk/                    # Existing
│   └── mcp/                    # Existing
├── api/
│   └── src/
│       └── routes/
│           ├── stores.ts       # NEW — store registration endpoints
│           └── cron/
│               └── sync.ts     # NEW — store sync worker
├── docs/
│   └── protocol/               # NEW — spec documentation
│       ├── spec.md
│       ├── product-schema.md
│       ├── getting-started.md
│       └── examples/
│           ├── minimal.json
│           ├── full.json
│           └── shopify-adapter.json
├── crawler/                    # Existing — Phase 3 additions
│   ├── crawl_new.py            # Add ~40 more stores
│   ├── crawler/
│   │   ├── spiders/
│   │   │   ├── amazon.py       # Extend with anti-bot + ASIN loader
│   │   │   └── shopify.py
│   │   ├── middlewares/
│   │   │   └── antibot.py      # NEW — proxy rotation, stealth
│   │   └── data/
│   │       └── asins.json      # NEW — curated ASIN list
│   └── pyproject.toml          # Add stealth deps
└── README.md                   # Rewrite in Phase 4
```

---

## Success Criteria

- [ ] `agora.json` spec is detailed enough that a Shopify store could implement it in a day
- [ ] Validator catches real issues (missing fields, unreachable endpoints, invalid schemas)
- [ ] Agora dogfoods its own protocol
- [ ] Store registration flow works end-to-end
- [ ] 50k+ products in the index from 50+ stores
- [ ] README tells the acquisition story: protocol + network effect + growing adoption
