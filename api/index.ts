import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "../packages/api/src/middleware/auth.js";
import { analyticsMiddleware } from "../packages/api/src/middleware/analytics.js";
import { productsRouter } from "../packages/api/src/routes/products.js";
import { categoriesRouter } from "../packages/api/src/routes/categories.js";
import { storesRouter } from "../packages/api/src/routes/stores.js";
import { registryRouter } from "../packages/api/src/routes/registry.js";

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

// Public registry routes — mounted BEFORE auth middleware
app.route("/v1/registry", registryRouter);

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
        <span class="method">GET</span>
        <span class="path">/.well-known/agora.json</span>
        <span class="desc">Protocol manifest</span>
      </div>
    </div>
    <div class="links">
      <a href="https://github.com/rbtbuilds/agora">GitHub</a>
      <a href="https://github.com/rbtbuilds/agora#sdk-usage">SDK Docs</a>
      <a href="/health">Health Check</a>
    </div>
  </div>
</body>
</html>`);
});

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1/products", productsRouter);
app.route("/v1/categories", categoriesRouter);
app.route("/v1/stores", storesRouter);

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
