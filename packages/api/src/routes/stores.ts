import { Hono } from "hono";
import { db, stores, webhooks } from "@agora/db";
import { eq, desc, sql, and } from "drizzle-orm";
import crypto from "node:crypto";
import { validateExternalUrl, safeFetch } from "../lib/url-validator.js";
import type { AppEnv } from "../types.js";

const storesRouter = new Hono<AppEnv>();

function generateStoreId(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
  return `str_${hash}`;
}

// POST /v1/stores/register
storesRouter.post("/register", async (c) => {
  const ownerId = c.get("userId") as string;
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

  const urlCheck = validateExternalUrl(body.url);
  if (!urlCheck.valid) {
    return c.json({ error: { code: "BAD_REQUEST", message: urlCheck.error } }, 400);
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
    const res = await safeFetch(manifestUrl);
    if (res.ok) {
      const manifest = await res.json();
      if (manifest?.version === "1.0" && manifest?.store?.name) {
        source = "native";
        storeName = (manifest.store.name as string).replace(/<[^>]+>/g, "").trim();
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
    ownerId,
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

// POST /v1/stores/:storeId/webhooks
storesRouter.post("/:storeId/webhooks", async (c) => {
  const ownerId = c.get("userId") as string;
  const storeId = c.req.param("storeId");

  // Ownership check: if the store has an owner, only that owner can add webhooks
  const storeResult = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (storeResult.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Store ${storeId} not found` } }, 404);
  }
  const store = storeResult[0];
  if (store.ownerId !== null && store.ownerId !== ownerId) {
    return c.json({ error: { code: "FORBIDDEN", message: "You do not own this store" } }, 403);
  }

  let body: { url?: string; events?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, 400);
  }

  if (!body.url || !body.events?.length) {
    return c.json({ error: { code: "BAD_REQUEST", message: "url and events are required" } }, 400);
  }

  const webhookUrlCheck = validateExternalUrl(body.url);
  if (!webhookUrlCheck.valid) {
    return c.json({ error: { code: "BAD_REQUEST", message: webhookUrlCheck.error } }, 400);
  }

  const validEvents = ["product.searched", "product.viewed", "store.registered", "order.created", "checkout.approved", "checkout.denied"];
  const invalidEvents = body.events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return c.json({ error: { code: "BAD_REQUEST", message: `Invalid events: ${invalidEvents.join(", ")}` } }, 400);
  }

  const id = `wh_${crypto.randomBytes(12).toString("hex")}`;
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

  await db.insert(webhooks).values({
    id,
    storeId,
    url: body.url,
    events: body.events,
    secret,
    ownerId,
  });

  return c.json({
    data: { id, storeId, url: body.url, events: body.events, secret, active: 1, ownerId },
    meta: { message: "Save the secret — it won't be shown again" },
  }, 201);
});

// GET /v1/stores/:storeId/webhooks
storesRouter.get("/:storeId/webhooks", async (c) => {
  const ownerId = c.get("userId") as string;
  const storeId = c.req.param("storeId");
  const hooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.storeId, storeId), eq(webhooks.ownerId, ownerId)));
  return c.json({
    data: hooks.map((h) => ({ ...h, secret: "whsec_****" })),
  });
});

// DELETE /v1/stores/:storeId/webhooks/:id
storesRouter.delete("/:storeId/webhooks/:webhookId", async (c) => {
  const ownerId = c.get("userId") as string;
  const storeId = c.req.param("storeId");
  const webhookId = c.req.param("webhookId");

  const existing = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.storeId, storeId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Webhook ${webhookId} not found` } }, 404);
  }
  if (existing[0].ownerId !== ownerId) {
    return c.json({ error: { code: "FORBIDDEN", message: "You do not own this webhook" } }, 403);
  }

  await db.delete(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.storeId, storeId)));
  return c.json({ data: { deleted: true } });
});

export { storesRouter };
