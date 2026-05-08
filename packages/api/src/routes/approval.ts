import { Hono } from "hono";
import type { Context } from "hono";
import crypto from "node:crypto";
import { db, checkouts, cartItems, products, stores, paymentMethods, carts, orders } from "@agora/db";
import { eq } from "drizzle-orm";
import { dispatchWebhooks } from "../lib/webhook-dispatcher.js";
import { DESIGN_TOKENS_CSS } from "../lib/design-tokens.js";

const approvalRouter = new Hono();

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
    <h1>${title}</h1>
    <p class="message">${message}</p>
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
      `Purchase already ${statusMsg}`,
      `This purchase has already been ${statusMsg}. No further action is needed.`,
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

  let cardInfo = "Card on file";
  if (checkout.paymentMethodId) {
    const pm = await db.select().from(paymentMethods)
      .where(eq(paymentMethods.id, checkout.paymentMethodId)).limit(1);
    if (pm.length > 0) cardInfo = `${pm[0].brand} ending in ${pm[0].last4}`;
  }

  const now = new Date();
  const minutesLeft = Math.max(0, Math.round((checkout.expiresAt.getTime() - now.getTime()) / 60000));
  const expiryText = minutesLeft <= 1 ? "less than a minute" : `${minutesLeft} min`;

  const itemsHtml = items.map((item) => {
    const storeLabel = item.storeName ? ` &middot; ${item.storeName}` : "";
    const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
    return `<div class="item">
      <div>
        <div class="item-name">${item.name} <span class="item-qty">&times;${item.quantity}</span></div>
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
    <h1>Approve this purchase?</h1>
    <p class="subtitle" style="margin-bottom:1rem;">An agent wants to make the following purchase:</p>
    <div class="items">${itemsHtml}</div>
    <hr class="divider">
    <div class="summary-row">
      <span class="summary-label">Total</span>
      <span class="total-amount">$${checkout.totalAmount}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Card</span>
      <span class="summary-value">${cardInfo}</span>
    </div>
    <div class="actions">
      <form action="/approve/${token}/confirm" method="POST" style="flex:1;">
        <button type="submit" class="btn btn-approve" style="width:100%;">Approve</button>
      </form>
      <form action="/approve/${token}/deny" method="POST" style="flex:1;">
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
      `Purchase already ${statusMsg}`,
      `This purchase has already been ${statusMsg}. No further action is needed.`,
    ), 410);
  }

  if (new Date() > checkout.expiresAt) {
    return c.html(approvalErrorPage("Approval link expired", "This approval link has expired."), 410);
  }

  const items = await db.select({
    productId: cartItems.productId,
    storeId: cartItems.storeId,
    quantity: cartItems.quantity,
    price: cartItems.priceAtAdd,
    name: products.name,
  }).from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, checkout.cartId));

  // Group cart items by storeId — one order per store (matches commerce.ts approve flow)
  const byStore = new Map<string | null, typeof items>();
  for (const item of items) {
    const key = item.storeId ?? null;
    if (!byStore.has(key)) byStore.set(key, []);
    byStore.get(key)!.push(item);
  }

  const createdOrders: Array<{ id: string; storeId: string | null; totalAmount: string }> = [];

  for (const [storeId, storeItems] of byStore) {
    const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
    const orderTotal = storeItems
      .reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0)
      .toFixed(2);

    const itemsSnapshot = storeItems.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    }));

    await db.insert(orders).values({
      id: orderId,
      checkoutId: checkout.id,
      consumerId: checkout.consumerId,
      ownerId: checkout.ownerId,
      storeId: storeId ?? undefined,
      status: "confirmed",
      totalAmount: orderTotal,
      items: itemsSnapshot,
    });

    createdOrders.push({ id: orderId, storeId, totalAmount: orderTotal });

    if (storeId) {
      await dispatchWebhooks({
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

  await db.update(checkouts)
    .set({ status: "completed" })
    .where(eq(checkouts.id, checkout.id));

  await db.update(carts)
    .set({ status: "checked_out" })
    .where(eq(carts.id, checkout.cartId));

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Approved</title>
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
    <h1>Purchase approved</h1>
    <div class="amount">$${checkout.totalAmount}</div>
    <p class="message">Your purchase has been approved and is being processed. You will receive a confirmation shortly.</p>
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
      `Purchase already ${statusMsg}`,
      `This purchase has already been ${statusMsg}. No further action is needed.`,
    ), 410);
  }

  await db.update(checkouts)
    .set({ status: "denied" })
    .where(eq(checkouts.id, checkout.id));

  return c.html(approvalErrorPage(
    "Purchase denied",
    "You have denied this purchase. The agent has been notified and no charge has been made.",
    "&#128683;",
  ));
});

export { approvalRouter };
