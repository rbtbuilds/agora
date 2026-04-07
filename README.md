# Agora

**The open protocol for agent commerce.**

The internet was built for human browsers. AI agents need to discover, search, and transact with stores programmatically — but today's web has no standard interface for them. Agora defines that interface.

Agora is an open protocol (`agora.json`), a product search API, a TypeScript SDK, an MCP server, and a validator. Stores adopt the protocol. Agents use the SDK or API to transact across all of them.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm: agora-sdk](https://img.shields.io/npm/v/agora-sdk?label=agora-sdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-sdk)
[![npm: agora-mcp-server](https://img.shields.io/npm/v/agora-mcp-server?label=agora-mcp-server&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-mcp-server)

[**Live API**](https://agora-ecru-chi.vercel.app) · [**Demo**](https://demo-five-coral-13.vercel.app) · [**Developer Portal**](https://portal-opal-two.vercel.app) · [Protocol](#the-protocol) · [For Agents](#for-ai-agents) · [For Stores](#for-stores) · [API Reference](#api-reference)

---

## The Protocol

Stores declare agent-readiness by serving `agora.json` at `/.well-known/agora.json`. This file describes the store's identity, supported capabilities, and API endpoints.

```json
{
  "agora": "1.0",
  "name": "Example Store",
  "type": "commerce",
  "capabilities": ["products", "search", "cart", "checkout"],
  "endpoints": {
    "products": "https://example.com/api/products",
    "search": "https://example.com/api/search"
  }
}
```

Adoption is tiered. Start with a product feed. Add search, cart, and checkout as your infrastructure supports it. Agents discover what each store can do and act accordingly.

Full specification: [docs/protocol/spec.md](docs/protocol/spec.md)

---

## For AI Agents

Three integration paths. Choose the one that fits your stack.

### SDK

```bash
npm install agora-sdk
```

```typescript
import { Agora } from 'agora-sdk'

const agora = new Agora({ apiKey: 'ak_your_key' })

// Search across all indexed stores
const results = await agora.search('waterproof hiking boots under $100')

// Get a specific product
const product = await agora.product('agr_abc123')

// Find similar products
const similar = await agora.similar('agr_abc123')

// Browse categories
const categories = await agora.categories()
```

Built-in response caching. Full TypeScript types. Zero dependencies.

### MCP Server

For agents that support the [Model Context Protocol](https://modelcontextprotocol.io/) — Claude, ChatGPT, Cursor, and others.

```bash
npm install agora-mcp-server
```

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["agora-mcp-server"],
      "env": {
        "AGORA_API_KEY": "ak_your_key"
      }
    }
  }
}
```

Exposes three tools: `agora_search`, `agora_product`, `agora_similar`.

### REST API

Direct HTTP access. No SDK required.

```bash
curl https://agora-ecru-chi.vercel.app/v1/products/search?q=running+shoes \
  -H "Authorization: Bearer ak_your_key"
```

---

## For Stores

Adopt the protocol in three steps.

**1. Create your `agora.json`**

Declare your store's capabilities and endpoints. Start minimal — a product feed is enough to get listed.

**2. Serve it at the standard path**

```
https://yourdomain.com/.well-known/agora.json
```

**3. Validate**

```bash
npx @agora/validator https://yourdomain.com
```

The validator checks your `agora.json` against the protocol spec and reports any issues.

Getting started guide: [docs/protocol/getting-started.md](docs/protocol/getting-started.md)

---

## Architecture

Monorepo managed by [Turborepo](https://turbo.build/).

| Package | Description |
|---------|-------------|
| `packages/validator` | Protocol validator — CLI and library |
| `packages/sdk` | TypeScript SDK for agent developers |
| `packages/mcp` | MCP server for AI agent tool use |
| `packages/api` | API server (Hono) |
| `packages/db` | Database schema (Drizzle + PostgreSQL) |
| `packages/portal` | Developer portal (Next.js) |
| `packages/demo` | Demo application (Next.js) |
| `crawler/` | Data ingestion (Scrapy + Playwright) |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/rbtbuilds/agora.git
cd agora
npm install

# Configure environment
cp .env.example .env
# Set DATABASE_URL and OPENAI_API_KEY in .env

# Run database migrations
cd packages/db
npx drizzle-kit generate
npx drizzle-kit migrate

# Start development servers
cd ../..
npm run dev
```

Prerequisites: Node.js 22+, PostgreSQL 16+ with [pgvector](https://github.com/pgvector/pgvector), Python 3.12+ with [uv](https://docs.astral.sh/uv/), OpenAI API key.

---

## API Reference

Base URL: `https://agora-ecru-chi.vercel.app`

All endpoints require `Authorization: Bearer ak_...` except where noted.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/agora.json` | Protocol descriptor for this API |
| `GET` | `/v1/products/search?q=...` | Search products by keyword or natural language |
| `GET` | `/v1/products/:id` | Get product details by ID |
| `GET` | `/v1/products/:id/similar` | Find similar products |
| `GET` | `/v1/categories` | List product categories |

---

## Status

**Current:** 8,000+ products indexed across 12 stores. Protocol v1.0.

**Roadmap:**
- 50,000+ products across 100+ stores
- Self-serve store registration via the developer portal
- Semantic search with pgvector embeddings
- Real-time price and availability tracking
- Cart and checkout protocol extensions

---

## License

MIT
