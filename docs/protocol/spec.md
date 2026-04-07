# Agora Protocol Specification

**Version:** 1.0
**Status:** Draft
**Schema:** https://protocol.agora.dev/v1/schema.json

---

## 1. Introduction

The web was built for human browsers. Pages render HTML. Search engines index text. Shopping carts expect clicks. Every layer of e-commerce infrastructure assumes a person is on the other end.

AI agents are not people. They cannot parse rendered HTML reliably. They cannot fill out CAPTCHAs. They do not benefit from hero images or carousel animations. When an agent needs to find a product, check inventory, or initiate a purchase, the current web forces it to scrape, guess, and fail gracefully — at best.

The Agora Protocol is an open standard that solves this. It defines a lightweight manifest format and a set of HTTP endpoint conventions that allow any store to declare what it sells and how agents can interact with it programmatically. An agent that discovers `/.well-known/agora.json` knows immediately: what products are available, how to search them, whether authentication is required, and how to initiate a transaction.

The relationship to precedent is intentional. `robots.txt` told crawlers what to index. `sitemap.xml` told them what existed. `agora.json` tells agents what a store sells and how to buy it.

Agora does not require a specific backend technology, framework, or platform. Any store that can serve a JSON file and implement two HTTP endpoints is Agora-compliant.

---

## 2. Manifest

### Discovery

The Agora manifest MUST be served at:

```
/.well-known/agora.json
```

The file MUST be accessible via HTTP GET without authentication. The response MUST include `Content-Type: application/json`.

Agents discover manifests by fetching this well-known path. Store owners SHOULD also reference the manifest in their site's `<head>` as a link relation:

```html
<link rel="agora-manifest" href="/.well-known/agora.json" />
```

### Manifest Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | Required | Semver string indicating the Agora Protocol version. Current: `"1.0"`. |
| `store` | object | Required | Metadata about the store. |
| `store.name` | string | Required | Human-readable store name. |
| `store.url` | string | Required | Canonical URL of the store. |
| `store.description` | string | Optional | Short description of what the store sells. |
| `store.logo` | string | Optional | URL of the store's logo image. |
| `store.locale` | string | Optional | BCP 47 language tag for the store's primary locale (e.g., `"en-US"`). |
| `store.currency` | string | Optional | ISO 4217 currency code for the store's primary currency (e.g., `"USD"`). |
| `capabilities` | object | Required | Declares which endpoints the store exposes. See Section 3. |
| `auth` | object | Optional | Authentication requirements. See Section 5. |
| `rate_limiting` | object | Optional | Rate limit declarations. See Section 6. |
| `data_policy` | object | Optional | Data usage policy. See Section 7. |
| `contact` | object | Optional | Contact information for the store operator. |
| `contact.email` | string | Optional | Support or technical contact email. |
| `contact.url` | string | Optional | URL to the store's developer or API documentation. |

### Minimal Example

```json
{
  "version": "1.0",
  "store": {
    "name": "My Store",
    "url": "https://mystore.com"
  },
  "capabilities": {
    "products": "/api/products",
    "product": "/api/products/{id}"
  }
}
```

### JSON Schema

The canonical JSON Schema for validating manifests is available at:

```
https://protocol.agora.dev/v1/schema.json
```

Manifests SHOULD reference this schema using the `$schema` key:

```json
{
  "$schema": "https://protocol.agora.dev/v1/schema.json",
  "version": "1.0",
  ...
}
```

---

## 3. Capabilities

The `capabilities` object declares the endpoints a store exposes. Endpoint values are URL paths, either absolute (beginning with `https://`) or relative to the store's canonical URL.

Path parameters are denoted with curly braces: `{id}`.

### 3.1 `products` (Required)

A paginated feed of all products offered by the store.

**Method:** GET
**Path template:** value of `capabilities.products`
**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number, 1-indexed. Default: 1. |
| `per_page` | integer | Results per page. Default and maximum at store's discretion; 100 recommended maximum. |

**Response:**

```json
{
  "data": [Product],
  "meta": {
    "total": 1482,
    "page": 1,
    "per_page": 50
  }
}
```

The `data` array contains Product objects. See Section 4 and `product-schema.md` for the full schema.

### 3.2 `product` (Required)

Retrieve a single product by its unique identifier.

**Method:** GET
**Path template:** value of `capabilities.product`, with `{id}` replaced by the product ID.

Example: if `capabilities.product` is `/api/products/{id}`, a request for product `"ABC123"` would go to `/api/products/ABC123`.

**Response:**

```json
{
  "data": Product
}
```

### 3.3 `search` (Optional)

Full-text search across the store's product catalog.

**Method:** GET
**Path template:** value of `capabilities.search`
**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Required. The search query. |
| `page` | integer | Page number, 1-indexed. Default: 1. |
| `per_page` | integer | Results per page. |

**Response:** Same structure as the `products` endpoint.

Stores SHOULD support basic keyword matching. Stores MAY support advanced operators such as field-scoped queries or boolean logic, but MUST gracefully handle simple keyword queries regardless.

### 3.4 `inventory` (Optional)

Real-time stock check for one or more products.

**Method:** GET
**Path template:** value of `capabilities.inventory`
**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `ids` | string | Comma-separated list of product IDs. |

**Response:**

```json
{
  "data": [
    {
      "id": "ABC123",
      "availability": {
        "status": "in_stock",
        "quantity": 42
      }
    }
  ]
}
```

### 3.5 `cart` (Optional)

Add one or more items to a cart. Stores that expose this capability allow agents to build carts programmatically.

**Method:** POST
**Path template:** value of `capabilities.cart`
**Request body:**

```json
{
  "items": [
    {
      "product_id": "ABC123",
      "variant_id": "ABC123-L-BLK",
      "quantity": 1
    }
  ]
}
```

**Response:**

```json
{
  "cart_id": "cart_7f3a9b",
  "checkout_url": "https://mystore.com/checkout?cart=cart_7f3a9b",
  "items": [...],
  "subtotal": {
    "amount": "59.99",
    "currency": "USD"
  }
}
```

### 3.6 `checkout` (Optional)

Initiate or retrieve a checkout session. This capability is intended for agents with delegated purchasing authority.

**Method:** POST
**Path template:** value of `capabilities.checkout`
**Request body:**

```json
{
  "cart_id": "cart_7f3a9b"
}
```

**Response:**

```json
{
  "checkout_id": "chk_91bc2e",
  "checkout_url": "https://mystore.com/checkout/chk_91bc2e",
  "expires_at": "2026-04-07T14:30:00Z"
}
```

---

## 4. Product Schema

Each Product object represents a single sellable item. The schema is designed to be both human-readable and machine-actionable.

**Required fields:** `id`, `url`, `name`, `pricing`, `availability`

**Optional fields:** `description`, `brand`, `images`, `categories`, `attributes`, `variants`, `identifiers`, `reviews`, `shipping`, `metadata`

For the complete field-by-field reference including types, examples, and agent-specific guidance, see [product-schema.md](./product-schema.md).

### Availability Status Values

The `availability.status` field MUST be one of:

| Value | Meaning |
|---|---|
| `in_stock` | Available for purchase now |
| `out_of_stock` | Not currently available |
| `preorder` | Available for pre-order; not yet shipped |
| `backorder` | Available to order; fulfillment delayed |
| `discontinued` | No longer sold |

---

## 5. Authentication

The `auth` object in the manifest declares how agents must authenticate before making requests. Agents MUST check `auth.type` before attempting any capability endpoint.

### Auth Object Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Required | One of: `none`, `api_key`, `bearer`, `oauth2`. |
| `description` | string | Optional | Human-readable instructions for obtaining credentials. |

### 5.1 `none`

No authentication required. All capability endpoints are publicly accessible.

```json
{
  "auth": {
    "type": "none"
  }
}
```

### 5.2 `api_key`

The agent must include an API key in a request header.

```json
{
  "auth": {
    "type": "api_key",
    "header": "X-API-Key",
    "description": "Request an API key at https://mystore.com/developers"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `header` | string | The header name to use. Default: `X-API-Key`. |
| `description` | string | Instructions for obtaining a key. |

### 5.3 `bearer`

The agent must include a Bearer token in the `Authorization` header.

```json
{
  "auth": {
    "type": "bearer",
    "description": "Obtain a token via POST /api/auth/token"
  }
}
```

Requests must include: `Authorization: Bearer <token>`

### 5.4 `oauth2`

Standard OAuth 2.0 flow. The agent must complete the OAuth flow before accessing capability endpoints.

```json
{
  "auth": {
    "type": "oauth2",
    "authorization_url": "https://mystore.com/oauth/authorize",
    "token_url": "https://mystore.com/oauth/token",
    "scopes": ["products:read", "cart:write"],
    "description": "Register your application at https://mystore.com/developers"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `authorization_url` | string | OAuth authorization endpoint. |
| `token_url` | string | OAuth token endpoint. |
| `scopes` | array | Required scopes for full access. |
| `description` | string | Registration instructions. |

---

## 6. Rate Limiting

Stores declare rate limits in the manifest so agents can plan their request cadence before making any calls.

### Rate Limiting Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `requests_per_minute` | integer | Optional | Sustained request rate limit. |
| `burst` | integer | Optional | Maximum requests allowed in a short burst window (typically 10 seconds). |

```json
{
  "rate_limiting": {
    "requests_per_minute": 60,
    "burst": 10
  }
}
```

### Agent Obligations

Agents MUST respect declared rate limits. If a store returns HTTP 429, the agent MUST back off and SHOULD respect the `Retry-After` header if present.

If `rate_limiting` is not declared in the manifest, agents SHOULD default to conservative limits: **10 requests per minute**. Agents MUST NOT assume unlimited throughput when no rate limit is declared.

Agents that repeatedly violate rate limits risk having their access revoked by the store operator.

---

## 7. Data Policy

The `data_policy` object communicates how agents may use the data they retrieve from a store.

### Data Policy Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `cache_ttl` | integer | Optional | Number of seconds agents may cache product data before re-fetching. |
| `attribution_required` | boolean | Optional | If `true`, agents must attribute the store when displaying product data to users. |
| `commercial_use` | boolean | Optional | If `false`, retrieved data may not be used for commercial purposes (e.g., resale, arbitrage). |
| `description` | string | Optional | Free-text description of the data policy or link to full terms. |

```json
{
  "data_policy": {
    "cache_ttl": 3600,
    "attribution_required": true,
    "commercial_use": true,
    "description": "Data may be used for agent-assisted shopping. See https://mystore.com/api-terms"
  }
}
```

If `data_policy` is not declared, agents SHOULD assume:
- `cache_ttl`: 300 seconds (5 minutes)
- `attribution_required`: false
- `commercial_use`: true

---

## 8. Versioning

The Agora Protocol uses semantic versioning (semver) within the `version` field.

| Change type | Version increment | Example |
|---|---|---|
| Breaking change (removes or renames required fields, changes behavior) | Major | 1.0 → 2.0 |
| Backwards-compatible addition (new optional fields, new capabilities) | Minor | 1.0 → 1.1 |
| Clarifications, documentation fixes | Patch | 1.0 → 1.0.1 |

**Current version: 1.0**

Agents MUST check the `version` field before processing a manifest. Agents SHOULD gracefully handle minor version differences (1.0 vs 1.1) by ignoring unknown fields. Agents MAY refuse to process manifests with a major version they do not support.

Stores MUST NOT make breaking changes to a capability endpoint without incrementing the manifest's major version.

---

## 9. Validation

Before going live, store operators SHOULD validate their manifest and endpoints using the official Agora validator:

```
npx @agora/validator https://yourstore.com
```

The validator will:

1. Fetch and validate `/.well-known/agora.json` against the JSON Schema
2. Test each declared capability endpoint
3. Verify response shapes match the expected schemas
4. Check that required fields are present in product responses
5. Report warnings for missing optional but recommended fields

### Example Output

```
Agora Protocol Validator v1.0

Fetching manifest from https://yourstore.com/.well-known/agora.json ... OK
Validating manifest schema ... OK
Testing capability: products (/api/products) ... OK (143ms, 50 products returned)
Testing capability: product (/api/products/{id}) ... OK (87ms)
Testing capability: search (/api/search) ... OK (201ms)

PASSED  3 checks passed, 0 warnings, 0 errors

Your store is Agora Protocol 1.0 compliant.
```

---

## Appendix: HTTP Status Codes

Agora endpoints MUST use standard HTTP status codes:

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (malformed query parameters) |
| 401 | Unauthorized (missing or invalid credentials) |
| 403 | Forbidden (credentials valid but insufficient scope) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

*Agora Protocol is an open standard. Contributions and feedback are welcome at https://github.com/agora-protocol/spec.*
