import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted; declare shared mocks via vi.hoisted so
// they're available when the factory runs.
const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));

vi.mock("../src/lib/url-validator.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/url-validator.js")>(
    "../src/lib/url-validator.js",
  );
  return {
    ...actual,
    safeFetch: safeFetchMock,
  };
});

vi.mock("@agora/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  stores: {},
}));

import { adapterRouter, adapterPublicRouter } from "../src/routes/adapter.js";
import { Hono } from "hono";

// Wire adapterRouter behind a stubbed-out auth-equivalent so c.get("userId")
// returns something. The route only reads the body and the URL — userId is
// not used for the mutation path we're testing here, but the AppEnv typing
// requires it.
function authedAdapter() {
  const app = new Hono();
  app.use("/v1/adapter/*", async (c, next) => {
    c.set("userId" as never, "user_test_123" as never);
    await next();
  });
  app.route("/v1/adapter", adapterRouter);
  return app;
}

function publicAdapter() {
  const app = new Hono();
  app.route("/v1/adapter", adapterPublicRouter);
  return app;
}

beforeEach(() => {
  safeFetchMock.mockReset();
});

describe("POST /v1/adapter/shopify — SSRF guard + URL validation", () => {
  it("rejects http:// URLs", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://example.com" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/HTTPS/i);
  });

  it("rejects private IPs", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://192.168.1.1" }),
    });
    expect(res.status).toBe(400);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("rejects metadata service IP", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://169.254.169.254" }),
    });
    expect(res.status).toBe(400);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("rejects octal-encoded localhost", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://0177.0.0.1/" }),
    });
    expect(res.status).toBe(400);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is missing url", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when JSON body is malformed", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/adapter/shopify/:storeId/products/:handle — path-traversal guard", () => {
  it("rejects path-traversal attempts in the handle", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify/str_abc/products/..%2F..%2Fetc%2Fpasswd");
    expect(res.status).toBe(400);
  });

  it("rejects handles with slashes", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify/str_abc/products/foo%2Fbar");
    expect(res.status).toBe(400);
  });

  it("rejects handles with shell metacharacters", async () => {
    const app = authedAdapter();
    const res = await app.request("/v1/adapter/shopify/str_abc/products/x;rm -rf");
    expect(res.status).toBe(400);
  });
});

describe("public adapter router", () => {
  it("GET /v1/adapter/shopify/:storeId/agora.json returns 404 when store missing (no auth required)", async () => {
    const app = publicAdapter();
    const res = await app.request("/v1/adapter/shopify/str_doesnotexist/agora.json");
    // No 401 — the public router has no auth middleware mounted.
    expect(res.status).toBe(404);
  });
});
