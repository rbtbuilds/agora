import { beforeEach, describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({ where: [] as unknown[], orderBy: [] as unknown[] }));

vi.mock("@agora/db", async () => {
  const schema = await import("../../db/src/schema.js");
  return {
    ...schema,
    db: {
      select: (selection?: unknown) => ({
        from: () => ({
          where: (condition: unknown) => {
            captured.where.push(condition);
            if (selection) return Promise.resolve([{ count: 0 }]);
            return {
              orderBy: (...order: unknown[]) => {
                captured.orderBy.push(...order);
                return { limit: () => ({ offset: () => Promise.resolve([]) }) };
              },
            };
          },
        }),
      }),
    },
  };
});

import { searchProducts } from "../src/lib/search.js";

describe("product search query", () => {
  beforeEach(() => {
    captured.where.length = 0;
    captured.orderBy.length = 0;
  });

  it("matches all words in a multiword query regardless of title order", async () => {
    await searchProducts({ q: "kids wool loungers" });

    const { sql, params } = new PgDialect().sqlToQuery(captured.where[0] as SQL);
    expect(sql).toMatch(/\band\b/i);
    expect(params).toEqual(expect.arrayContaining(["%kids%", "%wool%", "%loungers%"]));
    expect(params).not.toContain("%kids wool loungers%");
  });

  it("searches longer keyword queries without an embedding request", async () => {
    await searchProducts({ q: "smallbirds wool loungers big kids" });

    const { params } = new PgDialect().sqlToQuery(captured.where[0] as SQL);
    expect(params).toEqual(expect.arrayContaining([
      "%smallbirds%", "%wool%", "%loungers%", "%big%", "%kids%",
    ]));
  });

  it("ranks matches on individual title words", async () => {
    await searchProducts({ q: "kids wool loungers" });

    const { params } = new PgDialect().sqlToQuery(captured.orderBy[0] as SQL);
    expect(params).toEqual(expect.arrayContaining(["%kids%", "%wool%", "%loungers%"]));
    expect(params).not.toContain("%kids wool loungers%");
  });

  it("ignores punctuation when matching product words", async () => {
    await searchProducts({ q: "kids' wool loungers" });

    const { params } = new PgDialect().sqlToQuery(captured.where[0] as SQL);
    expect(params).toEqual(expect.arrayContaining(["%kids%", "%wool%", "%loungers%"]));
    expect(params).not.toContain("%kids'%");
  });

  it("returns an empty page when the query has no searchable words", async () => {
    const result = await searchProducts({ q: "!!!" });

    expect(result).toEqual({ results: [], total: 0, page: 1, perPage: 20 });
    expect(captured.where).toHaveLength(0);
  });
});
