import { describe, it, expect, vi, beforeEach } from "vitest";

// Atomicity contract for POST /checkout/:id/approve:
//   - the status updates + per-store order inserts run inside ONE db
//     transaction, so a failure mid-flow rolls everything back (no completed
//     checkout left with zero orders);
//   - webhooks are dispatched only AFTER the transaction commits, so a
//     rolled-back approval never emits a phantom order.created webhook.
//
// The mock only exposes db.select() (the pre-flight checkout lookup) and
// db.transaction(). It deliberately does NOT expose db.update()/db.insert():
// any write performed outside the transaction would throw, which is how we
// prove every write goes through the tx handle.

const state = vi.hoisted(() => ({
  checkout: null as any,
  items: [] as any[],
  failOrderInsert: false,
  txEntered: false,
  ordersInserted: [] as any[],
}));

vi.mock("@agora/db", () => {
  function dbSelectCheckout() {
    return {
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(state.checkout ? [state.checkout] : []),
        }),
      }),
    };
  }

  function makeTx() {
    return {
      update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
      select: () => ({
        from: () => ({
          leftJoin: () => ({ where: () => Promise.resolve(state.items) }),
        }),
      }),
      insert: () => ({
        values: (vals: any) => {
          if (state.failOrderInsert) {
            return Promise.reject(new Error("simulated order insert failure"));
          }
          state.ordersInserted.push(vals);
          return Promise.resolve(undefined);
        },
      }),
    };
  }

  return {
    db: {
      select: vi.fn(dbSelectCheckout),
      transaction: vi.fn(async (cb: any) => {
        state.txEntered = true;
        return cb(makeTx());
      }),
    },
    carts: {}, cartItems: {}, checkouts: {}, orders: {}, products: {}, stores: {},
    consumers: {}, paymentMethods: {},
  };
});

const dispatchWebhooks = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/lib/webhook-dispatcher.js", () => ({
  dispatchWebhooks: (...args: unknown[]) => dispatchWebhooks(...args),
}));

import { commerceRouter } from "../src/routes/commerce.js";
import { Hono } from "hono";

const TOKEN = "appr_test_token_value";

function appAs(userId: string) {
  const app = new Hono();
  app.use("/v1/*", async (c, next) => {
    c.set("userId" as never, userId as never);
    await next();
  });
  app.route("/v1", commerceRouter);
  return app;
}

function approve(token = TOKEN) {
  return appAs("user_a").request("/v1/checkout/co_1/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalToken: token }),
  });
}

beforeEach(() => {
  state.checkout = {
    id: "co_1",
    cartId: "cart_a",
    consumerId: "cons_a",
    ownerId: "user_a",
    status: "pending",
    approvalToken: TOKEN,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  state.items = [
    { id: 1, productId: "agr_1", storeId: "store_1", quantity: 2, priceAtAdd: "10.00", productName: "Widget" },
  ];
  state.failOrderInsert = false;
  state.txEntered = false;
  state.ordersInserted = [];
  dispatchWebhooks.mockClear();
});

describe("checkout approval — transactional integrity", () => {
  it("completes inside a transaction and dispatches the webhook after commit", async () => {
    const res = await approve();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("completed");
    expect(body.data.orders).toHaveLength(1);

    // Writes went through the transaction, and the order was inserted.
    expect(state.txEntered).toBe(true);
    expect(state.ordersInserted).toHaveLength(1);

    // Webhook fired exactly once, for the right store, after the order existed.
    expect(dispatchWebhooks).toHaveBeenCalledTimes(1);
    expect(dispatchWebhooks).toHaveBeenCalledWith(
      expect.objectContaining({ event: "order.created", store_id: "store_1" })
    );
  });

  it("rolls back and emits no webhook when an order insert fails mid-flow", async () => {
    state.failOrderInsert = true;

    const res = await approve();
    expect(res.status).toBe(500);

    // We entered the transaction (so the rollback boundary applies) but no
    // webhook was dispatched for the half-written approval.
    expect(state.txEntered).toBe(true);
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });

  it("still rejects an invalid approval token before opening a transaction", async () => {
    const res = await approve("appr_wrong_token_xxxx");
    expect(res.status).toBe(403);
    expect(state.txEntered).toBe(false);
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });
});
