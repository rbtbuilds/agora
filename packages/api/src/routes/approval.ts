import { Hono } from "hono";
import type { Context } from "hono";
import crypto from "node:crypto";
import { db, checkouts, cartItems, products, stores, carts, orders } from "@agora/db";
import { and, eq, gt } from "drizzle-orm";
import { dispatchWebhooks } from "../lib/webhook-dispatcher.js";
import { DESIGN_TOKENS_CSS } from "../lib/design-tokens.js";

const approvalRouter = new Hono();

class CartChangedError extends Error {}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

// CSRF guard for the public approval POST endpoints. The token in the URL is
// the auth, but a malicious page that learns a token could still auto-submit a
// form. Block cross-origin POSTs by requiring Origin or Referer to match the
// request host. Same-origin form submits from the GET page below always do.
function isSameOriginPost(c: Context): boolean {
  const host = c.req.header("host");
  if (!host) return false;
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");
  const matches = (value: string | undefined) => {
    if (!value) return null;
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };
  const originMatch = matches(origin);
  const refererMatch = matches(referer);
  // If neither header is present, reject — modern browsers always send at
  // least one for cross-origin POSTs.
  if (originMatch === null && refererMatch === null) return false;
  // If either header is present, it must match. If both are present, both must.
  if (originMatch === false || refererMatch === false) return false;
  return true;
}

const APPROVAL_BASE_STYLES = `${DESIGN_TOKENS_CSS}
  body { display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem;
    max-width: 440px;
    width: 100%;
    animation: agora-fade-up 0.4s ease both;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--secondary);
    margin-bottom: 1.25rem;
  }
  .pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  h1 {
    font-family: var(--font-sans);
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
    margin-bottom: 0.5rem;
  }
  p.subtitle, p.message {
    font-size: 0.9rem;
    color: var(--secondary);
    line-height: 1.55;
  }
`;

function approvalErrorPage(title: string, message: string, icon = "&#128274;"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora Checkout</title>
  <style>${APPROVAL_BASE_STYLES}
    .card { text-align: center; }
    .icon { font-size: 2.25rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

approvalRouter.get("/:token", async (c) => {
  const token = c.req.param("token");

  const result = await db.select().from(checkouts)
    .where(eq(checkouts.approvalToken, token)).limit(1);

  if (result.length === 0) {
    return c.html(approvalErrorPage("Invalid approval link", "This approval link is not valid. It may have already been used or does not exist."), 404);
  }

  const checkout = result[0];

  if (checkout.status !== "pending") {
    const statusMsg = checkout.status === "completed" ? "approved" : checkout.status;
    return c.html(approvalErrorPage(
      `Order request already ${statusMsg}`,
      `This order request has already been ${statusMsg}. No further action is needed.`,
    ), 410);
  }

  if (new Date() > checkout.expiresAt) {
    return c.html(approvalErrorPage("Approval link expired", "This approval link has expired. Please ask the agent to initiate a new checkout."), 410);
  }

  const items = await db.select({
    name: products.name,
    quantity: cartItems.quantity,
    price: cartItems.priceAtAdd,
    storeName: stores.name,
  }).from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(stores, eq(cartItems.storeId, stores.id))
    .where(eq(cartItems.cartId, checkout.cartId));

  const currentTotal = items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
  ).toFixed(2);
  if (items.length === 0 || currentTotal !== checkout.totalAmount) {
    return c.html(approvalErrorPage(
      "Order request changed",
      "The cart changed after this approval was requested. Ask the agent to start a new checkout.",
    ), 409);
  }

  const now = new Date();
  const minutesLeft = Math.max(0, Math.round((checkout.expiresAt.getTime() - now.getTime()) / 60000));
  const expiryText = minutesLeft <= 1 ? "less than a minute" : `${minutesLeft} min`;

  const itemsHtml = items.map((item) => {
    const storeLabel = item.storeName ? ` &middot; ${escapeHtml(item.storeName)}` : "";
    const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
    return `<div class="item">
      <div>
        <div class="item-name">${escapeHtml(item.name)} <span class="item-qty">&times;${item.quantity}</span></div>
        <div class="item-meta">$${item.price}${storeLabel}</div>
      </div>
      <div class="item-total">$${lineTotal}</div>
    </div>`;
  }).join("");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora Checkout</title>
  <style>${APPROVAL_BASE_STYLES}
    .items { margin-bottom: 1.25rem; }
    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 0.5rem;
    }
    .item:last-child { margin-bottom: 0; }
    .item-name { font-size: 0.95rem; color: var(--text); font-weight: 500; }
    .item-qty { color: var(--secondary-dim); font-weight: 400; font-family: var(--font-mono); font-size: 0.85rem; }
    .item-meta { font-size: 0.8rem; color: var(--secondary-dim); margin-top: 0.2rem; }
    .item-total { font-size: 0.95rem; color: var(--text); font-weight: 600; font-family: var(--font-mono); }
    .divider { border: none; border-top: 1px solid var(--border); margin: 1.25rem 0; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .summary-row:last-child { margin-bottom: 0; }
    .summary-label { font-size: 0.875rem; color: var(--secondary); }
    .summary-value { font-size: 0.875rem; color: var(--secondary); font-family: var(--font-mono); }
    .total-amount { font-size: 1.15rem; font-weight: 700; color: var(--text); font-family: var(--font-mono); }
    .actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    .btn {
      flex: 1;
      padding: 0.85rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.15s ease;
      font-family: var(--font-sans);
    }
    .btn-approve {
      background: var(--accent);
      color: var(--bg);
      border: 1px solid var(--accent);
    }
    .btn-approve:hover { filter: brightness(1.1); }
    .btn-deny {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
      font-weight: 500;
    }
    .btn-deny:hover { border-color: var(--danger); color: var(--danger); }
    .expiry {
      text-align: center;
      font-size: 0.78rem;
      color: var(--secondary-dim);
      margin-top: 1rem;
      font-family: var(--font-mono);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="pill"><span class="dot"></span> Agora Checkout</div>
    <h1>Review this order request</h1>
    <p class="subtitle" style="margin-bottom:1rem;">An agent has prepared the following order:</p>
    <div class="items">${itemsHtml}</div>
    <hr class="divider">
    <div class="summary-row">
      <span class="summary-label">Total</span>
      <span class="total-amount">$${checkout.totalAmount}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Payment</span>
      <span class="summary-value">Not connected</span>
    </div>
    <p class="subtitle">Approving records an order in Agora. No card will be charged or purchase completed.</p>
    <div class="actions">
      <form action="/approve/${encodeURIComponent(token)}/confirm" method="POST" style="flex:1;">
        <button type="submit" class="btn btn-approve" style="width:100%;">Approve order request</button>
      </form>
      <form action="/approve/${encodeURIComponent(token)}/deny" method="POST" style="flex:1;">
        <button type="submit" class="btn btn-deny" style="width:100%;">Deny</button>
      </form>
    </div>
    <p class="expiry">Expires in ${expiryText}</p>
  </div>
</body>
</html>`);
});

approvalRouter.post("/:token/confirm", async (c) => {
  if (!isSameOriginPost(c)) {
    return c.html(approvalErrorPage("Request blocked", "This approval request did not come from a trusted origin."), 403);
  }
  const token = c.req.param("token");

  const result = await db.select().from(checkouts)
    .where(eq(checkouts.approvalToken, token)).limit(1);

  if (result.length === 0) {
    return c.html(approvalErrorPage("Invalid approval link", "This approval link is not valid."), 404);
  }

  const checkout = result[0];

  if (checkout.status !== "pending") {
    const statusMsg = checkout.status === "completed" ? "approved" : checkout.status;
    return c.html(approvalErrorPage(
      `Order request already ${statusMsg}`,
      `This order request has already been ${statusMsg}. No further action is needed.`,
    ), 410);
  }

  if (new Date() > checkout.expiresAt) {
    return c.html(approvalErrorPage("Approval link expired", "This approval link has expired."), 410);
  }

  const webhookJobs: Array<{ event: string; store_id: string; data: Record<string, unknown> }> = [];
  let approved = false;

  try {
    approved = await db.transaction(async (tx) => {
      const [claimed] = await tx.update(checkouts)
        .set({ status: "completed" })
        .where(and(
          eq(checkouts.id, checkout.id),
          eq(checkouts.status, "pending"),
          gt(checkouts.expiresAt, new Date()),
        ))
        .returning({ id: checkouts.id });

      if (!claimed) return false;

      const items = await tx.select({
        productId: cartItems.productId,
        storeId: cartItems.storeId,
        quantity: cartItems.quantity,
        price: cartItems.priceAtAdd,
        name: products.name,
      }).from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.cartId, checkout.cartId));

      const currentTotal = items.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
      ).toFixed(2);
      if (items.length === 0 || currentTotal !== checkout.totalAmount) {
        throw new CartChangedError("Cart changed after checkout began");
      }

      const byStore = new Map<string | null, typeof items>();
      for (const item of items) {
        const key = item.storeId ?? null;
        if (!byStore.has(key)) byStore.set(key, []);
        byStore.get(key)!.push(item);
      }

      for (const [storeId, storeItems] of byStore) {
        const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
        const orderTotal = storeItems
          .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
          .toFixed(2);
        const itemsSnapshot = storeItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }));

        await tx.insert(orders).values({
          id: orderId,
          checkoutId: checkout.id,
          consumerId: checkout.consumerId,
          ownerId: checkout.ownerId,
          storeId,
          status: "confirmed",
          totalAmount: orderTotal,
          items: itemsSnapshot,
        });

        if (storeId) {
          webhookJobs.push({
            event: "order.created",
            store_id: storeId,
            data: {
              orderId,
              checkoutId: checkout.id,
              consumerId: checkout.consumerId,
              totalAmount: orderTotal,
              items: itemsSnapshot,
            },
          });
        }
      }

      await tx.update(carts)
        .set({ status: "checked_out" })
        .where(eq(carts.id, checkout.cartId));

      return true;
    });
  } catch (error) {
    if (error instanceof CartChangedError) {
      return c.html(approvalErrorPage(
        "Order request changed",
        "The cart changed after this approval was requested. Ask the agent to start a new checkout.",
      ), 409);
    }
    console.error(`[checkout] browser approval failed for ${checkout.id}:`, error);
    return c.html(approvalErrorPage("Approval failed", "The order request was not recorded. Please try again."), 500);
  }

  if (!approved) {
    return c.html(approvalErrorPage("Order request already handled", "This order request is no longer pending."), 409);
  }

  for (const job of webhookJobs) {
    try {
      await dispatchWebhooks(job);
    } catch (error) {
      console.error(`[checkout] browser approval webhook failed for ${checkout.id}:`, error);
    }
  }

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Request Approved</title>
  <style>${APPROVAL_BASE_STYLES}
    .card { text-align: center; }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .amount {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      margin: 1rem 0;
      font-family: var(--font-mono);
    }
    h1 { color: var(--accent); }
  </style>
</head>
<body>
  <div class="card">
    <div class="pill"><span class="dot"></span> Approved</div>
    <h1>Order request approved</h1>
    <div class="amount">$${checkout.totalAmount}</div>
    <p class="message">Agora recorded this order request. No card was charged or purchase completed.</p>
  </div>
</body>
</html>`);
});

approvalRouter.post("/:token/deny", async (c) => {
  if (!isSameOriginPost(c)) {
    return c.html(approvalErrorPage("Request blocked", "This approval request did not come from a trusted origin."), 403);
  }
  const token = c.req.param("token");

  const result = await db.select().from(checkouts)
    .where(eq(checkouts.approvalToken, token)).limit(1);

  if (result.length === 0) {
    return c.html(approvalErrorPage("Invalid approval link", "This approval link is not valid."), 404);
  }

  const checkout = result[0];

  if (checkout.status !== "pending") {
    const statusMsg = checkout.status === "completed" ? "approved" : checkout.status;
    return c.html(approvalErrorPage(
      `Order request already ${statusMsg}`,
      `This order request has already been ${statusMsg}. No further action is needed.`,
    ), 410);
  }

  const [denied] = await db.update(checkouts)
    .set({ status: "denied" })
    .where(and(
      eq(checkouts.id, checkout.id),
      eq(checkouts.status, "pending"),
      gt(checkouts.expiresAt, new Date()),
    ))
    .returning({ id: checkouts.id });

  if (!denied) {
    return c.html(approvalErrorPage("Order request already handled", "This order request is no longer pending."), 409);
  }

  return c.html(approvalErrorPage(
    "Order request denied",
    "This order request was denied. No payment was attempted.",
    "&#128683;",
  ));
});

export { approvalRouter };
