import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted, so any state they close over must be declared
// via vi.hoisted to also be hoisted.
const state = vi.hoisted(() => ({
  carts: [] as Array<{ id: string; consumerId: string; ownerId: string; status: string }>,
  checkouts: [] as Array<{ id: string; ownerId: string; status: string; approvalToken: string; expiresAt: Date }>,
}));

vi.mock("@agora/db", () => {
  function selectChain(tableName: string) {
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rowsFor(tableName)),
          orderBy: () => Promise.resolve(rowsFor(tableName)),
        }),
        innerJoin: () => ({
          leftJoin: () => ({ where: () => Promise.resolve([]) }),
          where: () => Promise.resolve([]),
        }),
        leftJoin: () => ({
          innerJoin: () => ({ where: () => Promise.resolve([]) }),
          where: () => Promise.resolve([]),
        }),
      }),
    };
  }

  function rowsFor(name: string): unknown[] {
    if (name === "carts") return state.carts;
    if (name === "checkouts") return state.checkouts;
    return [];
  }

  return {
    db: {
      select: vi.fn(() => selectChain("carts")), // overridden per-test as needed via mockImplementation
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    },
    carts: {},
    cartItems: {},
    checkouts: {},
    orders: {},
    products: {},
    stores: {},
    consumers: {},
    paymentMethods: {},
  };
});

vi.mock("../src/lib/webhook-dispatcher.js", () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
}));

import { commerceRouter } from "../src/routes/commerce.js";
import { Hono } from "hono";

function appAs(userId: string) {
  const app = new Hono();
  app.use("/v1/*", async (c, next) => {
    c.set("userId" as never, userId as never);
    await next();
  });
  app.route("/v1", commerceRouter);
  return app;
}

beforeEach(() => {
  state.carts = [];
  state.checkouts = [];
});

describe("commerce — input validation & shape", () => {
  it("POST /v1/cart returns 400 when consumerId missing", async () => {
    const res = await appAs("user_a").request("/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("POST /v1/cart returns 400 on malformed JSON", async () => {
    const res = await appAs("user_a").request("/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it("POST /v1/checkout returns 400 when cartId or consumerId missing", async () => {
    const res = await appAs("user_a").request("/v1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId: "cart_a" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /v1/checkout/:id/approve returns 400 when approvalToken missing", async () => {
    const res = await appAs("user_a").request("/v1/checkout/co_123/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /v1/checkout/:id/approve returns 400 on malformed JSON", async () => {
    const res = await appAs("user_a").request("/v1/checkout/co_123/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it("/v1/orders requires consumerId query param", async () => {
    const res = await appAs("user_a").request("/v1/orders");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

describe("commerce — multi-tenant ownership", () => {
  it("POST /v1/cart/:id/items rejects non-owner with 404", async () => {
    state.carts = [
      { id: "cart_a", consumerId: "cons_a", ownerId: "user_a", status: "open" },
    ];
    const res = await appAs("user_b").request("/v1/cart/cart_a/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "agr_xyz" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("DELETE /v1/cart/:id/items/:itemId rejects non-owner with 404", async () => {
    state.carts = [
      { id: "cart_a", consumerId: "cons_a", ownerId: "user_a", status: "open" },
    ];
    const res = await appAs("user_b").request("/v1/cart/cart_a/items/1", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("POST /v1/cart/:id/items rejects when cart status is not open", async () => {
    state.carts = [
      { id: "cart_a", consumerId: "cons_a", ownerId: "user_a", status: "checked_out" },
    ];
    const res = await appAs("user_a").request("/v1/cart/cart_a/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "agr_xyz" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });
});
