import { Hono } from "hono";
import crypto from "node:crypto";
import { db, carts, cartItems, checkouts, orders, products, stores, consumers, paymentMethods } from "@agora/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { dispatchWebhooks } from "../lib/webhook-dispatcher.js";

const commerceRouter = new Hono();

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

// POST /cart — Create a cart
commerceRouter.post("/cart", async (c) => {
  let body: { consumerId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
  }

  if (!body.consumerId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Field 'consumerId' is required" } }, 400);
  }

  const ownerId = c.get("userId") as string;
  const id = `cart_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date();

  await db.insert(carts).values({
    id,
    consumerId: body.consumerId,
    ownerId,
    status: "open",
    createdAt: now,
  } as any);

  return c.json({
    data: {
      id,
      consumerId: body.consumerId,
      ownerId,
      status: "open",
      createdAt: now.toISOString(),
    },
  }, 201);
});

// GET /cart/:id — View cart with items and subtotal
commerceRouter.get("/cart/:id", async (c) => {
  const cartId = c.req.param("id");
  const ownerId = c.get("userId") as string;

  const cartRows = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, cartId), eq(carts.ownerId, ownerId)))
    .limit(1);

  if (cartRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Cart ${cartId} not found` } }, 404);
  }

  const cart = cartRows[0];

  // JOIN cart items with products to get names and prices
  const itemRows = await db
    .select({
      id: cartItems.id,
      cartId: cartItems.cartId,
      productId: cartItems.productId,
      storeId: cartItems.storeId,
      quantity: cartItems.quantity,
      priceAtAdd: cartItems.priceAtAdd,
      createdAt: cartItems.createdAt,
      productName: products.name,
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId));

  let subtotal = 0;
  for (const item of itemRows) {
    subtotal += parseFloat(item.priceAtAdd) * item.quantity;
  }

  return c.json({
    data: {
      id: cart.id,
      consumerId: cart.consumerId,
      status: cart.status,
      createdAt: cart.createdAt,
      items: itemRows.map((item) => ({
        id: item.id,
        productId: item.productId,
        storeId: item.storeId,
        name: item.productName ?? null,
        price: item.priceAtAdd,
        quantity: item.quantity,
        createdAt: item.createdAt,
      })),
      subtotal: subtotal.toFixed(2),
    },
  });
});

// POST /cart/:id/items — Add item to cart
commerceRouter.post("/cart/:id/items", async (c) => {
  const cartId = c.req.param("id");

  let body: { productId?: string; quantity?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
  }

  if (!body.productId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Field 'productId' is required" } }, 400);
  }

  const ownerId = c.get("userId") as string;

  // Verify cart exists and belongs to caller
  const cartRows = await db.select().from(carts).where(eq(carts.id, cartId)).limit(1);
  if (cartRows.length === 0 || cartRows[0].ownerId !== ownerId) {
    return c.json({ error: { code: "NOT_FOUND", message: `Cart ${cartId} not found` } }, 404);
  }

  const cart = cartRows[0];
  if (cart.status !== "open") {
    return c.json({ error: { code: "CONFLICT", message: "Cart is not open" } }, 409);
  }

  // Look up product to get price and storeId
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, body.productId))
    .limit(1);

  if (productRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Product ${body.productId} not found` } }, 404);
  }

  const product = productRows[0];
  const priceAtAdd = product.priceAmount ?? "0.00";
  const quantity = body.quantity ?? 1;

  const [cartItem] = await db
    .insert(cartItems)
    .values({
      cartId,
      productId: body.productId,
      storeId: product.storeId ?? null,
      quantity,
      priceAtAdd,
    } as any)
    .returning();

  return c.json({ data: cartItem }, 201);
});

// DELETE /cart/:id/items/:itemId — Remove item from cart
commerceRouter.delete("/cart/:id/items/:itemId", async (c) => {
  const cartId = c.req.param("id");
  const itemId = parseInt(c.req.param("itemId"), 10);

  if (isNaN(itemId)) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid itemId" } }, 400);
  }

  const ownerId = c.get("userId") as string;

  // Verify cart exists and belongs to caller
  const cartRows = await db.select().from(carts).where(eq(carts.id, cartId)).limit(1);
  if (cartRows.length === 0 || cartRows[0].ownerId !== ownerId) {
    return c.json({ error: { code: "NOT_FOUND", message: `Cart ${cartId} not found` } }, 404);
  }

  if (cartRows[0].status !== "open") {
    return c.json({ error: { code: "CONFLICT", message: "Cart is not open" } }, 409);
  }

  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)) as any);

  return c.json({ data: { deleted: true } });
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

// POST /checkout — Initiate checkout
commerceRouter.post("/checkout", async (c) => {
  let body: {
    cartId?: string;
    consumerId?: string;
    paymentMethodId?: string;
    approvalMode?: "inline" | "async";
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
  }

  if (!body.cartId || !body.consumerId || typeof body.consumerId !== "string" || body.consumerId.trim() === "") {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Fields 'cartId' and 'consumerId' are required" } },
      400
    );
  }

  const ownerId = c.get("userId") as string;

  // Verify cart exists, belongs to consumer, and is owned by caller
  const cartRows = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, body.cartId), eq(carts.consumerId, body.consumerId), eq(carts.ownerId, ownerId)))
    .limit(1);

  if (cartRows.length === 0) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Cart not found or does not belong to consumer" } },
      404
    );
  }

  const cart = cartRows[0];

  if (cart.status !== "open") {
    return c.json(
      { error: { code: "CONFLICT", message: `Cart is already ${cart.status}` } },
      409
    );
  }

  // Calculate total from cart items
  const itemRows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, body.cartId));

  if (itemRows.length === 0) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Cart is empty" } },
      400
    );
  }

  let total = 0;
  for (const item of itemRows) {
    total += parseFloat(item.priceAtAdd) * item.quantity;
  }
  const totalStr = total.toFixed(2);

  // Look up store name for prompt (best effort — use first item's store)
  let storeName = "Agora";
  const firstItem = itemRows[0];
  if (firstItem.storeId) {
    const storeRows = await db.select().from(stores).where(eq(stores.id, firstItem.storeId)).limit(1);
    if (storeRows.length > 0) storeName = storeRows[0].name;
  }

  const checkoutId = `co_${crypto.randomBytes(12).toString("hex")}`;
  const approvalToken = `appr_${crypto.randomBytes(24).toString("hex")}`;
  const approvalMode = body.approvalMode ?? "inline";
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(checkouts).values({
    id: checkoutId,
    cartId: body.cartId,
    consumerId: body.consumerId,
    ownerId,
    status: "pending",
    approvalToken,
    approvalMode,
    totalAmount: totalStr,
    paymentMethodId: body.paymentMethodId ?? null,
    expiresAt,
  } as any);

  if (approvalMode === "async") {
    // TODO: send SMS/email with approval link
    console.log(`[checkout] async approval requested for ${checkoutId}`);
  }

  return c.json({
    data: {
      id: checkoutId,
      ...(approvalMode === "inline" ? { approvalToken } : {}),
      total: totalStr,
      prompt: `Approve $${totalStr} at ${storeName}?`,
      expiresAt: expiresAt.toISOString(),
      status: "pending",
    },
  }, 201);
});

// POST /checkout/:id/approve — Approve purchase
commerceRouter.post("/checkout/:id/approve", async (c) => {
  const checkoutId = c.req.param("id");

  let body: { approvalToken?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
  }

  if (!body.approvalToken) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Field 'approvalToken' is required" } }, 400);
  }

  const ownerId = c.get("userId") as string;

  const checkoutRows = await db
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.id, checkoutId), eq(checkouts.ownerId, ownerId)))
    .limit(1);

  if (checkoutRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Checkout ${checkoutId} not found` } }, 404);
  }

  const checkout = checkoutRows[0];

  if (checkout.status !== "pending") {
    return c.json(
      { error: { code: "CONFLICT", message: `Checkout is already ${checkout.status}` } },
      409
    );
  }

  const approveTokenMatch = checkout.approvalToken.length === body.approvalToken.length &&
    crypto.timingSafeEqual(Buffer.from(checkout.approvalToken), Buffer.from(body.approvalToken));
  if (!approveTokenMatch) {
    return c.json({ error: { code: "FORBIDDEN", message: "Invalid approval token" } }, 403);
  }

  if (new Date() > checkout.expiresAt) {
    return c.json({ error: { code: "GONE", message: "Checkout has expired" } }, 410);
  }

  // TODO: Stripe Payment Intent — charge the customer here
  // e.g. await stripe.paymentIntents.create({ amount: ..., customer: ..., payment_method: ... })

  // Update checkout status to completed
  await db
    .update(checkouts)
    .set({ status: "completed" } as any)
    .where(eq(checkouts.id, checkoutId));

  // Update cart status to checked_out
  await db
    .update(carts)
    .set({ status: "checked_out" } as any)
    .where(eq(carts.id, checkout.cartId));

  // Fetch cart items with product details for order snapshot
  const itemRows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      storeId: cartItems.storeId,
      quantity: cartItems.quantity,
      priceAtAdd: cartItems.priceAtAdd,
      productName: products.name,
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, checkout.cartId));

  // Group cart items by storeId — one order per store
  const byStore = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const key = item.storeId ?? "__unknown__";
    if (!byStore.has(key)) byStore.set(key, []);
    byStore.get(key)!.push(item);
  }

  const createdOrders: Array<{
    id: string;
    storeId: string | null;
    status: string;
    totalAmount: string;
    items: Array<{ productId: string; name: string; quantity: number; price: string }>;
  }> = [];

  for (const [storeKey, storeItems] of byStore) {
    const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
    const storeId = storeKey === "__unknown__" ? null : storeKey;

    let orderTotal = 0;
    for (const item of storeItems) {
      orderTotal += parseFloat(item.priceAtAdd) * item.quantity;
    }
    const orderTotalStr = orderTotal.toFixed(2);

    const itemsSnapshot = storeItems.map((item) => ({
      productId: item.productId,
      name: item.productName ?? item.productId,
      quantity: item.quantity,
      price: item.priceAtAdd,
    }));

    await db.insert(orders).values({
      id: orderId,
      checkoutId,
      consumerId: checkout.consumerId,
      ownerId,
      storeId,
      status: "confirmed",
      totalAmount: orderTotalStr,
      items: itemsSnapshot,
    } as any);

    createdOrders.push({
      id: orderId,
      storeId,
      status: "confirmed",
      totalAmount: orderTotalStr,
      items: itemsSnapshot,
    });

    // Dispatch webhook to store
    if (storeId) {
      await dispatchWebhooks({
        event: "order.created",
        store_id: storeId,
        data: {
          orderId,
          checkoutId,
          consumerId: checkout.consumerId,
          totalAmount: orderTotalStr,
          items: itemsSnapshot,
        },
      });
    }
  }

  return c.json({
    data: {
      checkoutId,
      status: "completed",
      orders: createdOrders,
    },
  });
});

// POST /checkout/:id/deny — Deny purchase
commerceRouter.post("/checkout/:id/deny", async (c) => {
  const checkoutId = c.req.param("id");

  let body: { approvalToken?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400);
  }

  if (!body.approvalToken) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Field 'approvalToken' is required" } }, 400);
  }

  const ownerId = c.get("userId") as string;

  const checkoutRows = await db
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.id, checkoutId), eq(checkouts.ownerId, ownerId)))
    .limit(1);

  if (checkoutRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Checkout ${checkoutId} not found` } }, 404);
  }

  const checkout = checkoutRows[0];

  if (checkout.status !== "pending") {
    return c.json(
      { error: { code: "CONFLICT", message: `Checkout is already ${checkout.status}` } },
      409
    );
  }

  const denyTokenMatch = checkout.approvalToken.length === body.approvalToken.length &&
    crypto.timingSafeEqual(Buffer.from(checkout.approvalToken), Buffer.from(body.approvalToken));
  if (!denyTokenMatch) {
    return c.json({ error: { code: "FORBIDDEN", message: "Invalid approval token" } }, 403);
  }

  if (new Date() > checkout.expiresAt) {
    return c.json({ error: { code: "GONE", message: "Checkout has expired" } }, 410);
  }

  await db
    .update(checkouts)
    .set({ status: "denied" } as any)
    .where(eq(checkouts.id, checkoutId));

  return c.json({ data: { status: "denied" } });
});

// GET /checkout/:id — Check status
commerceRouter.get("/checkout/:id", async (c) => {
  const checkoutId = c.req.param("id");
  const ownerId = c.get("userId") as string;

  const checkoutRows = await db
    .select()
    .from(checkouts)
    .where(and(eq(checkouts.id, checkoutId), eq(checkouts.ownerId, ownerId)))
    .limit(1);

  if (checkoutRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Checkout ${checkoutId} not found` } }, 404);
  }

  const { approvalToken: _token, ...safeCheckout } = checkoutRows[0];
  return c.json({ data: safeCheckout });
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

// GET /orders — List orders for a consumer
commerceRouter.get("/orders", async (c) => {
  const consumerId = c.req.query("consumerId");
  const ownerId = c.get("userId") as string;

  if (!consumerId) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Query param 'consumerId' is required" } },
      400
    );
  }

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.consumerId, consumerId), eq(orders.ownerId, ownerId)))
    .orderBy(desc(orders.createdAt));

  return c.json({
    data: orderRows,
    meta: { total: orderRows.length },
  });
});

// GET /orders/:id — Order detail
commerceRouter.get("/orders/:id", async (c) => {
  const orderId = c.req.param("id");
  const ownerId = c.get("userId") as string;

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.ownerId, ownerId)))
    .limit(1);

  if (orderRows.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: `Order ${orderId} not found` } }, 404);
  }

  return c.json({ data: orderRows[0] });
});

export { commerceRouter };
