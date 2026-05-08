// OpenAPI 3.1 specification served at GET /openapi.json
// Note: commerce/cart/checkout/order/adapter/webhook endpoints are documented in the
// landing page HTML but not yet enumerated here — backlog item, see audit P3.

export const openapiSpec = {
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
} as const;
