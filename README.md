# Agora

**The open protocol for agent commerce.**

The internet was built for human browsers. AI agents need to discover, search, and transact with stores programmatically -but today's web has no standard interface for them. Agora defines that interface.

Agora is an open protocol, a commerce transaction layer, a public registry, and a complete toolkit for AI agents. Stores adopt the protocol. Agents discover, search, compare, and purchase across all of them through a single API.

[![License: MIT + BSL](https://img.shields.io/badge/License-MIT%20%2B%20BSL-blue.svg)](LICENSE)
[![CI](https://github.com/rbtbuilds/agora/actions/workflows/ci.yml/badge.svg)](https://github.com/rbtbuilds/agora/actions/workflows/ci.yml)
[![npm: agora-sdk](https://img.shields.io/npm/v/agora-sdk?label=agora-sdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-sdk)
[![npm: agora-mcp-server](https://img.shields.io/npm/v/agora-mcp-server?label=agora-mcp-server&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-mcp-server)

[**Live API**](https://agora-ecru-chi.vercel.app) · [**API Playground**](https://agora-ecru-chi.vercel.app/playground) · [**Registry**](https://agora-ecru-chi.vercel.app/v1/registry/stats) · [**Demo**](https://demo-five-coral-13.vercel.app) · [**Marketing**](https://marketing-six-kohl.vercel.app)

---

## The Protocol

Stores declare agent-readiness by serving `agora.json` at `/.well-known/agora.json`. This manifest describes the store's identity, capabilities, authentication, rate limits, and data policy.

```json
{
  "version": "1.0",
  "store": {
    "name": "Example Store",
    "url": "https://example.com"
  },
  "capabilities": {
    "products": "/api/agora/products",
    "product": "/api/agora/products/{id}",
    "search": "/api/agora/search",
    "cart": "/api/agora/cart",
    "checkout": "/api/agora/checkout"
  },
  "auth": { "type": "none" },
  "rate_limits": { "requests_per_minute": 60 },
  "data_policy": { "cache_ttl": 3600, "commercial_use": true }
}
```

Capabilities are tiered. Start with a product feed. Add search, cart, and checkout as your infrastructure supports it. Agents discover what each store can do and act accordingly.

Full specification: [docs/protocol/spec.md](docs/protocol/spec.md) | Product schema: [docs/protocol/product-schema.md](docs/protocol/product-schema.md)

---

## The Commerce Layer

Agents don't just search -they buy. Agora provides a complete transaction flow with consumer-approved payments.

```
Consumer: "Buy me those hiking boots"
Agent:    POST /v1/cart → adds product
Agent:    POST /v1/checkout → initiates purchase
Agora:    "Approve $89.99 at Allbirds?"
Consumer: "Yes"
Agent:    POST /v1/checkout/:id/approve
Agora:    Charges card, creates order, notifies store
Agent:    "Done! Order confirmed."
```

**How it works:**
1. Consumers save a payment method with Agora (via Stripe)
2. Agents build carts and request checkout
3. Consumers approve purchases inline (agent asks directly) or via SMS/email link
4. Agora charges the card and forwards the order to the store

Agents cannot charge cards without consumer approval. Every purchase requires explicit consent. Approval tokens are single-use and expire in 15 minutes.

---

## The Registry

A public, searchable directory of every store on the network. No authentication required. Agents query the registry to discover stores without knowing their URLs.

```bash
# Browse all stores
curl https://agora-ecru-chi.vercel.app/v1/registry

# Search by name
curl https://agora-ecru-chi.vercel.app/v1/registry?q=outdoor

# Filter and sort
curl https://agora-ecru-chi.vercel.app/v1/registry?source=native&sort=score

# Network stats
curl https://agora-ecru-chi.vercel.app/v1/registry/stats
```

Each store listing includes analytics (weekly query count, product views) and a trust score based on protocol compliance, data quality, and agent activity.

---

## For AI Agents

Three integration paths.

### SDK

```bash
npm install agora-sdk
```

```typescript
import { Agora } from 'agora-sdk'

const agora = new Agora({ apiKey: 'ak_your_key' })

const results = await agora.search('waterproof hiking boots under $100')
const product = await agora.product('agr_abc123')
const similar = await agora.similar('agr_abc123')
```

Built-in response caching. Full TypeScript types. Zero dependencies.

### MCP Server

For agents that support the [Model Context Protocol](https://modelcontextprotocol.io/) -Claude, ChatGPT, Cursor, and others.

```bash
npm install agora-mcp-server
```

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["agora-mcp-server"],
      "env": { "AGORA_API_KEY": "ak_your_key" }
    }
  }
}
```

### REST API

Direct HTTP access with Bearer token authentication.

```bash
curl https://agora-ecru-chi.vercel.app/v1/products/search?q=running+shoes \
  -H "Authorization: Bearer ak_your_key"
```

Interactive playground: [agora-ecru-chi.vercel.app/playground](https://agora-ecru-chi.vercel.app/playground)

---

## For Stores

### Option 1: Shopify Adapter (zero config)

Any Shopify store can join the protocol instantly. No code changes. One API call.

```bash
curl -X POST https://agora-ecru-chi.vercel.app/v1/adapter/shopify \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-shopify-store.com"}'
```

Agora generates your `agora.json`, proxies your product feed in protocol format, and registers your store in the public registry.

### Option 2: Native Implementation

Implement the protocol directly for full control.

1. Create your `agora.json` -declare capabilities and endpoints
2. Serve it at `/.well-known/agora.json`
3. Implement the required endpoints (`products` and `product`)
4. Validate: `npx @agora/validator https://yourdomain.com`
5. Register: `POST /v1/stores/register` with your URL

Getting started guide: [docs/protocol/getting-started.md](docs/protocol/getting-started.md)

### What Stores Get

- **Listed in the public registry** -agents discover your store automatically
- **Agent commerce** -agents can build carts and purchase from your store with consumer approval
- **Analytics** -see how agents interact with your products (queries, views, trends)
- **Trust score** -protocol compliance rating that agents use to prioritize stores
- **Webhooks** -real-time notifications for searches, product views, and orders
- **Cross-store visibility** -your products appear in comparison results across the network

---

## Architecture

Monorepo managed by [Turborepo](https://turbo.build/). CI via GitHub Actions.

| Package | Description |
|---------|-------------|
| `packages/validator` | Protocol validator -CLI and library (`@agora/validator`) |
| `packages/sdk` | TypeScript SDK for agent developers (`agora-sdk`) |
| `packages/mcp` | MCP server for AI agent tool use (`agora-mcp-server`) |
| `packages/api` | API server (Hono on Vercel) |
| `packages/db` | Database schema and migrations (Drizzle + PostgreSQL + pgvector) |
| `packages/portal` | Developer portal with auth and billing (Next.js) |
| `packages/demo` | Demo application with AI chat agent (Next.js) |
| `crawler/` | Data ingestion -Shopify bulk crawler, Amazon spider (Scrapy + Playwright) |

---

## API Reference

Base URL: `https://agora-ecru-chi.vercel.app`

OpenAPI spec: [`/openapi.json`](https://agora-ecru-chi.vercel.app/openapi.json) | Playground: [`/playground`](https://agora-ecru-chi.vercel.app/playground)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/agora.json` | Protocol manifest |
| `GET` | `/openapi.json` | OpenAPI 3.1 specification |
| `GET` | `/playground` | Interactive API playground |
| `GET` | `/v1/registry` | Browse stores (search, filter, sort) |
| `GET` | `/v1/registry/stats` | Network statistics |
| `GET` | `/v1/registry/:id` | Store detail with analytics |
| `GET` | `/v1/registry/:id/trust-score` | Protocol compliance score |
| `GET` | `/v1/registry/:id/analytics` | Weekly analytics breakdown |
| `GET` | `/v1/adapter/shopify/:id/agora.json` | Adapted store manifest |
| `GET` | `/v1/adapter/shopify/:id/products` | Adapted product feed |
| `GET` | `/approve/:token` | Purchase approval page |

### Products and Search (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/products/search?q=...` | Search products |
| `GET` | `/v1/products/:id` | Product detail |
| `GET` | `/v1/products/:id/similar` | Similar products |
| `GET` | `/v1/products/:id/compare` | Cross-store price comparison |
| `GET` | `/v1/categories` | Product categories |

### Commerce (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/cart` | Create a cart |
| `GET` | `/v1/cart/:id` | View cart with items and subtotal |
| `POST` | `/v1/cart/:id/items` | Add item to cart |
| `DELETE` | `/v1/cart/:id/items/:itemId` | Remove item from cart |
| `POST` | `/v1/checkout` | Initiate checkout (returns approval prompt) |
| `POST` | `/v1/checkout/:id/approve` | Approve purchase |
| `POST` | `/v1/checkout/:id/deny` | Deny purchase |
| `GET` | `/v1/checkout/:id` | Check checkout status |
| `GET` | `/v1/orders` | List orders |
| `GET` | `/v1/orders/:id` | Order detail |

### Stores and Webhooks (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/stores/register` | Register a store |
| `POST` | `/v1/stores/:id/webhooks` | Create webhook |
| `GET` | `/v1/stores/:id/webhooks` | List webhooks |
| `DELETE` | `/v1/stores/:id/webhooks/:wid` | Delete webhook |
| `POST` | `/v1/adapter/shopify` | Adapt a Shopify store |

---

## Quick Start

```bash
git clone https://github.com/rbtbuilds/agora.git
cd agora
npm install

# Configure environment
cp .env.example .env
# Set DATABASE_URL in .env

# Run database migrations
cd packages/db && npx drizzle-kit migrate && cd ../..

# Build all packages
npm run build

# Run tests
npm run test

# Start development
npm run dev
```

Prerequisites: Node.js 22+, PostgreSQL 16+ with pgvector.

---

## Status

**22,000+ products** indexed across **52 stores**. Full commerce transaction layer. Protocol v1.0.

| Metric | Value |
|--------|-------|
| Products | 22,562 |
| Stores | 52 |
| API endpoints | 30+ |
| Test coverage | 50 tests |
| Protocol version | 1.0 |

**Roadmap:**
- Semantic search with pgvector embeddings
- Stripe live payment processing
- Marketing site and custom domains
- 100k+ products across 200+ stores

---

## License

Dual licensed:

- **Protocol, Validator, SDK, MCP Server** - [MIT](LICENSE). Use freely. Build on it. The protocol is an open standard.
- **API, Platform, Portal, Crawler** - [Business Source License 1.1](LICENSE-BSL). Source available for reading, learning, and non-production use. Commercial production use requires a license. Converts to Apache 2.0 on 2030-04-07.
