import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "pending", price: "12.00" }));

vi.mock("@agora/db", () => {
  const checkouts = { approvalToken: {} };
  const cartItems = { cartId: {}, productId: {}, storeId: {}, quantity: {}, priceAtAdd: {} };
  const products = { id: {}, name: {} };
  const stores = { id: {}, name: {} };

  return {
    checkouts,
    cartItems,
    products,
    stores,
    paymentMethods: {},
    carts: {},
    orders: {},
    db: {
      select: vi.fn(() => ({
        from: (table: unknown) => table === checkouts
          ? { where: () => ({ limit: async () => [{
            id: "co_1",
            cartId: "cart_1",
            status: state.status,
            expiresAt: new Date(Date.now() + 600_000),
            paymentMethodId: null,
            totalAmount: "12.00",
          }] }) }
          : {
            innerJoin: () => ({
              leftJoin: () => ({
                where: async () => [{
                  name: '<img src=x onerror="alert(1)">',
                  storeName: '</div><script>alert(2)</script>',
                  quantity: 1,
                  price: state.price,
                }],
              }),
            }),
          },
      })),
    },
  };
});

vi.mock("../src/lib/webhook-dispatcher.js", () => ({ dispatchWebhooks: vi.fn() }));

import { approvalRouter } from "../src/routes/approval.js";

beforeEach(() => {
  state.status = "pending";
  state.price = "12.00";
});

describe("approval page HTML", () => {
  it("renders catalog text without executable markup", async () => {
    const response = await approvalRouter.request("/valid-token");
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;/div&gt;&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script>alert(2)</script>");
  });

  it("keeps the approval token inside the form action path", async () => {
    const response = await approvalRouter.request('/bad%22%20onmouseover%3D%22alert(1)');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('action="/approve/bad%22%20onmouseover%3D%22alert(1)/confirm"');
    expect(html).not.toContain('action="/approve/bad" onmouseover=');
  });

  it("does not render stored status text as markup", async () => {
    state.status = '<img src=x onerror="alert(3)">';

    const response = await approvalRouter.request("/valid-token");
    expect(response.status).toBe(410);

    const html = await response.text();
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(3)&quot;&gt;");
    expect(html).not.toContain('<img src=x onerror="alert(3)">');
  });

  it("does not offer approval when the cart total changed", async () => {
    state.price = "13.00";

    const response = await approvalRouter.request("/valid-token");
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("Approve order request</button>");
  });
});
