import { db, products } from "@agora/db";
import { sql, eq, and, gte, lte, ilike, or, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SearchQuery } from "../types.js";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export async function searchProducts(query: SearchQuery) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(query.perPage ?? String(DEFAULT_PER_PAGE), 10))
  );
  const offset = (page - 1) * perPage;
  const terms = query.q.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (terms.length === 0) {
    return { results: [], total: 0, page, perPage };
  }

  const conditions: SQL[] = [];

  if (query.source) {
    conditions.push(eq(products.source, query.source));
  }
  if (query.availability) {
    conditions.push(eq(products.availability, query.availability as any));
  }
  if (query.minPrice) {
    conditions.push(gte(products.priceAmount, query.minPrice));
  }
  if (query.maxPrice) {
    conditions.push(lte(products.priceAmount, query.maxPrice));
  }

  return keywordSearch(terms, conditions, perPage, offset, page);
}

async function keywordSearch(
  terms: string[],
  conditions: SQL[],
  perPage: number,
  offset: number,
  page: number
) {
  const searchCondition = and(
    ...terms.map((term) =>
      or(
        ilike(products.name, `%${term}%`),
        ilike(products.description, `%${term}%`)
      )
    )
  );

  const where =
    conditions.length > 0
      ? and(searchCondition, ...conditions)
      : searchCondition;

  const relevance = sql<number>`(${sql.join(
    terms.map((term) => sql`
      CASE WHEN ${products.name} ILIKE ${`%${term}%`} THEN 2 ELSE 0 END +
      CASE WHEN ${products.description} ILIKE ${`%${term}%`} THEN 1 ELSE 0 END
    `),
    sql` + `
  )})`;

  const results = await db
    .select()
    .from(products)
    .where(where!)
    .orderBy(sql`${relevance} DESC`, desc(products.lastCrawled))
    .limit(perPage)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(where!);

  return {
    results,
    total: Number(countResult[0].count),
    page,
    perPage,
  };
}
