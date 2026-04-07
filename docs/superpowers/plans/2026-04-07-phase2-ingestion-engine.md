# Phase 2: Ingestion Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the system that registers stores, validates their agora.json, indexes their products, and tracks adoption — creating the network effect.

**Architecture:** New `stores` table tracks registered stores (both scraped and protocol-native). New Hono routes handle store registration and listing. A `store_id` column on `products` links products to their store. Registration validates via `@agora/validator` then fetches the product feed.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, PostgreSQL, @agora/validator, Vitest.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/api/src/routes/stores.ts` | Hono router for store CRUD endpoints |
| `packages/api/test/stores.test.ts` | Tests for store endpoints |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/src/schema.ts` | Add `stores` table, add `storeId` to `products` |
| `packages/db/src/index.ts` | Export new `stores` table |
| `api/index.ts` | Mount stores router |
| `packages/api/src/index.ts` | Mount stores router (if this is the Hono app) |

---

## Task 1: Add Stores Table to Schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add the stores table and storeId to products**

Add after the `products` table definition in `packages/db/src/schema.ts`:

```typescript
export const storeSourceEnum = pgEnum("store_source", ["native", "scraped"]);

export const stores = pgTable(
  "stores",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull().unique(),
    agoraJsonUrl: text("agora_json_url"),
    source: storeSourceEnum("source").notNull(),
    capabilities: jsonb("capabilities").$type<Record<string, string>>().default({}),
    productCount: integer("product_count").notNull().default(0),
    validationScore: integer("validation_score"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stores_source").on(table.source),
    index("idx_stores_status").on(table.status),
  ]
);
```

Also add `storeId` column to the `products` table:

```typescript
storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
```

And add an index for it in the products table indexes:

```typescript
index("idx_products_store").on(table.storeId),
```

- [ ] **Step 2: Export stores from index.ts**

In `packages/db/src/index.ts`, the `export * from "./schema.js"` already covers it since stores is exported from schema.ts.

- [ ] **Step 3: Generate migration**

```bash
cd packages/db && npx drizzle-kit generate
```

- [ ] **Step 4: Build the db package**

```bash
cd packages/db && npx tsc
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/
git commit -m "feat: add stores table and storeId to products schema"
```

---

## Task 2: Store Routes — Registration

**Files:**
- Create: `packages/api/src/routes/stores.ts`
- Create: `packages/api/test/stores.test.ts`
- Modify: `api/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/api/test/stores.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock @agora/db
vi.mock("@agora/db", () => {
  const mockStores: any[] = [];
  let insertedStore: any = null;

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((val: any) => {
      insertedStore = val;
      return {
        returning: vi.fn().mockResolvedValue([val]),
        then: vi.fn().mockResolvedValue(undefined),
      };
    }),
  });

  const mockSelectFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(mockStores),
    }),
  });

  // Smart select for auth middleware
  const smartSelect = vi.fn().mockImplementation((arg?: unknown) => {
    if (arg && typeof arg === "object") {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { key: "ak_test_key_12345678", tier: "free", revokedAt: null },
          ]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockStores),
        }),
      }),
    };
  });

  return {
    db: {
      select: smartSelect,
      insert: mockInsert,
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    },
    products: {},
    productEmbeddings: {},
    categories: {},
    apiKeys: {},
    usageLogs: {},
    stores: {},
  };
});

import app from "../src/index.js";

const AUTH_HEADER = { Authorization: "Bearer ak_test_key_12345678" };

describe("store endpoints", () => {
  it("POST /v1/stores/register returns 400 without url", async () => {
    const res = await app.request("/v1/stores/register", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("GET /v1/stores returns 200 with array", async () => {
    const res = await app.request("/v1/stores", {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /v1/stores requires auth", async () => {
    const res = await app.request("/v1/stores");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Implement stores router**

```typescript
// packages/api/src/routes/stores.ts
import { Hono } from "hono";
import { db, stores } from "@agora/db";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "node:crypto";

const storesRouter = new Hono();

function generateStoreId(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
  return `str_${hash}`;
}

// POST /v1/stores/register
storesRouter.post("/register", async (c) => {
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      400
    );
  }

  if (!body.url) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Field 'url' is required" } },
      400
    );
  }

  const storeUrl = body.url.replace(/\/$/, "");
  const storeId = generateStoreId(storeUrl);

  // Check if already registered
  const existing = await db
    .select()
    .from(stores)
    .where(eq(stores.url, storeUrl))
    .limit(1);

  if (existing.length > 0) {
    return c.json({
      data: existing[0],
      meta: { message: "Store already registered" },
    });
  }

  // Try to fetch and validate agora.json
  let storeName = new URL(storeUrl).hostname;
  let capabilities: Record<string, string> = {};
  let validationScore: number | null = null;
  let agoraJsonUrl: string | null = null;
  let source: "native" | "scraped" = "scraped";

  try {
    const manifestUrl = `${storeUrl}/.well-known/agora.json`;
    const res = await fetch(manifestUrl);
    if (res.ok) {
      const manifest = await res.json();
      if (manifest?.version === "1.0" && manifest?.store?.name) {
        source = "native";
        storeName = manifest.store.name;
        agoraJsonUrl = manifestUrl;
        capabilities = manifest.capabilities ?? {};
        // Simple validation score: count non-empty sections
        let score = 50; // base for having a valid manifest
        if (manifest.auth) score += 10;
        if (manifest.rate_limits) score += 10;
        if (manifest.data_policy) score += 10;
        if (manifest.capabilities?.search) score += 10;
        if (manifest.capabilities?.cart) score += 10;
        validationScore = score;
      }
    }
  } catch {
    // No agora.json — register as scraped
  }

  const newStore = {
    id: storeId,
    name: storeName,
    url: storeUrl,
    agoraJsonUrl,
    source,
    capabilities,
    productCount: 0,
    validationScore,
    status: "active",
  };

  await db.insert(stores).values(newStore);

  return c.json({ data: newStore, meta: { source } }, 201);
});

// GET /v1/stores
storesRouter.get("/", async (c) => {
  const source = c.req.query("source");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);

  let query = db.select().from(stores);

  if (source === "native" || source === "scraped") {
    query = query.where(eq(stores.source, source)) as typeof query;
  }

  const results = await query.orderBy(desc(stores.createdAt)).limit(limit);

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(stores);

  return c.json({
    data: results,
    meta: { total: Number(total[0]?.count ?? 0) },
  });
});

// GET /v1/stores/:id
storesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(stores)
    .where(eq(stores.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Store ${id} not found` } },
      404
    );
  }

  return c.json({ data: result[0] });
});

export { storesRouter };
```

- [ ] **Step 3: Mount the router in api/index.ts**

Add to `api/index.ts` after the products router import:

```typescript
import { storesRouter } from "../packages/api/src/routes/stores.js";
```

And mount it after the categories route:

```typescript
app.route("/v1/stores", storesRouter);
```

Also mount in `packages/api/src/index.ts` if it exists as a separate Hono app.

- [ ] **Step 4: Run tests**

```bash
cd packages/api && npx vitest run test/stores.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/stores.ts packages/api/test/stores.test.ts api/index.ts
git commit -m "feat: add store registration and listing endpoints"
```

---

## Task 3: Update Landing Page and agora.json

**Files:**
- Modify: `api/index.ts`

- [ ] **Step 1: Add stores endpoints to the landing page HTML**

In the endpoints section of the landing page HTML in `api/index.ts`, add:

```html
<div class="endpoint">
  <span class="method">POST</span>
  <span class="path">/v1/stores/register</span>
  <span class="desc">Register a store</span>
</div>
<div class="endpoint">
  <span class="method">GET</span>
  <span class="path">/v1/stores</span>
  <span class="desc">List stores</span>
</div>
<div class="endpoint">
  <span class="method">GET</span>
  <span class="path">/v1/stores/:id</span>
  <span class="desc">Store details</span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add api/index.ts
git commit -m "feat: add store endpoints to API landing page"
```

---

## Task 4: Pre-seed Existing Stores

**Files:**
- Create: `crawler/seed_stores.py`

- [ ] **Step 1: Create a script to seed the stores table with existing Shopify stores**

```python
"""Seed the stores table with existing crawled Shopify stores."""
import os
import sys
import hashlib

import psycopg2
from psycopg2.extras import Json

EXISTING_STORES = [
    ("Allbirds", "https://www.allbirds.com"),
    ("tentree", "https://www.tentree.com"),
    ("Taylor Stitch", "https://www.taylorstitch.com"),
    ("Greyson", "https://www.greysonclothiers.com"),
    ("Girlfriend Collective", "https://www.girlfriend.com"),
    ("Ridge", "https://www.ridgewallet.com"),
    ("Pura Vida", "https://www.puravidabracelets.com"),
    ("Haute Hijab", "https://hautehijab.com"),
    ("Native", "https://www.nativecos.com"),
    ("Brooklinen", "https://www.brooklinen.com"),
    ("Death Wish Coffee", "https://www.deathwishcoffee.com"),
    ("ColourPop", "https://colourpop.com"),
]


def generate_store_id(url: str) -> str:
    h = hashlib.sha256(url.encode()).hexdigest()[:12]
    return f"str_{h}"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True

    for name, url in EXISTING_STORES:
        store_id = generate_store_id(url)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO stores (id, name, url, source, capabilities, product_count, status)
                VALUES (%s, %s, %s, 'scraped', %s, 0, 'active')
                ON CONFLICT (url) DO NOTHING
                """,
                (store_id, name, url, Json({})),
            )
        print(f"  Seeded: {name} ({store_id})")

    conn.close()
    print(f"\nSeeded {len(EXISTING_STORES)} stores.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add crawler/seed_stores.py
git commit -m "feat: add store seeding script for existing Shopify stores"
```
