import { describe, it, expect, vi } from "vitest";

// Mock @agora/db before importing anything that depends on it
vi.mock("@agora/db", () => {
  const mockKey = [{ key: "ak_test_smoke_12345678", tier: "free", revokedAt: null }];

  const smartSelect = vi.fn().mockImplementation((arg?: unknown) => {
    if (arg && typeof arg === "object") {
      // Count query for usage logs
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };
    }
    // Key lookup query
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockKey),
        }),
      }),
    };
  });

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      then: vi.fn().mockReturnValue({ catch: vi.fn() }),
    }),
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
  };
});

import app from "../src/index.js";

const AUTH = { Authorization: "Bearer ak_test_smoke_12345678" };

describe("e2e smoke tests", () => {
  it("health check works without auth", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("protected routes require auth", async () => {
    const res = await app.request("/v1/products/search?q=test");
    expect(res.status).toBe(401);
  });

  it("search requires q parameter", async () => {
    const res = await app.request("/v1/products/search", { headers: AUTH });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("CORS headers are present for allowed origins", async () => {
    const res = await app.request("/health", {
      headers: { Origin: "https://agora-portal.vercel.app" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://agora-portal.vercel.app");
  });

  it("CORS rejects unknown origins", async () => {
    const res = await app.request("/health", {
      headers: { Origin: "https://example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
