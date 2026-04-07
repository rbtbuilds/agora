<div align="center">

# Agora

**The agent-friendly commerce layer for the internet.**

Agora makes the web accessible to AI agents by providing a unified API, SDK, and MCP server for discovering, comparing, and purchasing products across e-commerce sites.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm: agora-sdk](https://img.shields.io/npm/v/agora-sdk?label=agora-sdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-sdk)
[![npm: agora-mcp-server](https://img.shields.io/npm/v/agora-mcp-server?label=agora-mcp-server&color=cb3837&logo=npm)](https://www.npmjs.com/package/agora-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white)](https://www.python.org/)

[**Try the Demo →**](https://demo-five-coral-13.vercel.app) · [**Developer Portal →**](https://portal-opal-two.vercel.app) · [Getting Started](#getting-started) · [SDK Usage](#sdk-usage) · [MCP Server](#mcp-server) · [API Reference](#api-reference) · [Architecture](#architecture)

</div>

---

## The Problem

The internet was built for humans clicking through UIs. AI agents need to act on behalf of humans — search, compare, purchase — but today's web isn't designed for them. Every site has different HTML, different APIs, different auth flows. Building an agent that can shop across the web means building a scraper for every single store.

## The Solution

Agora crawls e-commerce sites and exposes a **single, unified API** that any AI agent can use. One integration gives agents access to products across Amazon, Shopify stores, and more.

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────────┐
│  Agent  │────▶│   SDK   │────▶│   API   │────▶│  Index (DB)  │
└─────────┘     └─────────┘     └─────────┘     └──────────────┘
                                                        ▲
                                                  ┌─────┴──────┐
                                                  │  Crawler    │
                                                  └────────────┘
```

**Phase 1** (current): Discovery — search and compare products across stores
**Phase 2**: Availability — real-time price and stock checks
**Phase 3**: Transactions — agents can purchase on behalf of users

## Packages

| Package | Description | Tech |
|---------|-------------|------|
| [`@agora/api`](packages/api) | REST API serving product data | TypeScript, Hono, Vercel |
| [`agora-sdk`](packages/sdk) | TypeScript SDK for agent developers | TypeScript, zero deps |
| [`agora-mcp-server`](packages/mcp) | MCP server for native AI agent integration | TypeScript, MCP SDK |
| [`@agora/db`](packages/db) | Database schema and client | Drizzle ORM, PostgreSQL, pgvector |
| [`crawler`](crawler) | E-commerce site crawler | Python, Scrapy, Playwright |

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16+ with [pgvector](https://github.com/pgvector/pgvector)
- OpenAI API key (for semantic search embeddings)

### Setup

```bash
# Clone and install
git clone https://github.com/rbtbuilds/agora.git
cd agora
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and OPENAI_API_KEY

# Run database migrations
cd packages/db
npx drizzle-kit generate
npx drizzle-kit migrate

# Install crawler dependencies
cd ../../crawler
uv sync

# Start the API locally
cd ../packages/api
npm run dev
```

## SDK Usage

Install the SDK in your agent project:

```bash
npm install agora-sdk
```

```typescript
import { Agora } from 'agora-sdk'

const agora = new Agora({ apiKey: 'ak_your_key' })

// Search products with natural language
const results = await agora.search('waterproof hiking boots under $100')

// Get product details
const product = await agora.product('agr_abc123')

// Find similar products across stores
const similar = await agora.similar('agr_abc123')

// Browse categories
const categories = await agora.categories()
```

The SDK includes built-in response caching, full TypeScript types, and semantic search support.

## MCP Server

Any AI agent that supports the [Model Context Protocol](https://modelcontextprotocol.io/) can use Agora natively — no SDK installation needed.

Add to your MCP config (e.g. Claude Code, Cursor, etc.):

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

**Available tools:**
| Tool | Description |
|------|-------------|
| `agora_search` | Search products with natural language or keywords |
| `agora_product` | Get detailed product information by ID |
| `agora_similar` | Find similar products for comparison shopping |

## API Reference

Base URL: `https://agora-ecru-chi.vercel.app`

All endpoints require an API key via `Authorization: Bearer ak_...` header.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth required) |
| `GET` | `/v1/products/search?q=...` | Search products |
| `GET` | `/v1/products/:id` | Get product details |
| `GET` | `/v1/products/:id/similar` | Find similar products |
| `GET` | `/v1/categories` | Browse product categories |

### Response Format

All responses use a consistent envelope:

```json
{
  "data": { ... },
  "meta": {
    "freshness": "2h ago",
    "source": "amazon",
    "confidence": 0.95
  }
}
```

The `confidence` score reflects data freshness — recently crawled products score higher, stale data scores lower. Agents can use this to decide whether to trust cached data.

## Architecture

Agora is a monorepo managed by [Turborepo](https://turbo.build/) with four TypeScript packages and a Python crawler.

**Data flow:**
1. **Crawler** (Python/Scrapy) scrapes e-commerce sites and extracts structured product data
2. **Index** (PostgreSQL + pgvector) stores normalized products with vector embeddings for semantic search
3. **API** (TypeScript/Hono) serves the data to agents via REST endpoints
4. **SDK** (TypeScript) wraps the API with a typed client, caching, and convenience methods
5. **MCP Server** exposes Agora as tools for MCP-compatible AI agents

**Search strategy:**
- Short queries (≤3 words) → keyword search via PostgreSQL full-text
- Natural language queries → semantic search via pgvector with OpenAI embeddings

## Future: Agora Protocol

The long-term vision is an open protocol (`agora.json`) that any website can adopt to declare itself agent-friendly — like `robots.txt` for AI agents. Sites that adopt the protocol get richer listings, real-time data, and direct agent access.

```json
{
  "agora": "1.0",
  "name": "Cool Shoes Co",
  "type": "commerce",
  "capabilities": ["search", "availability", "purchase"]
}
```

## Development

```bash
npm run build   # Build all packages
npm run test    # Run all tests
npm run dev     # Start dev servers
```

### Running Crawler Tests

```bash
cd crawler
uv sync --extra dev
uv run python -m pytest -v
```

## License

MIT
