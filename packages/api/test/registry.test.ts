import { describe, it, expect, vi } from "vitest";

// Mock @agora/db before importing anything that depends on it
vi.mock("@agora/db", () => {
  // Registry routes are public — no auth middleware runs, so all selects return empty.
  const emptyChain = () => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        groupBy: vi.fn().mockResolvedValue([]),
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    }),
  });

  const smartSelect = vi.fn().mockImplementation(() => emptyChain());

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });

  return {
    db: {
      select: smartSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
    products: {},
    productEmbeddings: {},
    categories: {},
    apiKeys: {},
    usageLogs: {},
    stores: {},
    storeAnalytics: {},
  };
});

import app from "../src/index.js";

describe("registry endpoints (public)", () => {
  it("GET /v1/registry returns 200 without auth", async () => {
    const res = await app.request("/v1/registry");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe("number");
  });

  it("GET /v1/registry/stats returns 200 with expected shape", async () => {
    const res = await app.request("/v1/registry/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(typeof body.data.total_stores).toBe("number");
    expect(typeof body.data.native_stores).toBe("number");
    expect(typeof body.data.scraped_stores).toBe("number");
    expect(typeof body.data.total_products).toBe("number");
    expect(typeof body.data.total_queries).toBe("number");
    expect(typeof body.data.queries_this_week).toBe("number");
  });

  it("GET /v1/registry/:id returns 404 for non-existent store", async () => {
    const res = await app.request("/v1/registry/str_doesnotexist");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
