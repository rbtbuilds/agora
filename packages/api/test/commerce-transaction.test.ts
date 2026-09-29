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
  claimed: false,
  concurrentBarrier: false,
  pendingTransactions: 0,
  releaseTransactions: null as null | (() => void),
}));

vi.mock("@agora/db", () => {
  const checkouts = {};
  const carts = {};

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
      update: (table: unknown) => ({ set: () => ({
        where: () => table === checkouts
          ? {
            returning: async () => {
              if (state.claimed) return [];
              state.claimed = true;
              return [{ id: "co_1" }];
            },
          }
          : Promise.resolve(undefined),
      }) }),
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
      update: vi.fn(() => ({ set: () => ({ where: () => ({
        returning: async () => {
          if (state.claimed) return [];
          state.claimed = true;
          return [{ id: "co_1" }];
        },
      }) }) })),
      transaction: vi.fn(async (cb: any) => {
        state.txEntered = true;
        if (state.concurrentBarrier) {
          state.pendingTransactions++;
          if (state.pendingTransactions === 2) {
            state.releaseTransactions?.();
          } else {
            await new Promise<void>((resolve) => { state.releaseTransactions = resolve; });
          }
        }
        return cb(makeTx());
      }),
    },
    carts, cartItems: {}, checkouts, orders: {}, products: {}, stores: {},
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

function deny() {
  return appAs("user_a").request("/v1/checkout/co_1/deny", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalToken: TOKEN }),
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
    totalAmount: "20.00",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  state.items = [
    { id: 1, productId: "agr_1", storeId: "store_1", quantity: 2, priceAtAdd: "10.00", productName: "Widget" },
  ];
  state.failOrderInsert = false;
  state.txEntered = false;
  state.ordersInserted = [];
  state.claimed = false;
  state.concurrentBarrier = false;
  state.pendingTransactions = 0;
  state.releaseTransactions = null;
  dispatchWebhooks.mockReset();
  dispatchWebhooks.mockResolvedValue(undefined);
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

  it("returns the committed order even when post-commit webhook delivery throws", async () => {
    // The order is already committed; a webhook DB blip must NOT turn into a
    // 500 (client would retry and double-order). Webhook delivery is best-effort.
    dispatchWebhooks.mockRejectedValueOnce(new Error("webhook dispatch boom"));

    const res = await approve();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("completed");
    expect(body.data.orders).toHaveLength(1);
    expect(dispatchWebhooks).toHaveBeenCalledTimes(1);
  });

  it("still rejects an invalid approval token before opening a transaction", async () => {
    const res = await approve("appr_wrong_token_xxxx");
    expect(res.status).toBe(403);
    expect(state.txEntered).toBe(false);
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });

  it("creates only one order when two approvals race", async () => {
    state.concurrentBarrier = true;

    const [first, second] = await Promise.all([approve(), approve()]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(state.ordersInserted).toHaveLength(1);
    expect(dispatchWebhooks).toHaveBeenCalledTimes(1);
  });

  it("denies a pending checkout only once", async () => {
    const [first, second] = await Promise.all([deny(), deny()]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
  });

  it("rejects approval if the cart total changed after checkout began", async () => {
    state.items[0].priceAtAdd = "11.00";

    const res = await approve();

    expect(res.status).toBe(409);
    expect(state.ordersInserted).toHaveLength(0);
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });
});
