import { Agora, type Product } from "agora-sdk";

let client: Agora | null = null;

function getClient(): Agora {
  if (!client) {
    const apiKey = process.env.AGORA_API_KEY;
    if (!apiKey) {
      throw new Error("AGORA_API_KEY environment variable is required");
    }
    client = new Agora({
      apiKey,
      baseUrl: process.env.AGORA_API_URL ?? "https://agora-ecru-chi.vercel.app",
    });
  }
  return client;
}

function getConsumerId(): string {
  return process.env.AGORA_CONSUMER_ID ?? "default";
}

function formatPrice(price: { amount: string; currency: string } | null | undefined): string {
  if (!price) return "N/A";
  return `${price.currency} ${price.amount}`;
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const agora = getClient();

  switch (name) {
    // -------------------------------------------------------------------
    // Discovery
    // -------------------------------------------------------------------

    case "agora_search": {
      const result = await agora.search(args.query as string, {
        source: args.source as string | undefined,
        minPrice: args.minPrice as number | undefined,
        maxPrice: args.maxPrice as number | undefined,
        availability: args.availability as "in_stock" | "out_of_stock" | undefined,
      });

      if (result.data.length === 0) {
        return "No products found matching your search.";
      }

      const lines = result.data.map(
        (p: Product) =>
          `- **${p.name}** (${p.id})\n  Price: ${formatPrice(p.price)} | Source: ${p.source} | ${p.availability}`
      );

      return `Found ${result.meta.total} products:\n\n${lines.join("\n\n")}`;
    }

    case "agora_product": {
      const result = await agora.product(args.id as string);
      const p = result.data;

      return [
        `# ${p.name}`,
        ``,
        `**ID:** ${p.id}`,
        `**Source:** ${p.source} ([link](${p.sourceUrl}))`,
        `**Price:** ${formatPrice(p.price)}`,
        `**Availability:** ${p.availability}`,
        `**Categories:** ${p.categories.join(", ") || "None"}`,
        `**Description:** ${p.description.slice(0, 500)}`,
        ``,
        `*Data freshness: ${result.meta.freshness} (confidence: ${result.meta.confidence})*`,
      ].join("\n");
    }

    case "agora_similar": {
      const result = await agora.similar(args.id as string);

      if (result.data.length === 0) {
        return "No similar products found.";
      }

      const lines = result.data.map(
        (p: Product) =>
          `- **${p.name}** (${p.id})\n  Price: ${formatPrice(p.price)} | Source: ${p.source}`
      );

      return `Similar products:\n\n${lines.join("\n\n")}`;
    }

    // -------------------------------------------------------------------
    // Cart
    // -------------------------------------------------------------------

    case "agora_cart_create": {
      const consumerId = (args.consumerId as string | undefined) ?? getConsumerId();
      const result = await agora.createCart(consumerId);
      const c = result.data;

      return [
        `**Cart created.**`,
        ``,
        `**Cart ID:** \`${c.id}\``,
        `**Consumer:** ${c.consumerId}`,
        `**Status:** ${c.status}`,
        ``,
        `Next: call \`agora_cart_add\` with this cart ID and a product ID (e.g. \`agr_abc123\`).`,
      ].join("\n");
    }

    case "agora_cart_view": {
      const result = await agora.getCart(args.cartId as string);
      const c = result.data;

      if (c.items.length === 0) {
        return `Cart \`${c.id}\` is empty. Status: ${c.status}.`;
      }

      const itemLines = c.items.map(
        (item) =>
          `- ${item.name ?? item.productId} × ${item.quantity} @ ${item.price} (item id: ${item.id})`
      );

      return [
        `# Cart \`${c.id}\``,
        ``,
        `**Status:** ${c.status}`,
        `**Consumer:** ${c.consumerId}`,
        `**Items:**`,
        ...itemLines,
        ``,
        `**Subtotal:** ${c.subtotal}`,
      ].join("\n");
    }

    case "agora_cart_add": {
      const cartId = args.cartId as string;
      const productId = args.productId as string;
      const quantity = (args.quantity as number | undefined) ?? 1;

      const result = await agora.addToCart(cartId, productId, quantity);
      const item = result.data;

      return [
        `**Added to cart.**`,
        ``,
        `**Product:** ${item.name ?? item.productId}`,
        `**Quantity:** ${item.quantity}`,
        `**Price at add:** ${item.price}`,
        `**Cart item ID:** ${item.id}`,
        ``,
        `Next: call \`agora_cart_view\` to confirm, or \`agora_checkout_create\` to begin purchase.`,
      ].join("\n");
    }

    case "agora_cart_remove": {
      const cartId = args.cartId as string;
      const itemId = args.itemId as number;
      await agora.removeFromCart(cartId, itemId);
      return `Item ${itemId} removed from cart \`${cartId}\`.`;
    }

    // -------------------------------------------------------------------
    // Checkout — agent kicks off, human approves out-of-band
    // -------------------------------------------------------------------

    case "agora_checkout_create": {
      const cartId = args.cartId as string;
      const consumerId = (args.consumerId as string | undefined) ?? getConsumerId();

      const result = await agora.createCheckout({
        cartId,
        consumerId,
        approvalMode: "inline",
      });
      const c = result.data;

      const approvalUrl = c.approvalToken ? agora.approvalUrl(c.approvalToken) : null;

      return [
        `**Checkout pending — consumer approval required.**`,
        ``,
        `**Checkout ID:** \`${c.id}\``,
        `**Total:** ${c.total}`,
        `**Prompt for user:** ${c.prompt}`,
        `**Expires:** ${c.expiresAt}`,
        ``,
        approvalUrl
          ? `**Tell the user to visit this URL to approve the purchase:**\n${approvalUrl}`
          : `(Async approval mode — user will receive a notification.)`,
        ``,
        approvalUrl
          ? `Approval token (single-use, 15-min expiry): \`${c.approvalToken}\``
          : ``,
        ``,
        `After the user approves at the URL above, call \`agora_checkout_status\` to confirm completion.`,
        `Alternatively, if the user says "approve" directly in chat, call \`agora_checkout_approve\` with the approval token.`,
      ].filter(Boolean).join("\n");
    }

    case "agora_checkout_approve": {
      const checkoutId = args.checkoutId as string;
      const approvalToken = args.approvalToken as string;

      const result = await agora.approveCheckout(checkoutId, approvalToken);
      const c = result.data;

      const orderLines = c.orders.map(
        (o) =>
          `- Order \`${o.id}\`${o.storeId ? ` (store ${o.storeId})` : ""} — ${o.totalAmount} — ${o.status}`
      );

      return [
        `**Checkout completed.**`,
        ``,
        `**Checkout ID:** \`${c.checkoutId}\``,
        `**Status:** ${c.status}`,
        `**Orders created:**`,
        ...orderLines,
        ``,
        `Call \`agora_order_get\` with an order ID for full details.`,
      ].join("\n");
    }

    case "agora_checkout_deny": {
      const checkoutId = args.checkoutId as string;
      const approvalToken = args.approvalToken as string;

      await agora.denyCheckout(checkoutId, approvalToken);
      return `Checkout \`${checkoutId}\` denied. No charge was made.`;
    }

    case "agora_checkout_status": {
      const result = await agora.getCheckout(args.checkoutId as string);
      const c = result.data;

      return [
        `**Checkout \`${c.id}\`**`,
        ``,
        `**Status:** ${c.status}`,
        `**Total:** ${c.totalAmount}`,
        `**Cart:** \`${c.cartId}\``,
        `**Consumer:** ${c.consumerId}`,
        `**Expires:** ${c.expiresAt}`,
        ``,
        c.status === "completed"
          ? `Call \`agora_order_get\` with the order ID from the approval response for order details.`
          : c.status === "pending"
            ? `Awaiting consumer approval.`
            : c.status === "denied"
              ? `User denied the purchase.`
              : `Checkout expired.`,
      ].join("\n");
    }

    // -------------------------------------------------------------------
    // Orders
    // -------------------------------------------------------------------

    case "agora_order_get": {
      const result = await agora.getOrder(args.orderId as string);
      const o = result.data;

      const itemLines = o.items.map(
        (item) => `- ${item.name} × ${item.quantity} @ ${item.price}`
      );

      return [
        `# Order \`${o.id}\``,
        ``,
        `**Status:** ${o.status}`,
        `**Total:** ${o.totalAmount}`,
        `**Store:** ${o.storeId ?? "Unknown"}`,
        `**Consumer:** ${o.consumerId}`,
        `**Items:**`,
        ...itemLines,
      ].join("\n");
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
