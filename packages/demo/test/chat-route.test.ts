import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  stream: vi.fn(),
  convert: vi.fn(),
}));

vi.mock("../app/api/chat/rate-limit", () => ({
  consumeDailyChatLimit: mocks.consume,
}));

vi.mock("ai", () => ({
  convertToModelMessages: mocks.convert,
  streamText: mocks.stream,
  stepCountIs: (count: number) => count,
  tool: (definition: unknown) => definition,
}));

import { POST } from "../app/api/chat/route";

const message = {
  id: "message-1",
  role: "user",
  parts: [{ type: "text", text: "Find me running shoes under $80" }],
};

const request = () =>
  new Request("https://demo.example/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ messages: [message] }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consume.mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: new Date("2026-10-15T00:00:00.000Z"),
  });
  mocks.convert.mockResolvedValue([{ role: "user", content: "Find me running shoes under $80" }]);
  mocks.stream.mockReturnValue({
    toUIMessageStreamResponse: () => new Response("assistant response"),
  });
});

afterEach(() => vi.unstubAllGlobals());

const product = (name: string, categories: string[]) => ({
  id: name,
  name,
  categories,
  sourceUrl: "https://store.example/product",
  images: ["https://store.example/image.jpg"],
  price: { amount: "79.00", currency: "USD" },
  availability: "in_stock",
  seller: { name: "Demo Store" },
});

const searchResponse = (items: ReturnType<typeof product>[]) =>
  new Response(JSON.stringify({ data: items, meta: { total: items.length } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("chat route", () => {
  it("uses the free gateway model after consuming one daily message", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.consume).toHaveBeenCalledOnce();
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "nvidia/nemotron-3.5-lightning-free",
        stopWhen: 1,
      })
    );
  });

  it("returns 429 without calling the model after five messages", async () => {
    mocks.consume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-10-15T00:00:00.000Z"),
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.text()).toContain("Daily limit reached");
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("returns 503 without calling the model when the quota store fails", async () => {
    mocks.consume.mockRejectedValue(new Error("Redis unavailable"));

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("retries a broad product noun when a specific search has no matches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([]))
      .mockResolvedValueOnce(searchResponse([product("Smallbirds Wool Loungers", ["Shoes"])]));
    vi.stubGlobal("fetch", fetchMock);
    await POST(request());
    const searchTool = mocks.stream.mock.calls[0][0].tools.searchProducts;

    const result = await searchTool.execute({ query: "kids wool loungers", maxPrice: 80 });

    expect(result.products.map((item: { name: string }) => item.name)).toEqual([
      "Smallbirds Wool Loungers",
    ]);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("q")).toBe("loungers");
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("maxPrice")).toBe("80");
  });

  it("excludes products that only mention shoes in descriptions", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([product("Sport Tote", ["Bags"])]))
      .mockResolvedValueOnce(searchResponse([product("Goody Two-Shoes", ["Makeup"])]));
    vi.stubGlobal("fetch", fetchMock);
    await POST(request());
    const searchTool = mocks.stream.mock.calls[0][0].tools.searchProducts;

    const result = await searchTool.execute({ query: "running shoes", maxPrice: 80 });

    expect(result.products).toEqual([]);
  });

  it("enforces a price ceiling even when catalog search ignores it", async () => {
    const overBudget = product("Wool Loungers Premium", ["Shoes"]);
    overBudget.price.amount = "120.00";
    const inBudget = product("Wool Loungers", ["Shoes"]);
    const fetchMock = vi.fn().mockResolvedValue(searchResponse([overBudget, inBudget]));
    vi.stubGlobal("fetch", fetchMock);
    await POST(request());
    const searchTool = mocks.stream.mock.calls[0][0].tools.searchProducts;

    const result = await searchTool.execute({ query: "kids warm wool loungers", maxPrice: 80 });

    expect(result.products.map((item: { name: string }) => item.name)).toEqual(["Wool Loungers"]);
    expect(result.products[0]).not.toHaveProperty("availability");
  });
});
