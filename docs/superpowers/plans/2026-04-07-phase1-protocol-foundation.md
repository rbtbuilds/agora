# Phase 1: Protocol Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define and ship the Agora Protocol spec, JSON Schemas, validator package, protocol docs, and dogfood the protocol on Agora's own API.

**Architecture:** The protocol is defined as JSON Schema files that validate two artifacts: the `agora.json` manifest (served at `/.well-known/agora.json`) and the product feed format. A new `@agora/validator` workspace package provides both a CLI and a programmatic API to validate any store URL against the spec. Agora's own API dogfoods the protocol by serving its own `agora.json` manifest.

**Tech Stack:** TypeScript, Vitest, Ajv (JSON Schema validation), Hono (API routes), Drizzle (DB), npm workspaces with Turborepo.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/validator/package.json` | Package manifest for `@agora/validator` |
| `packages/validator/tsconfig.json` | TypeScript config (ESM, strict) |
| `packages/validator/src/index.ts` | Public API: re-exports `validateManifest`, `validateProduct`, `validateStore` |
| `packages/validator/src/schema/agora-manifest.schema.json` | JSON Schema for the `agora.json` manifest |
| `packages/validator/src/schema/agora-product.schema.json` | JSON Schema for the product format |
| `packages/validator/src/validate-manifest.ts` | Validates a parsed manifest object against the JSON Schema |
| `packages/validator/src/validate-product.ts` | Validates a parsed product object against the JSON Schema |
| `packages/validator/src/validate-store.ts` | End-to-end: fetches `/.well-known/agora.json`, validates manifest, probes endpoints, validates products |
| `packages/validator/src/types.ts` | TypeScript types for manifest, product, validation results |
| `packages/validator/src/cli.ts` | CLI entry point (`npx @agora/validator <url>`) |
| `packages/validator/test/validate-manifest.test.ts` | Tests for manifest validation |
| `packages/validator/test/validate-product.test.ts` | Tests for product validation |
| `packages/validator/test/validate-store.test.ts` | Tests for end-to-end store validation |
| `packages/validator/test/fixtures/valid-manifest.json` | Valid test fixture |
| `packages/validator/test/fixtures/valid-product.json` | Valid test fixture |
| `packages/validator/test/fixtures/minimal-manifest.json` | Minimal valid manifest (only required fields) |
| `packages/validator/test/fixtures/invalid-manifest-missing-store.json` | Invalid: missing `store` |
| `packages/validator/test/fixtures/invalid-manifest-no-products-cap.json` | Invalid: missing required `products` capability |
| `packages/validator/test/fixtures/invalid-product-no-id.json` | Invalid: missing `id` |
| `docs/protocol/spec.md` | Full protocol specification |
| `docs/protocol/product-schema.md` | Product schema reference with field descriptions |
| `docs/protocol/getting-started.md` | Adoption guide for store owners |
| `docs/protocol/examples/minimal.json` | Minimal valid `agora.json` |
| `docs/protocol/examples/full.json` | Full-featured `agora.json` with all capabilities |

### Modified Files

| File | Change |
|------|--------|
| `api/index.ts` | Add `/.well-known/agora.json` route (dogfooding) |
| `packages/api/src/index.ts` | Add `/.well-known/agora.json` route if this is the actual Hono app |

---

## Task 1: JSON Schema — Agora Manifest

**Files:**
- Create: `packages/validator/src/schema/agora-manifest.schema.json`

- [ ] **Step 1: Create the manifest JSON Schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://protocol.agora.dev/v1/agora-manifest.schema.json",
  "title": "Agora Manifest",
  "description": "Schema for the agora.json manifest served at /.well-known/agora.json",
  "type": "object",
  "required": ["version", "store", "capabilities"],
  "properties": {
    "$schema": {
      "type": "string",
      "description": "URL to this JSON Schema"
    },
    "version": {
      "type": "string",
      "const": "1.0",
      "description": "Protocol version"
    },
    "store": {
      "type": "object",
      "required": ["name", "url"],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "description": "Human-readable store name"
        },
        "url": {
          "type": "string",
          "format": "uri",
          "description": "Canonical store URL"
        },
        "description": {
          "type": "string",
          "maxLength": 500,
          "description": "Short store description"
        },
        "logo": {
          "type": "string",
          "format": "uri",
          "description": "URL to store logo"
        },
        "categories": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Product categories this store serves"
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$",
          "description": "Default ISO 4217 currency code"
        },
        "locale": {
          "type": "string",
          "pattern": "^[a-z]{2}(-[A-Z]{2})?$",
          "description": "Default locale (e.g. en-US)"
        }
      },
      "additionalProperties": false
    },
    "capabilities": {
      "type": "object",
      "required": ["products", "product"],
      "properties": {
        "products": {
          "type": "string",
          "description": "Paginated product feed endpoint (required)"
        },
        "product": {
          "type": "string",
          "description": "Single product endpoint with {id} placeholder (required)"
        },
        "search": {
          "type": "string",
          "description": "Search endpoint (optional)"
        },
        "inventory": {
          "type": "string",
          "description": "Real-time inventory endpoint (optional)"
        },
        "cart": {
          "type": "string",
          "description": "Add-to-cart endpoint (optional)"
        },
        "checkout": {
          "type": "string",
          "description": "Initiate checkout endpoint (optional)"
        }
      },
      "additionalProperties": false
    },
    "auth": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["none", "api_key", "bearer", "oauth2"],
          "description": "Authentication method"
        },
        "registration": {
          "type": "string",
          "format": "uri",
          "description": "URL where agents can register for credentials"
        }
      },
      "additionalProperties": false
    },
    "rate_limits": {
      "type": "object",
      "properties": {
        "requests_per_minute": {
          "type": "integer",
          "minimum": 1,
          "description": "Max requests per minute"
        },
        "burst": {
          "type": "integer",
          "minimum": 1,
          "description": "Max burst requests"
        }
      },
      "additionalProperties": false
    },
    "data_policy": {
      "type": "object",
      "properties": {
        "cache_ttl": {
          "type": "integer",
          "minimum": 0,
          "description": "Recommended cache TTL in seconds"
        },
        "attribution_required": {
          "type": "boolean",
          "description": "Whether attribution is required when displaying products"
        },
        "commercial_use": {
          "type": "boolean",
          "description": "Whether commercial use of product data is permitted"
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/validator/src/schema/agora-manifest.schema.json
git commit -m "feat: add Agora manifest JSON Schema (v1.0)"
```

---

## Task 2: JSON Schema — Product Format

**Files:**
- Create: `packages/validator/src/schema/agora-product.schema.json`

- [ ] **Step 1: Create the product JSON Schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://protocol.agora.dev/v1/agora-product.schema.json",
  "title": "Agora Product",
  "description": "Schema for products returned by Agora Protocol endpoints",
  "type": "object",
  "required": ["id", "url", "name", "pricing", "availability"],
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Unique product identifier within the store"
    },
    "url": {
      "type": "string",
      "format": "uri",
      "description": "Canonical product page URL"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500,
      "description": "Product name"
    },
    "description": {
      "type": "string",
      "maxLength": 5000,
      "description": "Product description (plain text)"
    },
    "brand": {
      "type": "string",
      "description": "Brand or manufacturer name"
    },
    "pricing": {
      "type": "object",
      "required": ["amount", "currency"],
      "properties": {
        "amount": {
          "type": "string",
          "pattern": "^\\d+\\.\\d{2}$",
          "description": "Price as decimal string (e.g. 189.99)"
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$",
          "description": "ISO 4217 currency code"
        },
        "compare_at": {
          "type": "string",
          "pattern": "^\\d+\\.\\d{2}$",
          "description": "Original/MSRP price for showing discounts"
        },
        "unit_pricing": {
          "type": "object",
          "required": ["amount", "unit"],
          "properties": {
            "amount": {
              "type": "string",
              "pattern": "^\\d+\\.\\d{2}$"
            },
            "unit": {
              "type": "string",
              "description": "Unit of measure (e.g. oz, lb, kg)"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "availability": {
      "type": "object",
      "required": ["status"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["in_stock", "out_of_stock", "preorder", "backorder"],
          "description": "Current availability status"
        },
        "quantity": {
          "type": "integer",
          "minimum": 0,
          "description": "Exact quantity available"
        },
        "lead_time_days": {
          "type": ["integer", "null"],
          "minimum": 0,
          "description": "Estimated days until available (preorder/backorder)"
        },
        "regions": {
          "type": "array",
          "items": { "type": "string", "pattern": "^[A-Z]{2}$" },
          "description": "ISO 3166-1 alpha-2 country codes where available"
        }
      },
      "additionalProperties": false
    },
    "images": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["url"],
        "properties": {
          "url": {
            "type": "string",
            "format": "uri",
            "description": "Image URL"
          },
          "alt": {
            "type": "string",
            "description": "Alt text for accessibility"
          },
          "role": {
            "type": "string",
            "enum": ["primary", "gallery", "swatch", "lifestyle"],
            "description": "Image role in the product listing"
          }
        },
        "additionalProperties": false
      }
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "slug"],
        "properties": {
          "name": { "type": "string" },
          "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "parent": { "type": "string", "pattern": "^[a-z0-9-]+$" }
        },
        "additionalProperties": false
      }
    },
    "attributes": {
      "type": "object",
      "additionalProperties": {
        "oneOf": [
          { "type": "string" },
          { "type": "array", "items": { "type": "string" } }
        ]
      },
      "description": "Key-value product attributes (e.g. color, size, material)"
    },
    "variants": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "attributes"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "attributes": {
            "type": "object",
            "additionalProperties": { "type": "string" }
          },
          "pricing": {
            "$ref": "#/properties/pricing"
          },
          "availability": {
            "$ref": "#/properties/availability"
          }
        },
        "additionalProperties": false
      }
    },
    "identifiers": {
      "type": "object",
      "properties": {
        "gtin": { "type": ["string", "null"] },
        "upc": { "type": ["string", "null"] },
        "isbn": { "type": ["string", "null"] },
        "asin": { "type": ["string", "null"] },
        "mpn": { "type": ["string", "null"] }
      },
      "additionalProperties": false,
      "description": "Standard product identifiers for cross-store matching"
    },
    "reviews": {
      "type": "object",
      "properties": {
        "average_rating": {
          "type": "number",
          "minimum": 0,
          "maximum": 5
        },
        "count": {
          "type": "integer",
          "minimum": 0
        },
        "url": {
          "type": "string",
          "format": "uri"
        }
      },
      "additionalProperties": false
    },
    "shipping": {
      "type": "object",
      "properties": {
        "free_shipping": { "type": "boolean" },
        "free_shipping_minimum": {
          "type": "string",
          "pattern": "^\\d+\\.\\d{2}$"
        },
        "estimated_days": {
          "type": "object",
          "required": ["min", "max"],
          "properties": {
            "min": { "type": "integer", "minimum": 0 },
            "max": { "type": "integer", "minimum": 0 }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": { "type": "string", "format": "date-time" },
        "updated_at": { "type": "string", "format": "date-time" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/validator/src/schema/agora-product.schema.json
git commit -m "feat: add Agora product JSON Schema (v1.0)"
```

---

## Task 3: Validator Package Scaffolding

**Files:**
- Create: `packages/validator/package.json`
- Create: `packages/validator/tsconfig.json`
- Create: `packages/validator/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@agora/validator",
  "version": "0.1.0",
  "description": "Validate agora.json manifests and product feeds against the Agora Protocol spec",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/rbtbuilds/agora",
    "directory": "packages/validator"
  },
  "keywords": ["agora", "protocol", "validator", "e-commerce", "ai-agents", "json-schema"],
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "agora-validator": "dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ajv": "^8.17",
    "ajv-formats": "^3.0"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "@types/node": "^22"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create types.ts**

```typescript
// packages/validator/src/types.ts

/** Result of a single validation check */
export interface ValidationCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

/** Result of validating a manifest */
export interface ManifestValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  manifest: AgoraManifest | null;
}

/** Result of validating a product */
export interface ProductValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
}

/** Result of validating an entire store */
export interface StoreValidationResult {
  url: string;
  valid: boolean;
  score: number; // 0-100
  checks: ValidationCheck[];
  manifest: AgoraManifest | null;
  productsSampled: number;
  productErrors: number;
}

/** Parsed agora.json manifest */
export interface AgoraManifest {
  $schema?: string;
  version: string;
  store: {
    name: string;
    url: string;
    description?: string;
    logo?: string;
    categories?: string[];
    currency?: string;
    locale?: string;
  };
  capabilities: {
    products: string;
    product: string;
    search?: string;
    inventory?: string;
    cart?: string;
    checkout?: string;
  };
  auth?: {
    type: "none" | "api_key" | "bearer" | "oauth2";
    registration?: string;
  };
  rate_limits?: {
    requests_per_minute?: number;
    burst?: number;
  };
  data_policy?: {
    cache_ttl?: number;
    attribution_required?: boolean;
    commercial_use?: boolean;
  };
}

/** Product conforming to the Agora Protocol */
export interface AgoraProduct {
  id: string;
  url: string;
  name: string;
  description?: string;
  brand?: string;
  pricing: {
    amount: string;
    currency: string;
    compare_at?: string;
    unit_pricing?: { amount: string; unit: string };
  };
  availability: {
    status: "in_stock" | "out_of_stock" | "preorder" | "backorder";
    quantity?: number;
    lead_time_days?: number | null;
    regions?: string[];
  };
  images?: Array<{
    url: string;
    alt?: string;
    role?: "primary" | "gallery" | "swatch" | "lifestyle";
  }>;
  categories?: Array<{
    name: string;
    slug: string;
    parent?: string;
  }>;
  attributes?: Record<string, string | string[]>;
  variants?: Array<{
    id: string;
    attributes: Record<string, string>;
    pricing?: AgoraProduct["pricing"];
    availability?: AgoraProduct["availability"];
  }>;
  identifiers?: {
    gtin?: string | null;
    upc?: string | null;
    isbn?: string | null;
    asin?: string | null;
    mpn?: string | null;
  };
  reviews?: {
    average_rating?: number;
    count?: number;
    url?: string;
  };
  shipping?: {
    free_shipping?: boolean;
    free_shipping_minimum?: string;
    estimated_days?: { min: number; max: number };
  };
  metadata?: {
    created_at?: string;
    updated_at?: string;
    tags?: string[];
  };
}
```

- [ ] **Step 4: Install dependencies and commit**

```bash
cd packages/validator && npm install
git add packages/validator/package.json packages/validator/tsconfig.json packages/validator/src/types.ts
git commit -m "feat: scaffold @agora/validator package with types"
```

---

## Task 4: Manifest Validator

**Files:**
- Create: `packages/validator/src/validate-manifest.ts`
- Create: `packages/validator/test/validate-manifest.test.ts`
- Create: `packages/validator/test/fixtures/valid-manifest.json`
- Create: `packages/validator/test/fixtures/minimal-manifest.json`
- Create: `packages/validator/test/fixtures/invalid-manifest-missing-store.json`
- Create: `packages/validator/test/fixtures/invalid-manifest-no-products-cap.json`

- [ ] **Step 1: Create test fixtures**

`test/fixtures/valid-manifest.json`:
```json
{
  "$schema": "https://protocol.agora.dev/v1/schema.json",
  "version": "1.0",
  "store": {
    "name": "Test Store",
    "url": "https://example.com",
    "description": "A test store",
    "categories": ["apparel", "shoes"],
    "currency": "USD",
    "locale": "en-US"
  },
  "capabilities": {
    "products": "/api/agora/products",
    "product": "/api/agora/products/{id}",
    "search": "/api/agora/search"
  },
  "auth": {
    "type": "none"
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "burst": 10
  },
  "data_policy": {
    "cache_ttl": 3600,
    "attribution_required": true,
    "commercial_use": true
  }
}
```

`test/fixtures/minimal-manifest.json`:
```json
{
  "version": "1.0",
  "store": {
    "name": "Minimal Store",
    "url": "https://minimal.example.com"
  },
  "capabilities": {
    "products": "/products",
    "product": "/products/{id}"
  }
}
```

`test/fixtures/invalid-manifest-missing-store.json`:
```json
{
  "version": "1.0",
  "capabilities": {
    "products": "/products",
    "product": "/products/{id}"
  }
}
```

`test/fixtures/invalid-manifest-no-products-cap.json`:
```json
{
  "version": "1.0",
  "store": {
    "name": "Bad Store",
    "url": "https://bad.example.com"
  },
  "capabilities": {
    "search": "/search"
  }
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// packages/validator/test/validate-manifest.test.ts
import { describe, it, expect } from "vitest";
import { validateManifest } from "../src/validate-manifest.js";

import validManifest from "./fixtures/valid-manifest.json";
import minimalManifest from "./fixtures/minimal-manifest.json";
import missingStore from "./fixtures/invalid-manifest-missing-store.json";
import noProductsCap from "./fixtures/invalid-manifest-no-products-cap.json";

describe("validateManifest", () => {
  it("accepts a fully valid manifest", () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest).not.toBeNull();
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("accepts a minimal manifest with only required fields", () => {
    const result = validateManifest(minimalManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest?.store.name).toBe("Minimal Store");
  });

  it("rejects a manifest missing the store field", () => {
    const result = validateManifest(missingStore);
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.status === "fail")).toBe(true);
  });

  it("rejects a manifest missing required capabilities", () => {
    const result = validateManifest(noProductsCap);
    expect(result.valid).toBe(false);
    const failCheck = result.checks.find((c) => c.status === "fail");
    expect(failCheck?.message).toContain("products");
  });

  it("warns on missing optional fields like auth and rate_limits", () => {
    const result = validateManifest(minimalManifest);
    const warns = result.checks.filter((c) => c.status === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns.some((w) => w.name === "auth")).toBe(true);
  });

  it("rejects non-object input", () => {
    const result = validateManifest("not an object" as any);
    expect(result.valid).toBe(false);
  });

  it("rejects null input", () => {
    const result = validateManifest(null as any);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/validator && npx vitest run test/validate-manifest.test.ts
```

Expected: FAIL — `validate-manifest.js` module not found.

- [ ] **Step 4: Implement validate-manifest.ts**

```typescript
// packages/validator/src/validate-manifest.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";
import manifestSchema from "./schema/agora-manifest.schema.json" with { type: "json" };
import type { ManifestValidationResult, ValidationCheck, AgoraManifest } from "./types.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(manifestSchema);

export function validateManifest(data: unknown): ManifestValidationResult {
  const checks: ValidationCheck[] = [];

  // Basic type check
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    checks.push({
      name: "type",
      status: "fail",
      message: "Manifest must be a JSON object",
    });
    return { valid: false, checks, manifest: null };
  }

  // JSON Schema validation
  const schemaValid = validate(data);

  if (!schemaValid && validate.errors) {
    for (const err of validate.errors) {
      const path = err.instancePath || "(root)";
      const msg = err.message || "unknown error";
      checks.push({
        name: `schema${path}`,
        status: "fail",
        message: `${path}: ${msg}`,
      });
    }
    return { valid: false, checks, manifest: null };
  }

  checks.push({
    name: "schema",
    status: "pass",
    message: "Manifest conforms to JSON Schema",
  });

  const manifest = data as AgoraManifest;

  // Version check
  checks.push({
    name: "version",
    status: manifest.version === "1.0" ? "pass" : "fail",
    message: manifest.version === "1.0"
      ? "Version 1.0 supported"
      : `Unsupported version: ${manifest.version}`,
  });

  // Required capabilities
  if (manifest.capabilities.products && manifest.capabilities.product) {
    checks.push({
      name: "capabilities",
      status: "pass",
      message: "Required capabilities (products, product) present",
    });
  }

  // Optional capability warnings
  const optionalCaps = ["search", "inventory", "cart", "checkout"] as const;
  const presentOptional = optionalCaps.filter(
    (cap) => manifest.capabilities[cap]
  );
  if (presentOptional.length < optionalCaps.length) {
    const missing = optionalCaps.filter((cap) => !manifest.capabilities[cap]);
    checks.push({
      name: "optional_capabilities",
      status: "warn",
      message: `Optional capabilities not declared: ${missing.join(", ")}`,
    });
  }

  // Auth warning
  if (!manifest.auth) {
    checks.push({
      name: "auth",
      status: "warn",
      message: "No auth section — agents will assume public access",
    });
  } else {
    checks.push({
      name: "auth",
      status: "pass",
      message: `Auth type: ${manifest.auth.type}`,
    });
  }

  // Rate limits warning
  if (!manifest.rate_limits) {
    checks.push({
      name: "rate_limits",
      status: "warn",
      message: "No rate_limits section — agents may not throttle appropriately",
    });
  } else {
    checks.push({
      name: "rate_limits",
      status: "pass",
      message: `Rate limit: ${manifest.rate_limits.requests_per_minute} req/min`,
    });
  }

  // Data policy warning
  if (!manifest.data_policy) {
    checks.push({
      name: "data_policy",
      status: "warn",
      message: "No data_policy section — agents will use default caching behavior",
    });
  } else {
    checks.push({
      name: "data_policy",
      status: "pass",
      message: `Cache TTL: ${manifest.data_policy.cache_ttl ?? "unset"}s`,
    });
  }

  const valid = checks.every((c) => c.status !== "fail");
  return { valid, checks, manifest: valid ? manifest : null };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/validator && npx vitest run test/validate-manifest.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/validator/src/validate-manifest.ts packages/validator/test/
git commit -m "feat: implement manifest validator with tests"
```

---

## Task 5: Product Validator

**Files:**
- Create: `packages/validator/src/validate-product.ts`
- Create: `packages/validator/test/validate-product.test.ts`
- Create: `packages/validator/test/fixtures/valid-product.json`
- Create: `packages/validator/test/fixtures/invalid-product-no-id.json`

- [ ] **Step 1: Create test fixtures**

`test/fixtures/valid-product.json`:
```json
{
  "id": "sku-hiking-boot-001",
  "url": "https://example.com/products/hiking-boot",
  "name": "Alpine Pro Waterproof Hiking Boot",
  "description": "Full-grain leather hiking boot with Gore-Tex lining",
  "brand": "TrailMaster",
  "pricing": {
    "amount": "189.99",
    "currency": "USD",
    "compare_at": "229.99"
  },
  "availability": {
    "status": "in_stock",
    "quantity": 47,
    "regions": ["US", "CA"]
  },
  "images": [
    {
      "url": "https://example.com/img/boot-1.jpg",
      "alt": "Alpine Pro boot side view",
      "role": "primary"
    }
  ],
  "categories": [
    { "name": "Footwear", "slug": "footwear" },
    { "name": "Hiking", "slug": "hiking", "parent": "footwear" }
  ],
  "attributes": {
    "color": ["Brown", "Black"],
    "size": ["8", "9", "10", "11", "12"],
    "material": "Full-grain leather"
  },
  "variants": [
    {
      "id": "sku-hiking-boot-001-brown-10",
      "attributes": { "color": "Brown", "size": "10" },
      "pricing": { "amount": "189.99", "currency": "USD" },
      "availability": { "status": "in_stock", "quantity": 12 }
    }
  ],
  "identifiers": {
    "gtin": "0123456789012",
    "asin": "B001EXAMPLE"
  },
  "reviews": {
    "average_rating": 4.6,
    "count": 342
  },
  "shipping": {
    "free_shipping": true,
    "estimated_days": { "min": 3, "max": 7 }
  },
  "metadata": {
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2026-04-06T14:30:00Z",
    "tags": ["waterproof", "hiking", "bestseller"]
  }
}
```

`test/fixtures/invalid-product-no-id.json`:
```json
{
  "url": "https://example.com/products/bad",
  "name": "Missing ID Product",
  "pricing": { "amount": "29.99", "currency": "USD" },
  "availability": { "status": "in_stock" }
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// packages/validator/test/validate-product.test.ts
import { describe, it, expect } from "vitest";
import { validateProduct } from "../src/validate-product.js";

import validProduct from "./fixtures/valid-product.json";
import invalidNoId from "./fixtures/invalid-product-no-id.json";

describe("validateProduct", () => {
  it("accepts a fully valid product", () => {
    const result = validateProduct(validProduct);
    expect(result.valid).toBe(true);
    expect(result.checks.every((c) => c.status !== "fail")).toBe(true);
  });

  it("accepts a minimal product with only required fields", () => {
    const minimal = {
      id: "prod-001",
      url: "https://example.com/products/minimal",
      name: "Minimal Product",
      pricing: { amount: "9.99", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(minimal);
    expect(result.valid).toBe(true);
  });

  it("rejects a product missing the id field", () => {
    const result = validateProduct(invalidNoId);
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.status === "fail")).toBe(true);
  });

  it("rejects a product with invalid price format", () => {
    const badPrice = {
      id: "prod-bad",
      url: "https://example.com/products/bad",
      name: "Bad Price",
      pricing: { amount: "19.9", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(badPrice);
    expect(result.valid).toBe(false);
  });

  it("rejects a product with invalid availability status", () => {
    const badAvail = {
      id: "prod-bad",
      url: "https://example.com/products/bad",
      name: "Bad Avail",
      pricing: { amount: "19.99", currency: "USD" },
      availability: { status: "maybe" },
    };
    const result = validateProduct(badAvail);
    expect(result.valid).toBe(false);
  });

  it("warns when optional enrichment fields are missing", () => {
    const minimal = {
      id: "prod-001",
      url: "https://example.com/products/minimal",
      name: "Minimal Product",
      pricing: { amount: "9.99", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(minimal);
    const warns = result.checks.filter((c) => c.status === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns.some((w) => w.name === "identifiers")).toBe(true);
  });

  it("rejects non-object input", () => {
    const result = validateProduct(42 as any);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/validator && npx vitest run test/validate-product.test.ts
```

Expected: FAIL — `validate-product.js` module not found.

- [ ] **Step 4: Implement validate-product.ts**

```typescript
// packages/validator/src/validate-product.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";
import productSchema from "./schema/agora-product.schema.json" with { type: "json" };
import type { ProductValidationResult, ValidationCheck } from "./types.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(productSchema);

export function validateProduct(data: unknown): ProductValidationResult {
  const checks: ValidationCheck[] = [];

  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    checks.push({
      name: "type",
      status: "fail",
      message: "Product must be a JSON object",
    });
    return { valid: false, checks };
  }

  const schemaValid = validate(data);

  if (!schemaValid && validate.errors) {
    for (const err of validate.errors) {
      const path = err.instancePath || "(root)";
      const msg = err.message || "unknown error";
      checks.push({
        name: `schema${path}`,
        status: "fail",
        message: `${path}: ${msg}`,
      });
    }
    return { valid: false, checks };
  }

  checks.push({
    name: "schema",
    status: "pass",
    message: "Product conforms to JSON Schema",
  });

  const product = data as Record<string, unknown>;

  // Warn on missing optional enrichment fields
  const enrichmentFields = ["images", "categories", "identifiers", "reviews", "shipping"] as const;
  for (const field of enrichmentFields) {
    if (!product[field]) {
      checks.push({
        name: field,
        status: "warn",
        message: `Optional field "${field}" not present — agents get better results with it`,
      });
    } else {
      checks.push({
        name: field,
        status: "pass",
        message: `"${field}" present`,
      });
    }
  }

  // Warn if no variants
  if (!product.variants || (Array.isArray(product.variants) && product.variants.length === 0)) {
    checks.push({
      name: "variants",
      status: "warn",
      message: "No variants — agents can't filter by size/color",
    });
  } else {
    checks.push({
      name: "variants",
      status: "pass",
      message: `${(product.variants as unknown[]).length} variant(s)`,
    });
  }

  const valid = checks.every((c) => c.status !== "fail");
  return { valid, checks };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/validator && npx vitest run test/validate-product.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/validator/src/validate-product.ts packages/validator/test/
git commit -m "feat: implement product validator with tests"
```

---

## Task 6: Store Validator (End-to-End)

**Files:**
- Create: `packages/validator/src/validate-store.ts`
- Create: `packages/validator/test/validate-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/validator/test/validate-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateStore } from "../src/validate-store.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_MANIFEST = {
  version: "1.0",
  store: { name: "Test Store", url: "https://test.example.com" },
  capabilities: {
    products: "/api/agora/products",
    product: "/api/agora/products/{id}",
  },
};

const VALID_PRODUCT = {
  id: "prod-001",
  url: "https://test.example.com/products/test",
  name: "Test Product",
  pricing: { amount: "29.99", currency: "USD" },
  availability: { status: "in_stock" },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("validateStore", () => {
  it("validates a store with valid manifest and products", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(VALID_MANIFEST),
        });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [VALID_PRODUCT], meta: { total: 1 } }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await validateStore("https://test.example.com");
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.manifest).not.toBeNull();
  });

  it("fails when agora.json is not found", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await validateStore("https://missing.example.com");
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.name === "discovery" && c.status === "fail")).toBe(true);
  });

  it("fails when agora.json is invalid JSON", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error("invalid json")),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await validateStore("https://badjson.example.com");
    expect(result.valid).toBe(false);
  });

  it("warns when products endpoint returns no data", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(VALID_MANIFEST),
        });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], meta: { total: 0 } }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await validateStore("https://empty.example.com");
    expect(result.valid).toBe(true); // manifest is valid even if no products
    expect(result.checks.some((c) => c.status === "warn")).toBe(true);
    expect(result.productsSampled).toBe(0);
  });

  it("reports product validation errors", async () => {
    const badProduct = { name: "No ID Product" }; // missing required fields
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/.well-known/agora.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(VALID_MANIFEST),
        });
      }
      if (url.includes("/api/agora/products")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [badProduct], meta: { total: 1 } }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const result = await validateStore("https://badproducts.example.com");
    expect(result.productErrors).toBe(1);
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await validateStore("https://down.example.com");
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.name === "discovery" && c.status === "fail")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/validator && npx vitest run test/validate-store.test.ts
```

Expected: FAIL — `validate-store.js` module not found.

- [ ] **Step 3: Implement validate-store.ts**

```typescript
// packages/validator/src/validate-store.ts
import { validateManifest } from "./validate-manifest.js";
import { validateProduct } from "./validate-product.js";
import type { StoreValidationResult, ValidationCheck } from "./types.js";

export async function validateStore(storeUrl: string): Promise<StoreValidationResult> {
  const checks: ValidationCheck[] = [];
  const baseUrl = storeUrl.replace(/\/$/, "");

  // Step 1: Discover agora.json
  let manifestData: unknown;
  try {
    const manifestUrl = `${baseUrl}/.well-known/agora.json`;
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      checks.push({
        name: "discovery",
        status: "fail",
        message: `/.well-known/agora.json returned ${res.status}`,
      });
      return makeResult(baseUrl, false, checks, null, 0, 0);
    }
    manifestData = await res.json();
    checks.push({
      name: "discovery",
      status: "pass",
      message: "/.well-known/agora.json found and parseable",
    });
  } catch (err) {
    checks.push({
      name: "discovery",
      status: "fail",
      message: `Failed to fetch /.well-known/agora.json: ${(err as Error).message}`,
    });
    return makeResult(baseUrl, false, checks, null, 0, 0);
  }

  // Step 2: Validate manifest
  const manifestResult = validateManifest(manifestData);
  checks.push(...manifestResult.checks);

  if (!manifestResult.valid || !manifestResult.manifest) {
    return makeResult(baseUrl, false, checks, null, 0, 0);
  }

  const manifest = manifestResult.manifest;

  // Step 3: Probe required endpoints
  const productsUrl = resolveCapabilityUrl(baseUrl, manifest.capabilities.products);
  let productsSampled = 0;
  let productErrors = 0;

  try {
    const res = await fetch(productsUrl);
    if (!res.ok) {
      checks.push({
        name: "endpoint_products",
        status: "fail",
        message: `Products endpoint returned ${res.status}`,
      });
    } else {
      checks.push({
        name: "endpoint_products",
        status: "pass",
        message: "Products endpoint reachable",
      });

      // Step 4: Validate sampled products
      const body = await res.json();
      const products = body?.data ?? (Array.isArray(body) ? body : []);

      if (products.length === 0) {
        checks.push({
          name: "products_content",
          status: "warn",
          message: "Products endpoint returned no products",
        });
      } else {
        for (const product of products.slice(0, 5)) {
          productsSampled++;
          const productResult = validateProduct(product);
          if (!productResult.valid) {
            productErrors++;
          }
        }
        checks.push({
          name: "products_content",
          status: productErrors === 0 ? "pass" : "warn",
          message: `Sampled ${productsSampled} product(s), ${productErrors} validation error(s)`,
        });
      }
    }
  } catch (err) {
    checks.push({
      name: "endpoint_products",
      status: "fail",
      message: `Failed to reach products endpoint: ${(err as Error).message}`,
    });
  }

  const valid = checks.every((c) => c.status !== "fail");
  return makeResult(baseUrl, valid, checks, manifest, productsSampled, productErrors);
}

function resolveCapabilityUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function makeResult(
  url: string,
  valid: boolean,
  checks: ValidationCheck[],
  manifest: StoreValidationResult["manifest"],
  productsSampled: number,
  productErrors: number,
): StoreValidationResult {
  const total = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { url, valid, score, checks, manifest, productsSampled, productErrors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/validator && npx vitest run test/validate-store.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/validator/src/validate-store.ts packages/validator/test/validate-store.test.ts
git commit -m "feat: implement end-to-end store validator with tests"
```

---

## Task 7: Validator Public API and CLI

**Files:**
- Create: `packages/validator/src/index.ts`
- Create: `packages/validator/src/cli.ts`

- [ ] **Step 1: Create the public API entry point**

```typescript
// packages/validator/src/index.ts
export { validateManifest } from "./validate-manifest.js";
export { validateProduct } from "./validate-product.js";
export { validateStore } from "./validate-store.js";
export type {
  AgoraManifest,
  AgoraProduct,
  ValidationCheck,
  ManifestValidationResult,
  ProductValidationResult,
  StoreValidationResult,
} from "./types.js";
```

- [ ] **Step 2: Create the CLI**

```typescript
// packages/validator/src/cli.ts
#!/usr/bin/env node
import { validateStore } from "./validate-store.js";

const url = process.argv[2];

if (!url) {
  console.error("Usage: agora-validator <store-url>");
  console.error("Example: agora-validator https://example.com");
  process.exit(1);
}

async function main() {
  console.log(`\nValidating ${url}...\n`);

  const result = await validateStore(url);

  for (const check of result.checks) {
    const icon = check.status === "pass" ? "\u2713" : check.status === "warn" ? "!" : "\u2717";
    const color =
      check.status === "pass" ? "\x1b[32m" : check.status === "warn" ? "\x1b[33m" : "\x1b[31m";
    console.log(`  ${color}${icon}\x1b[0m ${check.name}: ${check.message}`);
  }

  console.log(`\n  Score: ${result.score}/100`);
  console.log(`  Products sampled: ${result.productsSampled}`);
  console.log(`  Product errors: ${result.productErrors}`);
  console.log(`  Result: ${result.valid ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}\n`);

  process.exit(result.valid ? 0 : 1);
}

main();
```

- [ ] **Step 3: Build the package**

```bash
cd packages/validator && npx tsc
```

Expected: compiles without errors, `dist/` folder created with `.js` and `.d.ts` files.

- [ ] **Step 4: Run all validator tests**

```bash
cd packages/validator && npx vitest run
```

Expected: all tests PASS across all 3 test files.

- [ ] **Step 5: Commit**

```bash
git add packages/validator/src/index.ts packages/validator/src/cli.ts
git commit -m "feat: add validator public API and CLI entry point"
```

---

## Task 8: Dogfood — Serve agora.json on Agora's API

**Files:**
- Modify: `api/index.ts`

- [ ] **Step 1: Write the agora.json manifest for Agora itself**

Add a route to `api/index.ts` that serves the manifest before the auth middleware catches it.

The route goes **before** `app.use("/v1/*", authMiddleware)` and serves `/.well-known/agora.json`:

```typescript
// Add this route AFTER the CORS middleware but BEFORE the auth middleware in api/index.ts

app.get("/.well-known/agora.json", (c) => {
  return c.json({
    $schema: "https://protocol.agora.dev/v1/schema.json",
    version: "1.0",
    store: {
      name: "Agora",
      url: "https://agora-ecru-chi.vercel.app",
      description: "The agent-friendly commerce layer for the internet",
      categories: [
        "apparel", "shoes", "accessories", "home", "food",
        "beauty", "electronics",
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
```

- [ ] **Step 2: Verify the route works locally**

The full `api/index.ts` should have routes in this order:
1. `app.use("*", cors())`
2. `app.get("/.well-known/agora.json", ...)`
3. `app.use("/v1/*", authMiddleware)`
4. `app.get("/", ...)` (landing page)
5. Remaining routes

- [ ] **Step 3: Commit**

```bash
git add api/index.ts
git commit -m "feat: serve agora.json at /.well-known/ (dogfooding)"
```

---

## Task 9: Protocol Documentation

**Files:**
- Create: `docs/protocol/spec.md`
- Create: `docs/protocol/product-schema.md`
- Create: `docs/protocol/getting-started.md`
- Create: `docs/protocol/examples/minimal.json`
- Create: `docs/protocol/examples/full.json`

- [ ] **Step 1: Create spec.md**

Write the full protocol specification. This is the public-facing document that defines the standard. Contents:

1. **Introduction** — What the Agora Protocol is, why it exists (the internet is optimized for human browsers, not AI agents — this gap needs an open standard)
2. **Manifest** — The `agora.json` file, where it lives (`/.well-known/agora.json`), every field documented with types and required/optional
3. **Capabilities** — Each capability (products, product, search, inventory, cart, checkout) with expected request/response formats
4. **Product Schema** — Link to product-schema.md, summary of required vs optional fields
5. **Authentication** — How each auth type works, what agents should expect
6. **Rate Limiting** — How stores declare limits, how agents should respect them
7. **Data Policy** — Cache TTL, attribution, commercial use
8. **Versioning** — How the protocol will evolve (semver-style, backwards compatible within major)
9. **Validation** — How to validate using `@agora/validator`

This should read like an RFC — authoritative, precise, but approachable. Think OpenAPI spec meets JSON Feed spec.

- [ ] **Step 2: Create product-schema.md**

Document every field in the product schema with:
- Field name and path
- Type
- Required or optional
- Description
- Example value
- Why agents care about this field

- [ ] **Step 3: Create getting-started.md**

Adoption guide for store owners:
1. Create your `agora.json` file
2. Serve it at `/.well-known/agora.json`
3. Implement the required `products` and `product` endpoints
4. Validate with `npx @agora/validator https://yourstore.com`
5. Register with Agora (future — Phase 2)

Include a minimal working example and a link to the full example.

- [ ] **Step 4: Create example files**

`examples/minimal.json` — copy from `test/fixtures/minimal-manifest.json` (the minimum viable agora.json)

`examples/full.json` — copy from `test/fixtures/valid-manifest.json` with all optional fields filled in

- [ ] **Step 5: Commit**

```bash
git add docs/protocol/
git commit -m "docs: add Agora Protocol specification, product schema reference, and getting started guide"
```

---

## Task 10: README Rewrite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README**

```bash
cat README.md
```

- [ ] **Step 2: Rewrite the README**

The README should position Agora as infrastructure, not a side project. Structure:

1. **Header** — "Agora: The Open Protocol for Agent Commerce" with a one-line tagline
2. **What is Agora?** — 3 sentences: the problem (internet isn't agent-friendly), the solution (open protocol), what it includes (spec + API + SDK + validator)
3. **For AI Agents** — How to use the API/SDK/MCP server to search and discover products
4. **For Stores** — How to adopt the protocol (link to getting-started.md), validator usage
5. **Protocol** — Link to spec.md, brief overview of capabilities tiers
6. **Architecture** — Monorepo overview, package descriptions
7. **Quick Start** — Developer setup instructions
8. **API Reference** — Endpoint list with examples
9. **Packages** — Table of npm packages with descriptions
10. **Status** — Current metrics (stores, products, protocol version)
11. **License** — MIT

Do NOT include emojis. Professional, authoritative tone. Think "company that's about to get acquired" not "weekend project."

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README — position as open protocol for agent commerce"
```

---

## Task 11: Final Integration Test

**Files:** None created — verification only.

- [ ] **Step 1: Build all packages**

```bash
cd /path/to/agora && npm run build
```

Expected: all packages compile without errors.

- [ ] **Step 2: Run all tests**

```bash
npm run test
```

Expected: all tests pass across all packages.

- [ ] **Step 3: Verify validator can validate Agora's own manifest**

Use the validator fixture test approach — create a quick test that validates the manifest from Task 8 against the schema:

```bash
cd packages/validator && node -e "
import { validateManifest } from './dist/index.js';
const manifest = {
  version: '1.0',
  store: { name: 'Agora', url: 'https://agora-ecru-chi.vercel.app' },
  capabilities: { products: '/v1/products/search?q=*', product: '/v1/products/{id}', search: '/v1/products/search' },
  auth: { type: 'bearer', registration: 'https://portal-opal-two.vercel.app' },
  rate_limits: { requests_per_minute: 60, burst: 10 },
  data_policy: { cache_ttl: 3600, attribution_required: false, commercial_use: true },
};
const result = validateManifest(manifest);
console.log('Valid:', result.valid);
console.log('Score:', result.checks.filter(c => c.status === 'pass').length + '/' + result.checks.length);
if (!result.valid) { console.error('ERRORS:', result.checks.filter(c => c.status === 'fail')); process.exit(1); }
"
```

Expected: `Valid: true`

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: integration test fixes" # only if changes were made
```
