#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleToolCall } from "./handlers.js";

const server = new McpServer({
  name: "agora",
  version: "0.1.2",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reg = server.registerTool.bind(server) as (name: string, config: any, cb: any) => void;

function wrap(name: string) {
  return async (args: Record<string, unknown>) => {
    try {
      const text = await handleToolCall(name, args);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

reg(
  "agora_search",
  {
    description:
      "Search for products across e-commerce sites on the Agora network. Supports natural language queries like 'waterproof hiking boots under $100' or keyword searches.",
    inputSchema: {
      query: z.string().describe("Search query (natural language or keywords)"),
      source: z.string().optional().describe("Filter by source (e.g., 'amazon', 'shopify')"),
      minPrice: z.number().optional().describe("Minimum price filter"),
      maxPrice: z.number().optional().describe("Maximum price filter"),
      availability: z
        .enum(["in_stock", "out_of_stock"])
        .optional()
        .describe("Filter by availability"),
    },
  },
  wrap("agora_search")
);

reg(
  "agora_product",
  {
    description: "Get detailed information about a specific product by its Agora ID.",
    inputSchema: {
      id: z.string().describe("Agora product ID (e.g., agr_abc123)"),
    },
  },
  wrap("agora_product")
);

reg(
  "agora_similar",
  {
    description:
      "Find products similar to a given product. Useful for comparison shopping and finding alternatives.",
    inputSchema: {
      id: z.string().describe("Agora product ID to find similar products for"),
    },
  },
  wrap("agora_similar")
);

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

reg(
  "agora_cart_create",
  {
    description:
      "Create a new shopping cart for a consumer. Returns a cart ID to add items to. The consumer ID defaults to AGORA_CONSUMER_ID env var if not provided.",
    inputSchema: {
      consumerId: z
        .string()
        .optional()
        .describe("Consumer ID. Defaults to AGORA_CONSUMER_ID env var or 'default'."),
    },
  },
  wrap("agora_cart_create")
);

reg(
  "agora_cart_view",
  {
    description: "View a cart with all items and subtotal.",
    inputSchema: {
      cartId: z.string().describe("Cart ID returned by agora_cart_create."),
    },
  },
  wrap("agora_cart_view")
);

reg(
  "agora_cart_add",
  {
    description:
      "Add a product to a cart. Use the Agora product ID from a search result (e.g., agr_abc123).",
    inputSchema: {
      cartId: z.string().describe("Cart ID."),
      productId: z.string().describe("Agora product ID (e.g., agr_abc123)."),
      quantity: z.number().int().min(1).optional().describe("Quantity to add. Defaults to 1."),
    },
  },
  wrap("agora_cart_add")
);

reg(
  "agora_cart_remove",
  {
    description: "Remove an item from a cart by cart item ID (numeric, from agora_cart_view).",
    inputSchema: {
      cartId: z.string().describe("Cart ID."),
      itemId: z.number().int().describe("Cart item ID (the numeric `id` from agora_cart_view)."),
    },
  },
  wrap("agora_cart_remove")
);

// ---------------------------------------------------------------------------
// Checkout — agent kicks off, human approves out-of-band via URL
// ---------------------------------------------------------------------------

reg(
  "agora_checkout_create",
  {
    description:
      "Begin a checkout from a cart. Returns an approval URL the human must visit to authorize the purchase. The agent never charges a card without explicit consumer consent.",
    inputSchema: {
      cartId: z.string().describe("Cart ID to check out."),
      consumerId: z
        .string()
        .optional()
        .describe("Consumer ID. Defaults to AGORA_CONSUMER_ID env var or 'default'."),
    },
  },
  wrap("agora_checkout_create")
);

reg(
  "agora_checkout_approve",
  {
    description:
      "Approve a pending checkout using the approval token. ONLY call this if the consumer has explicitly said yes in the conversation. For URL-based approval, the user clicks the approval URL instead and you should poll agora_checkout_status.",
    inputSchema: {
      checkoutId: z.string().describe("Checkout ID."),
      approvalToken: z
        .string()
        .describe("Single-use, 15-min approval token from agora_checkout_create."),
    },
  },
  wrap("agora_checkout_approve")
);

reg(
  "agora_checkout_deny",
  {
    description: "Deny a pending checkout. No charge is made.",
    inputSchema: {
      checkoutId: z.string().describe("Checkout ID."),
      approvalToken: z.string().describe("Approval token from agora_checkout_create."),
    },
  },
  wrap("agora_checkout_deny")
);

reg(
  "agora_checkout_status",
  {
    description:
      "Check the status of a checkout. Use this to poll after sending the user to the approval URL — status will be 'pending', 'completed', 'denied', or 'expired'.",
    inputSchema: {
      checkoutId: z.string().describe("Checkout ID."),
    },
  },
  wrap("agora_checkout_status")
);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

reg(
  "agora_order_get",
  {
    description: "Fetch a completed order by ID, including items and total.",
    inputSchema: {
      orderId: z.string().describe("Order ID (e.g., ord_abc123)."),
    },
  },
  wrap("agora_order_get")
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
