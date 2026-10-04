import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  claimed: false,
  items: [] as Array<{ productId: string; storeId: string; quantity: number; price: string; name: string }>,
  ordersInserted: [] as unknown[],
  concurrentBarrier: false,
  transactionsStarted: 0,
  pendingTransactions: 0,
  releaseTransactions: null as null | (() => void),
}));

vi.mock("@agora/db", () => {
  const checkouts = { id: {}, approvalToken: {}, status: {}, expiresAt: {} };
  const carts = { id: {} };
  const cartItems = { cartId: {}, productId: {}, storeId: {}, quantity: {}, priceAtAdd: {} };
  const products = { id: {}, name: {} };

  const select = () => ({
    from: (table: unknown) => table === checkouts
      ? { where: () => ({ limit: async () => [{
        id: "co_1",
        cartId: "cart_1",
        consumerId: "consumer_1",
        ownerId: "user_1",
        status: "pending",
        totalAmount: "12.00",
        expiresAt: new Date(Date.now() + 600_000),
      }] }) }
      : { innerJoin: () => ({ where: async () => state.items }) },
  });

  const insert = () => ({
    values: async (order: unknown) => { state.ordersInserted.push(order); },
  });

  const update = (table: unknown) => ({ set: () => ({
    where: () => table === checkouts
      ? {
        returning: async () => {
          if (state.claimed) return [];
          state.claimed = true;
          return [{ id: "co_1" }];
        },
      }
      : Promise.resolve(undefined),
  }) });

  return {
    db: {
      select: vi.fn(select),
      insert: vi.fn(insert),
      update: vi.fn(update),
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        state.transactionsStarted++;
        if (state.concurrentBarrier) {
          state.pendingTransactions++;
          if (state.pendingTransactions === 2) {
            state.releaseTransactions?.();
          } else {
            await new Promise<void>((resolve) => { state.releaseTransactions = resolve; });
          }
        }
        return callback({ select, insert, update });
      }),
    },
    checkouts,
    carts,
    cartItems,
    products,
    stores: {},
    paymentMethods: {},
    orders: {},
  };
});

const dispatchWebhooks = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/lib/webhook-dispatcher.js", () => ({
  dispatchWebhooks: (...args: unknown[]) => dispatchWebhooks(...args),
}));

import { approvalRouter } from "../src/routes/approval.js";

beforeEach(() => {
  state.claimed = false;
  state.items = [{
    productId: "product_1",
    storeId: "store_1",
    quantity: 1,
    price: "12.00",
    name: "Widget",
  }];
  state.ordersInserted = [];
  state.concurrentBarrier = false;
  state.transactionsStarted = 0;
  state.pendingTransactions = 0;
  state.releaseTransactions = null;
  dispatchWebhooks.mockReset();
  dispatchWebhooks.mockResolvedValue(undefined);
});

describe("browser approval", () => {
  it("records one order when two approval forms are submitted together", async () => {
    state.concurrentBarrier = true;
    const request = () => approvalRouter.request("/valid-token/confirm", {
      method: "POST",
      headers: { host: "agora.example", origin: "https://agora.example" },
    });

    const [first, second] = await Promise.all([request(), request()]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(state.transactionsStarted).toBe(2);
    expect(state.ordersInserted).toHaveLength(1);
    expect(dispatchWebhooks).toHaveBeenCalledTimes(1);
  });

  it("denies a pending request only once", async () => {
    const request = () => approvalRouter.request("/valid-token/deny", {
      method: "POST",
      headers: { host: "agora.example", origin: "https://agora.example" },
    });

    const [first, second] = await Promise.all([request(), request()]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(state.ordersInserted).toHaveLength(0);
  });

  it("rejects approval if the cart total changed after checkout began", async () => {
    state.items[0].price = "13.00";

    const response = await approvalRouter.request("/valid-token/confirm", {
      method: "POST",
      headers: { host: "agora.example", origin: "https://agora.example" },
    });

    expect(response.status).toBe(409);
    expect(state.ordersInserted).toHaveLength(0);
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });
});
