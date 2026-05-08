import { Hono } from "hono";
import { openapiSpec } from "../lib/openapi-spec.js";
import { DESIGN_TOKENS_CSS } from "../lib/design-tokens.js";

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

const ENDPOINTS: Array<{ method: "GET" | "POST"; path: string; desc: string }> = [
  { method: "GET", path: "/v1/products/search", desc: "Search products" },
  { method: "GET", path: "/v1/products/:id", desc: "Product details" },
  { method: "GET", path: "/v1/products/:id/similar", desc: "Similar products" },
  { method: "GET", path: "/v1/products/:id/compare", desc: "Cross-store matches" },
  { method: "GET", path: "/v1/categories", desc: "Browse categories" },
  { method: "POST", path: "/v1/stores/register", desc: "Register a store" },
  { method: "GET", path: "/v1/stores", desc: "List stores" },
  { method: "GET", path: "/v1/stores/:id", desc: "Store details" },
  { method: "POST", path: "/v1/adapter/shopify", desc: "Adapt a Shopify store" },
  { method: "GET", path: "/.well-known/agora.json", desc: "Protocol manifest" },
  { method: "POST", path: "/v1/cart", desc: "Create cart" },
  { method: "POST", path: "/v1/checkout", desc: "Initiate checkout" },
  { method: "GET", path: "/v1/orders", desc: "List orders" },
  { method: "GET", path: "/playground", desc: "Interactive API playground" },
];

protocolRouter.get("/", (c) => {
  const endpointsHtml = ENDPOINTS.map(
    (e) => `<div class="endpoint">
        <span class="method method-${e.method.toLowerCase()}">${e.method}</span>
        <span class="path">${e.path}</span>
        <span class="desc">${e.desc}</span>
      </div>`,
  ).join("\n      ");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora API</title>
  <style>${DESIGN_TOKENS_CSS}
    body { display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
    .container { max-width: 720px; width: 100%; text-align: center; animation: agora-fade-up 0.6s ease both; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border: 1px solid var(--border);
      border-radius: 9999px;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--secondary);
      margin-bottom: 1.5rem;
    }
    .pill .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--status-ok);
      animation: agora-pulse-dot 2s ease-in-out infinite;
    }
    h1 {
      font-size: 3.25rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #fff 0%, var(--accent) 50%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
      line-height: 1;
    }
    .tagline {
      font-size: 1.1rem;
      color: var(--secondary);
      margin-bottom: 2.5rem;
      line-height: 1.6;
    }
    .endpoints {
      text-align: left;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .endpoints h2 {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--secondary);
      margin-bottom: 1rem;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    .endpoint:last-child { border-bottom: none; }
    .method {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      min-width: 40px;
      text-align: center;
    }
    .method-get { color: var(--status-ok); background: var(--status-ok-bg); }
    .method-post { color: var(--accent); background: var(--accent-dim); }
    .path { font-family: var(--font-mono); color: var(--text); }
    .desc { color: var(--secondary-dim); margin-left: auto; font-size: 0.8rem; }
    .links {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    a {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    a:hover { color: var(--accent-soft); }
    @media (max-width: 540px) {
      h1 { font-size: 2.5rem; }
      .desc { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="pill"><span class="dot"></span> API Operational</div>
    <h1>Agora</h1>
    <p class="tagline">The agent-friendly commerce layer for the internet.</p>
    <div class="endpoints">
      <h2>Endpoints</h2>
      ${endpointsHtml}
    </div>
    <div class="links">
      <a href="https://github.com/rbtbuilds/agora">GitHub</a>
      <a href="https://github.com/rbtbuilds/agora#sdk-usage">SDK Docs</a>
      <a href="/openapi.json">OpenAPI Spec</a>
      <a href="/playground">API Playground</a>
      <a href="/health">Health</a>
    </div>
  </div>
</body>
</html>`);
});

export { protocolRouter };
