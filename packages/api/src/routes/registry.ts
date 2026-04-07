import { Hono } from "hono";
import { db, stores, storeAnalytics, products } from "@agora/db";
import { eq, desc, sql, ilike, gte, and, SQL } from "drizzle-orm";

const registryRouter = new Hono();

// GET /v1/registry — Enhanced store listing with search, filter, sort, analytics
registryRouter.get("/", async (c) => {
  const q = c.req.query("q");
  const source = c.req.query("source");
  const sort = c.req.query("sort") ?? "newest";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);

  // Build where conditions
  const conditions: SQL[] = [];

  if (source === "native" || source === "scraped") {
    conditions.push(eq(stores.source, source));
  }
  if (q) {
    conditions.push(ilike(stores.name, `%${q}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build base query with ordering
  let storeQuery = db.select().from(stores);
  if (whereClause) {
    storeQuery = storeQuery.where(whereClause) as typeof storeQuery;
  }

  if (sort === "products") {
    storeQuery = storeQuery.orderBy(desc(stores.productCount)) as typeof storeQuery;
  } else if (sort === "score") {
    storeQuery = storeQuery.orderBy(desc(stores.validationScore)) as typeof storeQuery;
  } else {
    storeQuery = storeQuery.orderBy(desc(stores.createdAt)) as typeof storeQuery;
  }

  const storeResults = await storeQuery.limit(limit);

  // Get total count
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(stores);
  if (whereClause) {
    countQuery = countQuery.where(whereClause) as typeof countQuery;
  }
  const totalResult = await countQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Get analytics for all fetched stores
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const analyticsAll = await db
    .select({
      storeId: storeAnalytics.storeId,
      totalQueries: sql<number>`sum(${storeAnalytics.queryCount})`,
      queriesThisWeek: sql<number>`sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.queryCount} else 0 end)`,
      productViewsThisWeek: sql<number>`sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.productViews} else 0 end)`,
    })
    .from(storeAnalytics)
    .groupBy(storeAnalytics.storeId);

  const analyticsMap = new Map(analyticsAll.map((a) => [a.storeId, a]));

  const data = storeResults.map((store) => {
    const analytics = analyticsMap.get(store.id);
    return {
      ...store,
      analytics: {
        queries_this_week: Number(analytics?.queriesThisWeek ?? 0),
        total_queries: Number(analytics?.totalQueries ?? 0),
        product_views_this_week: Number(analytics?.productViewsThisWeek ?? 0),
      },
    };
  });

  return c.json({ data, meta: { total } });
});

// GET /v1/registry/stats — Network-level statistics
registryRouter.get("/stats", async (c) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [storeStats, productStats, queryStats] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        native: sql<number>`sum(case when ${stores.source} = 'native' then 1 else 0 end)`,
        scraped: sql<number>`sum(case when ${stores.source} = 'scraped' then 1 else 0 end)`,
      })
      .from(stores),
    db.select({ total: sql<number>`count(*)` }).from(products),
    db
      .select({
        totalQueries: sql<number>`sum(${storeAnalytics.queryCount})`,
        queriesThisWeek: sql<number>`sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.queryCount} else 0 end)`,
      })
      .from(storeAnalytics),
  ]);

  return c.json({
    data: {
      total_stores: Number(storeStats[0]?.total ?? 0),
      native_stores: Number(storeStats[0]?.native ?? 0),
      scraped_stores: Number(storeStats[0]?.scraped ?? 0),
      total_products: Number(productStats[0]?.total ?? 0),
      total_queries: Number(queryStats[0]?.totalQueries ?? 0),
      queries_this_week: Number(queryStats[0]?.queriesThisWeek ?? 0),
    },
  });
});

// GET /v1/registry/:id — Single store with analytics
registryRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db.select().from(stores).where(eq(stores.id, id)).limit(1);

  if (result.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Store ${id} not found` } },
      404
    );
  }

  const store = result[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const analyticsResult = await db
    .select({
      totalQueries: sql<number>`sum(${storeAnalytics.queryCount})`,
      queriesThisWeek: sql<number>`sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.queryCount} else 0 end)`,
      productViewsThisWeek: sql<number>`sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.productViews} else 0 end)`,
    })
    .from(storeAnalytics)
    .where(eq(storeAnalytics.storeId, id));

  const analytics = analyticsResult[0];

  return c.json({
    data: {
      ...store,
      analytics: {
        queries_this_week: Number(analytics?.queriesThisWeek ?? 0),
        total_queries: Number(analytics?.totalQueries ?? 0),
        product_views_this_week: Number(analytics?.productViewsThisWeek ?? 0),
      },
    },
  });
});

// GET /v1/registry/:id/analytics — Weekly analytics for a store
registryRouter.get("/:id/analytics", async (c) => {
  const id = c.req.param("id");

  // Verify store exists
  const storeResult = await db.select().from(stores).where(eq(stores.id, id)).limit(1);

  if (storeResult.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: `Store ${id} not found` } },
      404
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const daily = await db
    .select({
      date: storeAnalytics.date,
      queries: storeAnalytics.queryCount,
      productViews: storeAnalytics.productViews,
    })
    .from(storeAnalytics)
    .where(
      and(
        eq(storeAnalytics.storeId, id),
        gte(storeAnalytics.date, sevenDaysAgo)
      )
    )
    .orderBy(desc(storeAnalytics.date));

  const totals = daily.reduce(
    (acc, row) => ({
      queries: acc.queries + (row.queries ?? 0),
      product_views: acc.product_views + (row.productViews ?? 0),
    }),
    { queries: 0, product_views: 0 }
  );

  return c.json({
    data: {
      store_id: id,
      period: "7d",
      daily: daily.map((row) => ({
        date: row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : String(row.date),
        queries: row.queries ?? 0,
        product_views: row.productViews ?? 0,
      })),
      totals,
    },
  });
});

export { registryRouter };
