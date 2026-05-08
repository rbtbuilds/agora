// OpenAPI 3.1 specification served at GET /openapi.json
// Note: commerce/cart/checkout/order/adapter/webhook endpoints are documented in the
// landing page HTML but not yet enumerated here — backlog item, see audit P3.

const PUBLIC_API_URL = process.env.AGORA_PUBLIC_URL ?? "https://agora-ecru-chi.vercel.app";

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
      url: PUBLIC_API_URL,
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
      Cart: {
        type: "object",
        properties: {
          id: { type: "string" },
          consumerId: { type: "string" },
          status: { type: "string", enum: ["open", "checked_out", "abandoned"] },
          createdAt: { type: "string", format: "date-time" },
          items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          subtotal: { type: "string" },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          productId: { type: "string" },
          storeId: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          price: { type: "string" },
          quantity: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Checkout: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["pending", "completed", "denied"] },
          total: { type: "string" },
          prompt: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          approvalToken: { type: "string", description: "Only returned when approvalMode=inline" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          checkoutId: { type: "string" },
          consumerId: { type: "string" },
          storeId: { type: ["string", "null"] },
          status: { type: "string" },
          totalAmount: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                name: { type: "string" },
                quantity: { type: "integer" },
                price: { type: "string" },
              },
              required: ["productId", "name", "quantity", "price"],
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          storeId: { type: "string" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          secret: { type: "string", description: "Returned in plaintext only on creation" },
          active: { type: "integer", enum: [0, 1] },
        },
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
    "/v1/cart": {
      post: {
        operationId: "createCart",
        summary: "Create a cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { consumerId: { type: "string" } },
                required: ["consumerId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Cart created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Cart" } },
                  required: ["data"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/cart/{id}": {
      get: {
        operationId: "getCart",
        summary: "Get cart with items and subtotal",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Cart with items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Cart" } },
                  required: ["data"],
                },
              },
            },
          },
          "404": {
            description: "Cart not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/v1/cart/{id}/items": {
      post: {
        operationId: "addCartItem",
        summary: "Add an item to a cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "integer", default: 1, minimum: 1 },
                },
                required: ["productId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Item added",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/CartItem" } },
                  required: ["data"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/cart/{id}/items/{itemId}": {
      delete: {
        operationId: "removeCartItem",
        summary: "Remove an item from a cart",
        tags: ["Cart"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "itemId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Item removed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: { deleted: { type: "boolean" } },
                      required: ["deleted"],
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
    "/v1/checkout": {
      post: {
        operationId: "createCheckout",
        summary: "Initiate checkout",
        description: "Creates a pending checkout. With approvalMode=inline, returns the approvalToken in the response. With approvalMode=async, the consumer is notified out of band.",
        tags: ["Checkout"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cartId: { type: "string" },
                  consumerId: { type: "string" },
                  paymentMethodId: { type: "string" },
                  approvalMode: { type: "string", enum: ["inline", "async"], default: "inline" },
                },
                required: ["cartId", "consumerId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Checkout pending approval",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Checkout" } },
                  required: ["data"],
                },
              },
            },
          },
        },
      },
    },
    "/v1/checkout/{id}": {
      get: {
        operationId: "getCheckout",
        summary: "Get checkout status",
        tags: ["Checkout"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Checkout state (approvalToken redacted)",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Checkout" } } } } },
          },
        },
      },
    },
    "/v1/checkout/{id}/approve": {
      post: {
        operationId: "approveCheckout",
        summary: "Approve a pending checkout",
        description: "Confirms the purchase. Creates one order per store in the cart and dispatches order.created webhooks.",
        tags: ["Checkout"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { approvalToken: { type: "string" } },
                required: ["approvalToken"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Checkout completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        checkoutId: { type: "string" },
                        status: { type: "string" },
                        orders: { type: "array", items: { $ref: "#/components/schemas/Order" } },
                      },
                    },
                  },
                },
              },
            },
          },
          "403": { description: "Invalid approval token" },
          "410": { description: "Checkout has expired" },
        },
      },
    },
    "/v1/checkout/{id}/deny": {
      post: {
        operationId: "denyCheckout",
        summary: "Deny a pending checkout",
        tags: ["Checkout"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { approvalToken: { type: "string" } },
                required: ["approvalToken"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Denied" },
          "403": { description: "Invalid approval token" },
        },
      },
    },
    "/v1/orders": {
      get: {
        operationId: "listOrders",
        summary: "List orders for a consumer",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "consumerId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Orders for consumer",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
                    meta: { type: "object", properties: { total: { type: "integer" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/orders/{id}": {
      get: {
        operationId: "getOrder",
        summary: "Get an order by ID",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Order detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Order" } },
                },
              },
            },
          },
          "404": { description: "Order not found" },
        },
      },
    },
    "/v1/adapter/shopify": {
      post: {
        operationId: "adaptShopifyStore",
        summary: "Adapt a Shopify store to the Agora protocol",
        description: "Generates an agora.json manifest and proxy endpoints for a Shopify store. The store URL is verified to be reachable and to expose /products.json before registration.",
        tags: ["Adapter"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { url: { type: "string", format: "uri" } },
                required: ["url"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Store adapted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        store_id: { type: "string" },
                        manifest: { type: "object" },
                        endpoints: {
                          type: "object",
                          properties: {
                            agora_json: { type: "string", format: "uri" },
                            products: { type: "string", format: "uri" },
                            product: { type: "string", format: "uri" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "502": { description: "Could not reach the store" },
        },
      },
    },
    "/v1/adapter/shopify/{storeId}/agora.json": {
      get: {
        operationId: "getAdaptedManifest",
        summary: "Public manifest for an adapted Shopify store",
        tags: ["Adapter"],
        security: [],
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Manifest", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Store not found" },
        },
      },
    },
    "/v1/adapter/shopify/{storeId}/products": {
      get: {
        operationId: "getAdaptedProducts",
        summary: "Proxy products for an adapted Shopify store in Agora format",
        tags: ["Adapter"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 50 } },
        ],
        responses: {
          "200": {
            description: "Products",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                  },
                },
              },
            },
          },
          "502": { description: "Upstream Shopify error" },
        },
      },
    },
    "/v1/adapter/shopify/{storeId}/products/{handle}": {
      get: {
        operationId: "getAdaptedProduct",
        summary: "Single product from an adapted Shopify store",
        tags: ["Adapter"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "string" } },
          { name: "handle", in: "path", required: true, schema: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" } },
        ],
        responses: {
          "200": {
            description: "Product",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Product" } },
                },
              },
            },
          },
          "400": { description: "Invalid product handle" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/v1/stores/{storeId}/webhooks": {
      get: {
        operationId: "listWebhooks",
        summary: "List webhooks for a store (caller-owned only)",
        tags: ["Webhooks"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Webhooks (secrets redacted)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createWebhook",
        summary: "Create a webhook for a store you own",
        description: "Returns the secret in plaintext exactly once. Save it — used as the HMAC key for signature verification on incoming events.",
        tags: ["Webhooks"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  events: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["product.searched", "product.viewed", "store.registered", "order.created", "checkout.approved", "checkout.denied"],
                    },
                  },
                },
                required: ["url", "events"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Webhook" } },
                },
              },
            },
          },
          "403": { description: "You do not own this store" },
        },
      },
    },
    "/v1/stores/{storeId}/webhooks/{webhookId}": {
      delete: {
        operationId: "deleteWebhook",
        summary: "Delete a webhook you own",
        tags: ["Webhooks"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "string" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted" },
          "403": { description: "You do not own this webhook" },
          "404": { description: "Webhook not found" },
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
    { name: "Cart", description: "Cart management — multi-tenant, owner-scoped" },
    { name: "Checkout", description: "Checkout flow with consumer approval and per-store order fanout" },
    { name: "Orders", description: "Order history" },
    { name: "Adapter", description: "Shopify-to-Agora protocol adapter" },
    { name: "Webhooks", description: "Webhook subscriptions for store events" },
  ],
} as const;
