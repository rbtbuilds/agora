import { Hono } from "hono";
import { db, stores } from "@agora/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { validateExternalUrl, safeFetch } from "../lib/url-validator.js";

// Public router — no auth required (serves the manifest for external consumers)
const adapterPublicRouter = new Hono();

import type { AppEnv } from "../types.js";

// Protected router — auth required
const adapterRouter = new Hono<AppEnv>();

function generateStoreId(url: string): string {
  return `str_${crypto.createHash("sha256").update(url).digest("hex").slice(0, 12)}`;
}

function sanitizeText(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

// POST /v1/adapter/shopify — Generate agora.json for a Shopify store
adapterRouter.post("/shopify", async (c) => {
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, 400);
  }

  if (!body.url) {
    return c.json({ error: { code: "BAD_REQUEST", message: "url is required" } }, 400);
  }

  const urlCheck = validateExternalUrl(body.url);
  if (!urlCheck.valid) {
    return c.json({ error: { code: "BAD_REQUEST", message: urlCheck.error } }, 400);
  }

  const storeUrl = body.url.replace(/\/$/, "");
  const storeId = generateStoreId(storeUrl);

  // Verify it's a Shopify store by checking /products.json
  let storeName = new URL(storeUrl).hostname;
  let storeDescription = "";

  try {
    // Try meta.json for store info
    const metaRes = await safeFetch(`${storeUrl}/meta.json`, {
      headers: { "User-Agent": "Agora Adapter/1.0" },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.name) storeName = sanitizeText(meta.name);
      if (meta.description) storeDescription = meta.description;
    }
  } catch {}

  // Verify products.json exists
  try {
    const productsRes = await safeFetch(`${storeUrl}/products.json?limit=1`, {
      headers: { "User-Agent": "Agora Adapter/1.0" },
    });
    if (!productsRes.ok) {
      return c.json({
        error: { code: "BAD_REQUEST", message: "Could not access /products.json — is this a Shopify store?" },
      }, 400);
    }
  } catch (err) {
    console.error("Adapter upstream error:", err);
    return c.json({
      error: { code: "UPSTREAM_ERROR", message: "Could not reach the store" },
    }, 502);
  }

  const apiBase = "https://agora-ecru-chi.vercel.app";

  // Generate the manifest
  const manifest = {
    $schema: "https://protocol.agora.dev/v1/schema.json",
    version: "1.0",
    store: {
      name: storeName,
      url: storeUrl,
      description: storeDescription || `${storeName} — powered by Agora Protocol`,
      currency: "USD",
      locale: "en-US",
    },
    capabilities: {
      products: `${apiBase}/v1/adapter/shopify/${storeId}/products`,
      product: `${apiBase}/v1/adapter/shopify/${storeId}/products/{id}`,
    },
    auth: { type: "none" },
    rate_limits: { requests_per_minute: 30, burst: 5 },
    data_policy: {
      cache_ttl: 1800,
      attribution_required: true,
      commercial_use: true,
    },
  };

  // Register/update the store
  const existing = await db.select().from(stores).where(eq(stores.url, storeUrl)).limit(1);

  if (existing.length === 0) {
    await db.insert(stores).values({
      id: storeId,
      name: storeName,
      url: storeUrl,
      agoraJsonUrl: `${apiBase}/v1/adapter/shopify/${storeId}/agora.json`,
      source: "native",
      capabilities: manifest.capabilities,
      status: "active",
    } as any);
  } else {
    await db.update(stores)
      .set({
        source: "native",
        agoraJsonUrl: `${apiBase}/v1/adapter/shopify/${storeId}/agora.json`,
        capabilities: manifest.capabilities,
        name: storeName,
      } as any)
      .where(eq(stores.url, storeUrl));
  }

  return c.json({
    data: {
      store_id: storeId,
      manifest,
      endpoints: {
        agora_json: `${apiBase}/v1/adapter/shopify/${storeId}/agora.json`,
        products: `${apiBase}/v1/adapter/shopify/${storeId}/products`,
        product: `${apiBase}/v1/adapter/shopify/${storeId}/products/{handle}`,
      },
    },
    meta: { message: "Shopify store adapted to Agora Protocol" },
  }, 201);
});

// GET /v1/adapter/shopify/:storeId/agora.json — Serve generated manifest (public, no auth)
adapterPublicRouter.get("/shopify/:storeId/agora.json", async (c) => {
  const storeId = c.req.param("storeId");
  const store = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);

  if (store.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Adapted store not found" } }, 404);
  }

  const s = store[0];
  const apiBase = "https://agora-ecru-chi.vercel.app";

  return c.json({
    $schema: "https://protocol.agora.dev/v1/schema.json",
    version: "1.0",
    store: {
      name: s.name,
      url: s.url,
      currency: "USD",
      locale: "en-US",
    },
    capabilities: {
      products: `${apiBase}/v1/adapter/shopify/${storeId}/products`,
      product: `${apiBase}/v1/adapter/shopify/${storeId}/products/{id}`,
    },
    auth: { type: "none" },
    rate_limits: { requests_per_minute: 30, burst: 5 },
    data_policy: { cache_ttl: 1800, attribution_required: true, commercial_use: true },
  });
});

// GET /v1/adapter/shopify/:storeId/products — Proxy Shopify products in Agora format
adapterRouter.get("/shopify/:storeId/products", async (c) => {
  const storeId = c.req.param("storeId");
  const page = parseInt(c.req.query("page") ?? "1");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 50);

  const store = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (store.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Store not found" } }, 404);
  }

  const storeUrl = store[0].url;

  try {
    const res = await safeFetch(`${storeUrl}/products.json?limit=${limit}&page=${page}`, {
      headers: { "User-Agent": "Agora Adapter/1.0" },
    });
    if (!res.ok) {
      return c.json({ error: { code: "UPSTREAM_ERROR", message: `Shopify returned ${res.status}` } }, 502);
    }

    const data = await res.json();
    const products = (data.products ?? []).map((p: any) => normalizeShopifyProduct(p, storeUrl));

    return c.json({
      data: products,
      meta: { total: products.length, page, perPage: limit },
    });
  } catch (err) {
    console.error("Adapter upstream error:", err);
    return c.json({ error: { code: "UPSTREAM_ERROR", message: "Could not reach the store" } }, 502);
  }
});

// GET /v1/adapter/shopify/:storeId/products/:handle — Single product
adapterRouter.get("/shopify/:storeId/products/:handle", async (c) => {
  const storeId = c.req.param("storeId");
  const handle = c.req.param("handle");

  // Validate handle to prevent path traversal (Shopify handle format only)
  if (!/^[a-zA-Z0-9_-]+$/.test(handle)) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid product handle" } }, 400);
  }

  const store = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (store.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Store not found" } }, 404);
  }

  const storeUrl = store[0].url;

  try {
    const res = await safeFetch(`${storeUrl}/products/${handle}.json`, {
      headers: { "User-Agent": "Agora Adapter/1.0" },
    });
    if (!res.ok) {
      return c.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
    }

    const data = await res.json();
    const product = normalizeShopifyProduct(data.product, storeUrl);

    return c.json({ data: product });
  } catch (err) {
    console.error("Adapter upstream error:", err);
    return c.json({ error: { code: "UPSTREAM_ERROR", message: "Could not reach the store" } }, 502);
  }
});

function normalizeShopifyProduct(p: any, storeUrl: string) {
  const variants = p.variants ?? [];
  const firstVariant = variants[0] ?? {};
  const price = firstVariant.price;
  const compareAt = firstVariant.compare_at_price;
  const available = variants.some((v: any) => v.available);

  return {
    id: p.handle ?? String(p.id),
    url: `${storeUrl}/products/${p.handle}`,
    name: sanitizeText(p.title ?? ""),
    description: sanitizeText((p.body_html ?? "").replace(/<[^>]+>/g, " ")).slice(0, 2000),
    brand: p.vendor ? sanitizeText(p.vendor) : null,
    pricing: price ? {
      amount: parseFloat(price).toFixed(2),
      currency: "USD",
      ...(compareAt ? { compare_at: parseFloat(compareAt).toFixed(2) } : {}),
    } : null,
    availability: {
      status: available ? "in_stock" : "out_of_stock",
    },
    images: (p.images ?? []).slice(0, 5).map((img: any) => ({
      url: img.src,
      alt: img.alt || p.title,
      role: img === p.images[0] ? "primary" : "gallery",
    })),
    categories: p.product_type ? [{ name: p.product_type, slug: p.product_type.toLowerCase().replace(/\s+/g, "-") }] : [],
    attributes: Object.fromEntries(
      (p.options ?? [])
        .filter((o: any) => o.name && o.name !== "Title")
        .map((o: any) => [o.name, o.values ?? []])
    ),
    variants: variants.slice(0, 10).map((v: any) => ({
      id: String(v.id),
      attributes: Object.fromEntries(
        [v.option1 && ["option1", v.option1], v.option2 && ["option2", v.option2], v.option3 && ["option3", v.option3]].filter(Boolean)
      ),
      pricing: v.price ? { amount: parseFloat(v.price).toFixed(2), currency: "USD" } : undefined,
      availability: { status: v.available ? "in_stock" : "out_of_stock" },
    })),
    metadata: {
      created_at: p.created_at,
      updated_at: p.updated_at,
      tags: typeof p.tags === "string" ? p.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : (p.tags ?? []),
    },
  };
}

export { adapterRouter, adapterPublicRouter };
