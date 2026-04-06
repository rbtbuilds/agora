import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Agora } from "../src/index.js";

const mockFetch = vi.fn();

describe("Agora SDK", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends API key in Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], meta: { total: 0, page: 1, perPage: 20 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const agora = new Agora({ apiKey: "ak_test_123" });
    await agora.search("boots");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer ak_test_123");
  });

  it("search constructs correct URL with query params", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], meta: { total: 0, page: 1, perPage: 20 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const agora = new Agora({
      apiKey: "ak_test_123",
      baseUrl: "https://api.agora.dev",
    });
    await agora.search("hiking boots", { minPrice: 50, maxPrice: 200 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/v1/products/search");
    expect(url).toContain("q=hiking+boots");
    expect(url).toContain("minPrice=50");
    expect(url).toContain("maxPrice=200");
  });

  it("product fetches by ID", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { id: "agr_123", name: "Test Product" },
          meta: { freshness: "1h ago", source: "amazon", confidence: 0.9 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const agora = new Agora({ apiKey: "ak_test_123" });
    const result = await agora.product("agr_123");

    expect(result.data.id).toBe("agr_123");
    expect(result.meta.confidence).toBe(0.9);
  });

  it("throws on API error responses", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    );

    const agora = new Agora({ apiKey: "ak_test_123" });
    await expect(agora.product("agr_nonexistent")).rejects.toThrow("Not found");
  });

  it("caches repeated requests", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "agr_123", name: "Test" },
          meta: { freshness: "1h ago", source: "amazon", confidence: 0.9 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const agora = new Agora({ apiKey: "ak_test_123", cacheTtl: 60000 });
    await agora.product("agr_123");
    await agora.product("agr_123");

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
