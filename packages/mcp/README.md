# agora-mcp-server

MCP server for [Agora](https://github.com/rbtbuilds/agora) — the open protocol for agent commerce. Lets any MCP-compatible AI agent (Claude, ChatGPT, Cursor) search products, build carts, and run consumer-approved checkouts across the Agora network.

22,500+ products indexed across 52 stores · Protocol v1.0 · MIT licensed.

**Checkout is a prototype:** approval records an order but does not charge a card or complete a real purchase. Do not use it for live transactions.

## Install

Add to your MCP host config (Claude Desktop / Cursor / etc.):

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["agora-mcp-server"],
      "env": {
        "AGORA_API_KEY": "ak_your_key",
        "AGORA_CONSUMER_ID": "your_consumer_id"
      }
    }
  }
}
```

`AGORA_API_KEY` is required. `AGORA_CONSUMER_ID` is optional (defaults to `"default"`) — set it if you want all your carts/orders linked to a stable consumer record.

Get an API key at [agora-portal.vercel.app](https://agora-portal.vercel.app).

## Tools exposed

### Discovery

| Tool | Description |
|---|---|
| `agora_search` | Search products by natural-language query. Optional filters: `source`, `minPrice`, `maxPrice`, `availability`. |
| `agora_product` | Fetch a single product by Agora ID (e.g. `agr_abc123`). |
| `agora_similar` | Find products similar to a given product. |

### Cart

| Tool | Description |
|---|---|
| `agora_cart_create` | Create a new cart for a consumer. |
| `agora_cart_view` | View a cart with items and subtotal. |
| `agora_cart_add` | Add a product to a cart. |
| `agora_cart_remove` | Remove an item from a cart. |

### Checkout

| Tool | Description |
|---|---|
| `agora_checkout_create` | Begin a checkout and return an approval URL for the consumer. |
| `agora_checkout_approve` | Approve a pending checkout with the token. Use only when the consumer has explicitly said yes in-conversation. |
| `agora_checkout_deny` | Deny a pending checkout. No charge is made. |
| `agora_checkout_status` | Poll a checkout's status (`pending` / `completed` / `denied` / `expired`). |

### Orders

| Tool | Description |
|---|---|
| `agora_order_get` | Fetch a completed order by ID with line items. |

## Consent model

The agent never sees a card. The current prototype records consent and an order without charging a card:

1. Agent calls `agora_checkout_create` from a cart.
2. Agora returns a **single-use, 15-minute approval token** and a human-facing approval URL.
3. Agent shows the URL to the consumer, who clicks through and approves on a real web page.
4. Agent polls `agora_checkout_status` until status is `completed` (or `denied` / `expired`).
5. On completion, the agent can fetch order details with `agora_order_get`.

Approval tokens expire after 15 minutes. The authenticated API compares submitted tokens in constant time.

## Transport

Stdio only. Speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdin/stdout. Compatible with Claude Desktop, Cursor, and any other MCP host.

## License

MIT.

---

Built by [Bento Labs](https://github.com/rbtbuilds/agora) · [Protocol spec](https://github.com/rbtbuilds/agora/blob/main/docs/protocol/spec.md) · [Live API](https://agora-ecru-chi.vercel.app)
