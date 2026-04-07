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
        let score = 50;
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
