import { Hono } from "hono";
import { openapiSpec } from "../lib/openapi-spec.js";

const PUBLIC_API_URL = process.env.AGORA_PUBLIC_URL ?? "https://agora-ecru-chi.vercel.app";
const PORTAL_URL = process.env.AGORA_PORTAL_URL ?? "https://agora-portal.vercel.app";

const protocolRouter = new Hono();

protocolRouter.get("/.well-known/agora.json", (c) => {
  return c.json({
    $schema: "https://protocol.agora.dev/v1/schema.json",
    version: "1.0",
    store: {
      name: "Agora",
      url: PUBLIC_API_URL,
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
      registration: PORTAL_URL,
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

protocolRouter.get("/openapi.json", (c) => c.json(openapiSpec));

protocolRouter.get("/playground", (c) => {
  const config = JSON.stringify({
    theme: "kepler",
    layout: "modern",
    metadata: { title: "Agora API Playground" },
    authentication: {
      preferredSecurityScheme: "bearerAuth",
      http: { bearer: { token: "" } },
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

protocolRouter.get("/health", (c) => c.json({ status: "ok" }));

protocolRouter.get("/", (c) => {
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

export { protocolRouter };
