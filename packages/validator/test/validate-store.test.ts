import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateStore } from "../src/validate-store.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_MANIFEST = {
  version: "1.0",
  store: { name: "Test Store", url: "https://test.example.com" },
  capabilities: {
    products: "/api/agora/products",
    product: "/api/agora/products/{id}",
  },
};

const VALID_PRODUCT = {
  id: "prod-001",
  url: "https://test.example.com/products/test",
  name: "Test Product",
  pricing: { amount: "29.99", currency: "USD" },
  availability: { status: "in_stock" },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("validateStore", () => {
  it("validates a store with valid manifest and products", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(VALID_MANIFEST) });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [VALID_PRODUCT], meta: { total: 1 } }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const result = await validateStore("https://test.example.com");
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.manifest).not.toBeNull();
  });

  it("fails when agora.json is not found", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await validateStore("https://missing.example.com");
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.name === "discovery" && c.status === "fail")).toBe(true);
  });

  it("fails when agora.json is invalid JSON", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({ ok: true, json: () => Promise.reject(new Error("invalid json")) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const result = await validateStore("https://badjson.example.com");
    expect(result.valid).toBe(false);
  });

  it("warns when products endpoint returns no data", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(VALID_MANIFEST) });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], meta: { total: 0 } }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const result = await validateStore("https://empty.example.com");
    expect(result.valid).toBe(true);
    expect(result.checks.some((c) => c.status === "warn")).toBe(true);
    expect(result.productsSampled).toBe(0);
  });

  it("reports product validation errors", async () => {
    const badProduct = { name: "No ID Product" };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(VALID_MANIFEST) });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [badProduct], meta: { total: 1 } }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const result = await validateStore("https://badproducts.example.com");
    expect(result.productErrors).toBe(1);
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const result = await validateStore("https://down.example.com");
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.name === "discovery" && c.status === "fail")).toBe(true);
  });
});
