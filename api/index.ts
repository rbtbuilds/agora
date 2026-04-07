import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "../packages/api/src/middleware/auth.js";
import { analyticsMiddleware } from "../packages/api/src/middleware/analytics.js";
import { productsRouter } from "../packages/api/src/routes/products.js";
import { categoriesRouter } from "../packages/api/src/routes/categories.js";
import { storesRouter } from "../packages/api/src/routes/stores.js";
import { registryRouter } from "../packages/api/src/routes/registry.js";
import { adapterRouter } from "../packages/api/src/routes/adapter.js";
import { commerceRouter } from "../packages/api/src/routes/commerce.js";
import { db } from "../packages/db/src/index.js";
import { checkouts, cartItems, products, stores, paymentMethods, carts, orders } from "../packages/db/src/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const app = new Hono();

app.use("*", cors());

const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Agora API",
    description: "The open protocol for agent commerce",
    version: "1.0.0",
    license: { name: "MIT" },
  },
  servers: [
    {
      url: "https://agora-ecru-chi.vercel.app",
      description: "Production",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API key (ak_...)",
      },
    },
    schemas: {
      Price: {
        type: "object",
        properties: {
          amount: { type: "string", example: "29.99" },
          currency: { type: "string", example: "USD" },
        },
        required: ["amount", "currency"],
      },
      Seller: {
        type: "object",
        properties: {
          name: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
          rating: { type: ["string", "null"] },
        },
        required: ["name", "url", "rating"],
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          sourceUrl: { type: "string", format: "uri" },
          source: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          price: {
            oneOf: [{ $ref: "#/components/schemas/Price" }, { type: "null" }],
          },
          images: { type: "array", items: { type: "string", format: "uri" } },
          categories: { type: "array", items: { type: "string" } },
          attributes: { type: "object", additionalProperties: { type: "string" } },
          availability: { type: "string", enum: ["in_stock", "out_of_stock", "unknown"] },
          seller: { $ref: "#/components/schemas/Seller" },
          lastCrawled: { type: "string", format: "date-time" },
        },
        required: ["id", "sourceUrl", "source", "name", "description", "price", "images", "categories", "attributes", "availability", "seller", "lastCrawled"],
      },
      Store: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: { type: "string", format: "uri" },
          agoraJsonUrl: { type: ["string", "null"], format: "uri" },
          source: { type: "string", enum: ["native", "scraped"] },
          capabilities: { type: "object", additionalProperties: { type: "string" } },
          productCount: { type: "integer" },
          validationScore: { type: ["integer", "null"] },
          lastSyncedAt: { type: ["string", "null"], format: "date-time" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "url", "agoraJsonUrl", "source", "capabilities", "productCount", "validationScore", "lastSyncedAt", "status", "createdAt"],
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          slug: { type: "string" },
          parentId: { type: ["integer", "null"] },
          source: { type: ["string", "null"] },
        },
        required: ["id", "name", "slug", "parentId", "source"],
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      PaginationMeta: {
        type: "object",
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          perPage: { type: "integer" },
        },
        required: ["total", "page", "perPage"],
      },
    },
  },
  paths: {
    "/.well-known/agora.json": {
      get: {
        operationId: "getAgoraManifest",
        summary: "Get Agora protocol manifest",
        description: "Returns the Agora protocol manifest describing this node's capabilities, auth, and rate limits.",
        tags: ["Protocol"],
        security: [],
        responses: {
          "200": {
            description: "Agora protocol manifest",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApiSpec",
        summary: "Get OpenAPI specification",
        description: "Returns this OpenAPI 3.1 specification as JSON.",
        tags: ["Protocol"],
        security: [],
        responses: {
          "200": {
            description: "OpenAPI 3.1 specification",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Health check",
        description: "Returns the current operational status of the API.",
        tags: ["Protocol"],
        security: [],
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/stores": {
      get: {
        operationId: "listStores",
        summary: "List registered stores",
        description: "Returns a paginated list of stores registered on the Agora network.",
        tags: ["Stores"],
        security: [],
        parameters: [
          {
            name: "source",
            in: "query",
            description: "Filter by registration source",
            required: false,
            schema: { type: "string", enum: ["native", "scraped"] },
          },
          {
            name: "limit",
            in: "query",
            description: "Maximum number of results to return (max 100)",
            required: false,
            schema: { type: "integer", default: 50, maximum: 100, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "List of stores",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Store" } },
                    meta: { type: "object", properties: { total: { type: "integer" } }, required: ["total"] },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/stores/{id}": {
      get: {
        operationId: "getStore",
        summary: "Get store by ID",
        description: "Returns details for a single store.",
        tags: ["Stores"],
        security: [],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Store detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Store" } },
                  required: ["data"],
                },
              },
            },
          },
          "404": {
            description: "Store not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/stores/register": {
      post: {
        operationId: "registerStore",
        summary: "Register a store",
        description: "Submit a store URL to be registered and crawled by the Agora network.",
        tags: ["Stores"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri", description: "The public URL of the store to register" },
                },
                required: ["url"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Store registered successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Store" },
                    meta: {
                      type: "object",
                      properties: { source: { type: "string", enum: ["native", "scraped"] } },
                      required: ["source"],
                    },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/registry/stats": {
      get: {
        operationId: "getRegistryStats",
        summary: "Get network registry stats",
        description: "Returns aggregate statistics for the Agora network (future endpoint).",
        tags: ["Registry"],
        security: [],
        responses: {
          "200": {
            description: "Network statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        totalStores: { type: "integer" },
                        totalProducts: { type: "integer" },
                        nativeStores: { type: "integer" },
                        scrapedStores: { type: "integer" },
                      },
                    },
                  },
                  required: ["data"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/products/search": {
      get: {
        operationId: "searchProducts",
        summary: "Search products",
        description: "Full-text search across all products in the Agora network. Requires authentication.",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "q", in: "query", description: "Search query string", required: true, schema: { type: "string" } },
          { name: "source", in: "query", description: "Filter by data source", required: false, schema: { type: "string" } },
          { name: "minPrice", in: "query", description: "Minimum price filter (inclusive)", required: false, schema: { type: "number", format: "float" } },
          { name: "maxPrice", in: "query", description: "Maximum price filter (inclusive)", required: false, schema: { type: "number", format: "float" } },
          { name: "availability", in: "query", description: "Filter by product availability", required: false, schema: { type: "string", enum: ["in_stock", "out_of_stock"] } },
          { name: "category", in: "query", description: "Filter by category slug or name", required: false, schema: { type: "string" } },
          { name: "page", in: "query", description: "Page number (1-indexed)", required: false, schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "perPage", in: "query", description: "Results per page", required: false, schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
          "400": {
            description: "Missing or invalid query parameter",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/products/{id}": {
      get: {
        operationId: "getProduct",
        summary: "Get product by ID",
        description: "Returns full details for a single product, including freshness and confidence metadata.",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Product detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Product" },
                    meta: {
                      type: "object",
                      properties: {
                        freshness: { type: "string", description: "ISO 8601 timestamp of last data refresh" },
                        source: { type: "string" },
                        confidence: { type: "number", format: "float", minimum: 0, maximum: 1 },
                      },
                      required: ["freshness", "source", "confidence"],
                    },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Product not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/products/{id}/similar": {
      get: {
        operationId: "getSimilarProducts",
        summary: "Get similar products",
        description: "Returns products similar to the specified product, ranked by relevance.",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "perPage", in: "query", required: false, schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
        ],
        responses: {
          "200": {
            description: "Similar products",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Product not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/categories": {
      get: {
        operationId: "listCategories",
        summary: "List categories",
        description: "Returns all product categories available in the Agora network.",
        tags: ["Categories"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of categories",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Category" } },
                  },
                  required: ["data"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
  tags: [
    { name: "Protocol", description: "Protocol-level endpoints (no auth required)" },
    { name: "Stores", description: "Store registry endpoints" },
    { name: "Products", description: "Product search and detail endpoints" },
    { name: "Categories", description: "Product category endpoints" },
    { name: "Registry", description: "Network registry and statistics" },
  ],
};

app.get("/.well-known/agora.json", (c) => {
  return c.json({
    $schema: "https://protocol.agora.dev/v1/schema.json",
    version: "1.0",
    store: {
      name: "Agora",
      url: "https://agora-ecru-chi.vercel.app",
      description: "The agent-friendly commerce layer for the internet",
      categories: [
        "apparel",
        "shoes",
        "accessories",
        "home",
        "food",
        "beauty",
        "electronics",
      ],
      currency: "USD",
      locale: "en-US",
    },
    capabilities: {
      products: "/v1/products/search?q=*",
      product: "/v1/products/{id}",
      search: "/v1/products/search",
    },
    auth: {
      type: "bearer",
      registration: "https://portal-opal-two.vercel.app",
    },
    rate_limits: {
      requests_per_minute: 60,
      burst: 10,
    },
    data_policy: {
      cache_ttl: 3600,
      attribution_required: false,
      commercial_use: true,
    },
  });
});

app.get("/openapi.json", (c) => {
  return c.json(openapiSpec);
});

app.get("/playground", (c) => {
  const config = JSON.stringify({
    theme: "kepler",
    layout: "modern",
    metadata: {
      title: "Agora API Playground",
    },
    authentication: {
      preferredSecurityScheme: "bearerAuth",
      http: {
        bearer: {
          token: "",
        },
      },
    },
  });
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora API Playground</title>
  <style>body { margin: 0; }</style>
</head>
<body>
  <script id="api-reference" data-url="/openapi.json" data-configuration='${config}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

// Public approval routes — mounted BEFORE auth middleware
// These are consumer-facing pages accessed via link (SMS/email)

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

app.get("/approve/:token", async (c) => {
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

app.post("/approve/:token/confirm", async (c) => {
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

  // Get cart items
  const items = await db.select({
    productId: cartItems.productId,
    storeId: cartItems.storeId,
    quantity: cartItems.quantity,
    price: cartItems.priceAtAdd,
    name: products.name,
  }).from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, checkout.cartId));

  // Group items by storeId to create one order per store
  const storeGroups = new Map<string | null, typeof items>();
  for (const item of items) {
    const key = item.storeId ?? null;
    if (!storeGroups.has(key)) storeGroups.set(key, []);
    storeGroups.get(key)!.push(item);
  }

  for (const [storeId, storeItems] of storeGroups) {
    const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
    const orderTotal = storeItems
      .reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0)
      .toFixed(2);
    await db.insert(orders).values({
      id: orderId,
      checkoutId: checkout.id,
      consumerId: checkout.consumerId,
      storeId: storeId ?? undefined,
      status: "confirmed",
      totalAmount: orderTotal,
      items: storeItems.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });
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

app.post("/approve/:token/deny", async (c) => {
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

// Public registry routes — mounted BEFORE auth middleware
app.route("/v1/registry", registryRouter);

// Public adapter routes — mounted BEFORE auth middleware
app.route("/v1/adapter", adapterRouter);

app.use("/v1/*", authMiddleware);
app.use("/v1/products/*", analyticsMiddleware);

app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora API</title>
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
    .container { max-width: 640px; padding: 2rem; text-align: center; }
    h1 {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #fff 0%, #a78bfa 50%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .tagline {
      font-size: 1.15rem;
      color: #a1a1aa;
      margin-bottom: 2.5rem;
      line-height: 1.6;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 9999px;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      color: #a1a1aa;
      margin-bottom: 2.5rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .endpoints {
      text-align: left;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .endpoints h2 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #71717a;
      margin-bottom: 1rem;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-bottom: 1px solid #27272a;
      font-size: 0.9rem;
    }
    .endpoint:last-child { border-bottom: none; }
    .method {
      font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;
      font-size: 0.75rem;
      font-weight: 600;
      color: #22c55e;
      background: #052e16;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      min-width: 36px;
      text-align: center;
    }
    .path {
      font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;
      color: #e5e5e5;
    }
    .desc { color: #71717a; margin-left: auto; font-size: 0.8rem; }
    .links {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
    }
    a {
      color: #a78bfa;
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    a:hover { color: #c4b5fd; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Agora</h1>
    <p class="tagline">The agent-friendly commerce layer for the internet.</p>
    <div class="status"><span class="dot"></span> API operational</div>
    <div class="endpoints">
      <h2>Endpoints</h2>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/products/search</span>
        <span class="desc">Search products</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/products/:id</span>
        <span class="desc">Product details</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/products/:id/similar</span>
        <span class="desc">Similar products</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/products/:id/compare</span>
        <span class="desc">Cross-store matches</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/categories</span>
        <span class="desc">Browse categories</span>
      </div>
      <div class="endpoint">
        <span class="method">POST</span>
        <span class="path">/v1/stores/register</span>
        <span class="desc">Register a store</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/stores</span>
        <span class="desc">List stores</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/stores/:id</span>
        <span class="desc">Store details</span>
      </div>
      <div class="endpoint">
        <span class="method">POST</span>
        <span class="path">/v1/adapter/shopify</span>
        <span class="desc">Adapt a Shopify store</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/.well-known/agora.json</span>
        <span class="desc">Protocol manifest</span>
      </div>
      <div class="endpoint">
        <span class="method">POST</span>
        <span class="path">/v1/cart</span>
        <span class="desc">Create cart</span>
      </div>
      <div class="endpoint">
        <span class="method">POST</span>
        <span class="path">/v1/checkout</span>
        <span class="desc">Initiate checkout</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/orders</span>
        <span class="desc">List orders</span>
      </div>
      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/playground</span>
        <span class="desc">Interactive API playground</span>
      </div>
    </div>
    <div class="links">
      <a href="https://github.com/rbtbuilds/agora">GitHub</a>
      <a href="https://github.com/rbtbuilds/agora#sdk-usage">SDK Docs</a>
      <a href="/health">Health Check</a>
      <a href="/playground">API Playground</a>
    </div>
  </div>
</body>
</html>`);
});

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1/products", productsRouter);
app.route("/v1/categories", categoriesRouter);
app.route("/v1/stores", storesRouter);
app.route("/v1", commerceRouter);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const webRequest = new Request(url.toString(), {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
  });

  const response = await app.fetch(webRequest);

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.text();
  res.end(body);
}
