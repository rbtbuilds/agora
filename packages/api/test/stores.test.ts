import { describe, it, expect, vi } from "vitest";

// Mock @agora/db before importing anything that depends on it
vi.mock("@agora/db", () => {
  const mockKey = [{ key: "ak_test_key_12345678", tier: "free", revokedAt: null }];

  // Smart select that handles:
  // 1. Auth middleware: db.select().from(apiKeys).where(...).limit(1) -> mockKey
  // 2. Auth middleware: db.select({ count: ... }).from(usageLogs).where(...) -> [{ count: 0 }]
  // 3. Store routes: db.select().from(stores).where(...).limit(1) -> []
  // 4. Store routes: db.select().from(stores).orderBy(...).limit(...) -> []
  // 5. Store routes: db.select({ count: ... }).from(stores) -> [{ count: 0 }]
  const smartSelect = vi.fn().mockImplementation((arg?: unknown) => {
    if (arg && typeof arg === "object") {
      // Count query: db.select({ count: sql`count(*)` })
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    }
    // Plain select: db.select()
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(mockKey)),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
  });

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
  };
});

import app from "../src/index.js";

const AUTH_HEADER = { Authorization: "Bearer ak_test_key_12345678" };

describe("store endpoints", () => {
  it("POST /v1/stores/register returns 400 without url body", async () => {
    const res = await app.request("/v1/stores/register", {
      method: "POST",
      headers: {
        ...AUTH_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("GET /v1/stores returns 200 with data array", async () => {
    const res = await app.request("/v1/stores", {
      headers: AUTH_HEADER,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /v1/stores returns 401 without auth", async () => {
    const res = await app.request("/v1/stores");
    expect(res.status).toBe(401);
  });
});
