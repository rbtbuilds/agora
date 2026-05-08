import { Hono } from "hono";
import type { Context } from "hono";
import crypto from "node:crypto";
import { db, checkouts, cartItems, products, stores, paymentMethods, carts, orders } from "@agora/db";
import { eq } from "drizzle-orm";
import { dispatchWebhooks } from "../lib/webhook-dispatcher.js";

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

function approvalErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora Checkout</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      margin: 1rem;
      text-align: center;
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #e5e5e5; margin-bottom: 0.5rem; }
    p { color: #71717a; font-size: 0.9rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128274;</div>
    <h1>${title}</h1>
    <p>${message}</p>
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
      `This purchase has already been ${statusMsg}. No further action is needed.`
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
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:#0a0a0a;border-radius:8px;margin-bottom:0.5rem;">
      <div>
        <div style="font-size:0.95rem;color:#e5e5e5;font-weight:500;">${item.name} <span style="color:#71717a;font-weight:400;">&times;${item.quantity}</span></div>
        <div style="font-size:0.8rem;color:#71717a;margin-top:0.2rem;">$${item.price}${storeLabel}</div>
      </div>
      <div style="font-size:0.95rem;color:#e5e5e5;font-weight:600;">$${lineTotal}</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora Checkout</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      margin: 1rem;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1.5rem;
    }
    .header-icon { font-size: 1.25rem; }
    .header h1 {
      font-size: 1rem;
      font-weight: 600;
      color: #a78bfa;
      letter-spacing: -0.01em;
    }
    .subtitle { font-size: 0.875rem; color: #71717a; margin-bottom: 1rem; }
    .items { margin-bottom: 1.25rem; }
    .divider { border: none; border-top: 1px solid #27272a; margin: 1.25rem 0; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .summary-label { font-size: 0.875rem; color: #a1a1aa; }
    .summary-value { font-size: 0.875rem; color: #a1a1aa; }
    .total-amount { font-size: 1.1rem; font-weight: 700; color: #e5e5e5; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    .btn-approve {
      flex: 1;
      background: #a78bfa;
      color: #0a0a0a;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-approve:hover { background: #c4b5fd; }
    .btn-deny {
      flex: 1;
      background: transparent;
      color: #e5e5e5;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-deny:hover { border-color: #ef4444; color: #ef4444; }
    .expiry { text-align: center; font-size: 0.78rem; color: #52525b; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="header-icon">&#128274;</span>
      <h1>Agora Checkout</h1>
    </div>
    <p class="subtitle">An agent wants to purchase:</p>
    <div class="items">${itemsHtml}</div>
    <hr class="divider">
    <div class="summary-row">
      <span class="summary-label">Total</span>
      <span class="total-amount">$${checkout.totalAmount}</span>
    </div>
    <div class="summary-row" style="margin-bottom:0;">
      <span class="summary-label">Card</span>
      <span class="summary-value">${cardInfo}</span>
    </div>
    <div class="actions">
      <form action="/approve/${token}/confirm" method="POST" style="flex:1;">
        <button type="submit" class="btn-approve" style="width:100%;">Approve</button>
      </form>
      <form action="/approve/${token}/deny" method="POST" style="flex:1;">
        <button type="submit" class="btn-deny" style="width:100%;">Deny</button>
      </form>
    </div>
    <p class="expiry">This link expires in ${expiryText}</p>
  </div>
</body>
</html>`;

  return c.html(html);
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
      `This purchase has already been ${statusMsg}. No further action is needed.`
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Approved</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      margin: 1rem;
      text-align: center;
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #a78bfa; margin-bottom: 0.5rem; }
    p { color: #71717a; font-size: 0.9rem; line-height: 1.5; }
    .amount { font-size: 1.5rem; font-weight: 700; color: #e5e5e5; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#9989;</div>
    <h1>Purchase approved</h1>
    <div class="amount">$${checkout.totalAmount}</div>
    <p>Your purchase has been approved and is being processed. You will receive a confirmation shortly.</p>
  </div>
</body>
</html>`;

  return c.html(html);
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
      `This purchase has already been ${statusMsg}. No further action is needed.`
    ), 410);
  }

  await db.update(checkouts)
    .set({ status: "denied" })
    .where(eq(checkouts.id, checkout.id));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Denied</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 420px;
      width: 100%;
      margin: 1rem;
      text-align: center;
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #e5e5e5; margin-bottom: 0.5rem; }
    p { color: #71717a; font-size: 0.9rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128683;</div>
    <h1>Purchase denied</h1>
    <p>You have denied this purchase. The agent has been notified and no charge has been made.</p>
  </div>
</body>
</html>`;

  return c.html(html);
});

export { approvalRouter };
