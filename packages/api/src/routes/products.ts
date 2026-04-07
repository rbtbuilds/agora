import { Hono } from "hono";
import { db, products, productEmbeddings } from "@agora/db";
import { eq, ne, sql, and } from "drizzle-orm";
import { searchProducts } from "../lib/search.js";
import { computeConfidence, computeFreshness } from "../lib/confidence.js";
import type { SearchQuery, ProductResponse } from "../types.js";

const productsRouter = new Hono();

function formatProduct(row: typeof products.$inferSelect): ProductResponse {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    source: row.source,
    name: row.name,
    description: row.description,
    price: row.priceAmount
      ? { amount: row.priceAmount, currency: row.priceCurrency ?? "USD" }
      : null,
    images: (row.images as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    attributes: (row.attributes as Record<string, string>) ?? {},
    availability: row.availability ?? "unknown",
    seller: {
      name: row.sellerName,
      url: row.sellerUrl,
      rating: row.sellerRating,
    },
    lastCrawled: row.lastCrawled.toISOString(),
  };
}

// GET /v1/products/search
productsRouter.get("/search", async (c) => {
  const query: SearchQuery = {
    q: c.req.query("q") ?? "",
    source: c.req.query("source"),
    minPrice: c.req.query("minPrice"),
    maxPrice: c.req.query("maxPrice"),
    availability: c.req.query("availability"),
    category: c.req.query("category"),
    page: c.req.query("page"),
    perPage: c.req.query("perPage"),
  };

  if (!query.q) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Query parameter 'q' is required" } },
      400
    );
  }

  const { results, total, page, perPage } = await searchProducts(query);

  return c.json({
    data: results.map(formatProduct),
    meta: { total, page, perPage },
  });
});

// GET /v1/products/:id
productsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Product ${id} not found` } },
      404
    );
  }

  const product = result[0];
  return c.json({
    data: formatProduct(product),
    meta: {
      freshness: computeFreshness(product.lastCrawled),
      source: product.source,
      confidence: computeConfidence(product.lastCrawled),
    },
  });
});

// GET /v1/products/:id/similar
productsRouter.get("/:id/similar", async (c) => {
  const id = c.req.param("id");

  const embeddingResult = await db
    .select()
    .from(productEmbeddings)
    .where(eq(productEmbeddings.productId, id))
    .limit(1);

  if (embeddingResult.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Product ${id} not found or has no embedding` } },
      404
    );
  }

  const embedding = embeddingResult[0].embedding;

  const similar = await db
    .select({ product: products })
    .from(products)
    .innerJoin(productEmbeddings, eq(products.id, productEmbeddings.productId))
    .where(sql`${products.id} != ${id}`)
    .orderBy(sql`${productEmbeddings.embedding} <=> ${JSON.stringify(embedding)}::vector`)
    .limit(10);

  return c.json({
    data: similar.map((r) => formatProduct(r.product)),
    meta: { total: similar.length, page: 1, perPage: 10 },
  });
});

// GET /v1/products/:id/compare — Cross-store product matching
productsRouter.get("/:id/compare", async (c) => {
  const id = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 20);

  // Get the source product
  const sourceResult = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (sourceResult.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Product ${id} not found` } },
      404
    );
  }

  const source = sourceResult[0];

  // Extract meaningful words from product name (3+ chars, no common words)
  const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "its", "our", "your", "all", "has", "was", "are", "been", "will", "can", "may"]);
  const nameWords = source.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (nameWords.length === 0) {
    return c.json({ data: [], meta: { source_id: id, matches: 0 } });
  }

  // Build a search query: find products from OTHER stores matching key words
  // Use ILIKE for each word, count matches
  const wordConditions = nameWords.slice(0, 5).map(
    (word) => sql`CASE WHEN lower(${products.name}) LIKE ${"%" + word + "%"} THEN 1 ELSE 0 END`
  );

  const matchScore = sql<number>`(${sql.join(wordConditions, sql` + `)})`;

  const matches = await db
    .select({
      product: products,
      score: matchScore,
    })
    .from(products)
    .where(
      and(
        ne(products.id, id),
        ne(products.sellerUrl, source.sellerUrl ?? ""),
        sql`(${matchScore}) >= 2`
      )
    )
    .orderBy(sql`(${matchScore}) DESC`)
    .limit(limit);

  // Format results with confidence score
  const sourcePrice = source.priceAmount ? parseFloat(source.priceAmount) : null;

  const data = matches.map((m) => {
    const maxScore = nameWords.slice(0, 5).length;
    const nameConfidence = m.score / maxScore;

    let priceConfidence = 0;
    if (sourcePrice && m.product.priceAmount) {
      const matchPrice = parseFloat(m.product.priceAmount);
      const priceDiff = Math.abs(sourcePrice - matchPrice) / sourcePrice;
      priceConfidence = priceDiff <= 0.2 ? 1 - priceDiff : 0;
    }

    const confidence = Math.round((nameConfidence * 0.7 + priceConfidence * 0.3) * 100) / 100;

    return {
      product: {
        id: m.product.id,
        sourceUrl: m.product.sourceUrl,
        source: m.product.source,
        name: m.product.name,
        price: m.product.priceAmount
          ? { amount: m.product.priceAmount, currency: m.product.priceCurrency ?? "USD" }
          : null,
        images: (m.product.images as string[]) ?? [],
        availability: m.product.availability ?? "unknown",
        seller: {
          name: m.product.sellerName,
          url: m.product.sellerUrl,
        },
      },
      confidence,
      match_reasons: [
        `${m.score}/${maxScore} name words match`,
        ...(priceConfidence > 0 ? [`price within ${Math.round((1 - priceConfidence) * 100)}%`] : []),
      ],
    };
  });

  // Sort by confidence descending
  data.sort((a, b) => b.confidence - a.confidence);

  return c.json({
    data,
    meta: {
      source_id: id,
      source_name: source.name,
      source_price: source.priceAmount,
      source_store: source.sellerUrl,
      matches: data.length,
    },
  });
});

export { productsRouter };
