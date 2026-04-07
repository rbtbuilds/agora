# Product Schema Reference

This document is the complete field-by-field reference for the Agora Protocol Product object. For a summary of required vs. optional fields, see [spec.md](./spec.md#4-product-schema).

---

## Top-Level Fields

### `id`

| | |
|---|---|
| **JSON path** | `id` |
| **Type** | string |
| **Required** | Yes |
| **Description** | A unique identifier for this product within the store. Must be stable — agents cache data by ID and will detect changes. |
| **Example** | `"prod_7a3f91bc"` |
| **Agent value** | Used to construct requests to the `product` capability endpoint and to deduplicate results across paginated feeds. |

---

### `url`

| | |
|---|---|
| **JSON path** | `url` |
| **Type** | string (URL) |
| **Required** | Yes |
| **Description** | The canonical URL of the product page on the store's website. |
| **Example** | `"https://ironkettlecoffee.com/products/single-origin-ethiopia"` |
| **Agent value** | Used for attribution and to direct users to the product page for final purchase confirmation. |

---

### `name`

| | |
|---|---|
| **JSON path** | `name` |
| **Type** | string |
| **Required** | Yes |
| **Description** | The full product name as displayed to customers. |
| **Example** | `"Ethiopia Yirgacheffe Single Origin — 12 oz"` |
| **Agent value** | Primary signal for semantic matching against user queries. Should be descriptive and include key differentiators (size, variety, etc.). |

---

### `description`

| | |
|---|---|
| **JSON path** | `description` |
| **Type** | string |
| **Required** | No |
| **Description** | Full product description. Plain text preferred; HTML is permitted but agents will treat it as plain text. |
| **Example** | `"A light-roast single origin from the Gedeo Zone highlands. Notes of jasmine, bergamot, and stone fruit. Sourced directly from the Kochere cooperative."` |
| **Agent value** | Used for semantic search, feature extraction, and answering user questions about the product. Richer descriptions yield better agent matching. |

---

### `brand`

| | |
|---|---|
| **JSON path** | `brand` |
| **Type** | string |
| **Required** | No |
| **Description** | The brand or manufacturer name. |
| **Example** | `"Iron Kettle Coffee"` |
| **Agent value** | Enables brand-scoped queries ("find me Iron Kettle products") and trust signals in comparison scenarios. |

---

## `pricing`

The `pricing` object is required. It must contain at minimum `amount` and `currency`.

### `pricing.amount`

| | |
|---|---|
| **JSON path** | `pricing.amount` |
| **Type** | string |
| **Required** | Yes |
| **Description** | The current selling price as a string to avoid floating-point precision issues. |
| **Example** | `"18.00"` |
| **Agent value** | Core to any purchase decision, price comparison, or budget filtering. |

---

### `pricing.currency`

| | |
|---|---|
| **JSON path** | `pricing.currency` |
| **Type** | string (ISO 4217) |
| **Required** | Yes |
| **Description** | Three-letter ISO 4217 currency code. |
| **Example** | `"USD"` |
| **Agent value** | Required for cross-store price comparison and budget calculations. |

---

### `pricing.compare_at`

| | |
|---|---|
| **JSON path** | `pricing.compare_at` |
| **Type** | string |
| **Required** | No |
| **Description** | The original or reference price before a discount. If present and higher than `amount`, the product is on sale. |
| **Example** | `"24.00"` |
| **Agent value** | Allows agents to identify and surface sale items, calculate discount percentages, and respond to "find deals" queries. |

---

### `pricing.unit_pricing`

| | |
|---|---|
| **JSON path** | `pricing.unit_pricing` |
| **Type** | object |
| **Required** | No |
| **Description** | Price expressed per unit of measure, for comparison across different sizes or quantities. |
| **Example** | `{ "amount": "1.50", "unit": "oz" }` |
| **Agent value** | Enables value-per-unit comparisons (e.g., cost per ounce across different bag sizes). |

`pricing.unit_pricing` fields:

| Field | Type | Description |
|---|---|---|
| `amount` | string | Price per unit |
| `unit` | string | Unit of measure (e.g., `"oz"`, `"kg"`, `"ml"`, `"item"`) |

---

## `availability`

The `availability` object is required.

### `availability.status`

| | |
|---|---|
| **JSON path** | `availability.status` |
| **Type** | string (enum) |
| **Required** | Yes |
| **Description** | Current availability status. Must be one of: `in_stock`, `out_of_stock`, `preorder`, `backorder`, `discontinued`. |
| **Example** | `"in_stock"` |
| **Agent value** | The first filter agents apply. Most agents will not surface `out_of_stock` or `discontinued` products unless explicitly asked. |

---

### `availability.quantity`

| | |
|---|---|
| **JSON path** | `availability.quantity` |
| **Type** | integer |
| **Required** | No |
| **Description** | Number of units currently in stock. Omit if stock tracking is not available. |
| **Example** | `143` |
| **Agent value** | Enables "check if there are at least N units available" logic and surfaces low-stock signals. |

---

### `availability.lead_time_days`

| | |
|---|---|
| **JSON path** | `availability.lead_time_days` |
| **Type** | integer |
| **Required** | No |
| **Description** | Estimated number of business days until the product ships. Relevant for `preorder` and `backorder` statuses. |
| **Example** | `7` |
| **Agent value** | Used to answer delivery timeline questions and filter results when a user needs something by a specific date. |

---

### `availability.regions`

| | |
|---|---|
| **JSON path** | `availability.regions` |
| **Type** | array of strings |
| **Required** | No |
| **Description** | ISO 3166-1 alpha-2 country codes where this product is available for purchase. If omitted, assume worldwide availability. |
| **Example** | `["US", "CA", "GB"]` |
| **Agent value** | Allows geo-aware agents to filter out products not available in the user's region. |

---

## `images`

An array of image objects. Optional but strongly recommended.

### `images[].url`

| | |
|---|---|
| **JSON path** | `images[n].url` |
| **Type** | string (URL) |
| **Required** | Yes (if images array is present) |
| **Description** | Direct URL to the image file. |
| **Example** | `"https://ironkettlecoffee.com/images/ethiopia-12oz-front.jpg"` |
| **Agent value** | Used when an agent needs to display or describe a product visually. |

---

### `images[].alt`

| | |
|---|---|
| **JSON path** | `images[n].alt` |
| **Type** | string |
| **Required** | No |
| **Description** | Alt text describing the image. |
| **Example** | `"Front of Ethiopia Yirgacheffe bag showing tasting notes label"` |
| **Agent value** | Used as a fallback description for agents that cannot process images directly. |

---

### `images[].role`

| | |
|---|---|
| **JSON path** | `images[n].role` |
| **Type** | string |
| **Required** | No |
| **Description** | Semantic role of the image. Suggested values: `primary`, `gallery`, `lifestyle`, `detail`, `packaging`. |
| **Example** | `"primary"` |
| **Agent value** | Allows agents to select the most appropriate image for a given context (e.g., prefer `primary` for search results). |

---

## `categories`

An array of category objects representing the product's taxonomy. Optional.

### `categories[].name`

| | |
|---|---|
| **JSON path** | `categories[n].name` |
| **Type** | string |
| **Required** | Yes (if categories array is present) |
| **Description** | Human-readable category name. |
| **Example** | `"Single Origin Coffee"` |
| **Agent value** | Used for category-scoped queries and browsing. |

---

### `categories[].slug`

| | |
|---|---|
| **JSON path** | `categories[n].slug` |
| **Type** | string |
| **Required** | No |
| **Description** | URL-friendly identifier for the category. |
| **Example** | `"single-origin-coffee"` |
| **Agent value** | Stable identifier for filtering even if category names change. |

---

### `categories[].parent`

| | |
|---|---|
| **JSON path** | `categories[n].parent` |
| **Type** | string |
| **Required** | No |
| **Description** | Slug of the parent category, enabling nested taxonomy. |
| **Example** | `"coffee"` |
| **Agent value** | Allows agents to understand hierarchy ("show me all coffees" should include single-origin items). |

---

## `attributes`

A free-form key-value object for product-specific attributes that don't fit standard fields. Optional.

| | |
|---|---|
| **JSON path** | `attributes` |
| **Type** | object (string keys, string or string[] values) |
| **Required** | No |
| **Description** | Product-specific properties. Keys should be lowercase with underscores. |
| **Example** | `{ "roast_level": "light", "process": "washed", "altitude_masl": "1800-2200" }` |
| **Agent value** | Enables fine-grained filtering and matching against specific user preferences or requirements. |

---

## `variants`

An array of variant objects representing different options for the same product (e.g., size, color). Optional.

### `variants[].id`

| | |
|---|---|
| **JSON path** | `variants[n].id` |
| **Type** | string |
| **Required** | Yes (if variants array is present) |
| **Description** | Unique identifier for this specific variant. |
| **Example** | `"prod_7a3f91bc-12oz-whole"` |
| **Agent value** | Required for add-to-cart and inventory requests targeting a specific variant. |

---

### `variants[].attributes`

| | |
|---|---|
| **JSON path** | `variants[n].attributes` |
| **Type** | object |
| **Required** | No |
| **Description** | The attribute values that distinguish this variant from others. |
| **Example** | `{ "size": "12 oz", "grind": "whole bean" }` |
| **Agent value** | Used to match a user's stated preferences to a specific variant. |

---

### `variants[].pricing`

| | |
|---|---|
| **JSON path** | `variants[n].pricing` |
| **Type** | object |
| **Required** | No |
| **Description** | Pricing for this variant. Uses the same structure as the top-level `pricing` object. If omitted, the parent product's pricing applies. |
| **Example** | `{ "amount": "22.00", "currency": "USD" }` |
| **Agent value** | Allows agents to surface correct pricing per variant rather than displaying potentially incorrect parent pricing. |

---

### `variants[].availability`

| | |
|---|---|
| **JSON path** | `variants[n].availability` |
| **Type** | object |
| **Required** | No |
| **Description** | Availability for this variant. Uses the same structure as the top-level `availability` object. If omitted, the parent product's availability applies. |
| **Example** | `{ "status": "in_stock", "quantity": 24 }` |
| **Agent value** | Allows agents to surface only the variants that are actually purchasable. |

---

## `identifiers`

Standard product identifiers for cross-referencing across systems. Optional but highly recommended.

### `identifiers.gtin`

| | |
|---|---|
| **JSON path** | `identifiers.gtin` |
| **Type** | string |
| **Required** | No |
| **Description** | Global Trade Item Number (includes UPC-A, EAN-13, ISBN-13). |
| **Example** | `"00012345678905"` |
| **Agent value** | The gold standard for cross-store product matching. Enables price comparison and product deduplication across the agent's catalog. |

---

### `identifiers.upc`

| | |
|---|---|
| **JSON path** | `identifiers.upc` |
| **Type** | string |
| **Required** | No |
| **Description** | Universal Product Code (12-digit UPC-A). |
| **Example** | `"012345678905"` |
| **Agent value** | Used for cross-referencing with retail databases and barcode scanning contexts. |

---

### `identifiers.isbn`

| | |
|---|---|
| **JSON path** | `identifiers.isbn` |
| **Type** | string |
| **Required** | No |
| **Description** | International Standard Book Number (for books). ISBN-13 preferred. |
| **Example** | `"9780735224292"` |
| **Agent value** | Enables precise book matching across stores and libraries. |

---

### `identifiers.asin`

| | |
|---|---|
| **JSON path** | `identifiers.asin` |
| **Type** | string |
| **Required** | No |
| **Description** | Amazon Standard Identification Number. |
| **Example** | `"B08N5WRWNW"` |
| **Agent value** | Useful for cross-referencing Amazon listings and for stores that also sell on Amazon. |

---

### `identifiers.mpn`

| | |
|---|---|
| **JSON path** | `identifiers.mpn` |
| **Type** | string |
| **Required** | No |
| **Description** | Manufacturer Part Number. |
| **Example** | `"IKC-ETH-12-WB"` |
| **Agent value** | Enables B2B procurement matching and manufacturer catalog lookups. |

---

## `reviews`

Aggregate review data. Optional.

### `reviews.average_rating`

| | |
|---|---|
| **JSON path** | `reviews.average_rating` |
| **Type** | number |
| **Required** | No |
| **Description** | Average customer rating, typically on a 1–5 scale. Store should document its scale in the manifest or product description if non-standard. |
| **Example** | `4.7` |
| **Agent value** | Used for quality-based filtering and ranking ("show me the highest-rated option"). |

---

### `reviews.count`

| | |
|---|---|
| **JSON path** | `reviews.count` |
| **Type** | integer |
| **Required** | No |
| **Description** | Total number of customer reviews. |
| **Example** | `312` |
| **Agent value** | Provides confidence signal alongside the rating. A 4.7 from 312 reviews is more meaningful than from 3. |

---

### `reviews.url`

| | |
|---|---|
| **JSON path** | `reviews.url` |
| **Type** | string (URL) |
| **Required** | No |
| **Description** | URL to the reviews section of the product page. |
| **Example** | `"https://ironkettlecoffee.com/products/single-origin-ethiopia#reviews"` |
| **Agent value** | Allows agents to direct users to full review content when they want to read detailed feedback. |

---

## `shipping`

Shipping information relevant to purchase decisions. Optional.

### `shipping.free_shipping`

| | |
|---|---|
| **JSON path** | `shipping.free_shipping` |
| **Type** | boolean |
| **Required** | No |
| **Description** | Whether this product ships free (unconditionally). |
| **Example** | `false` |
| **Agent value** | Surfaces free-shipping products when users filter for them. |

---

### `shipping.free_shipping_minimum`

| | |
|---|---|
| **JSON path** | `shipping.free_shipping_minimum` |
| **Type** | string |
| **Required** | No |
| **Description** | Minimum order amount (as a string, in the store's primary currency) to qualify for free shipping. |
| **Example** | `"50.00"` |
| **Agent value** | Allows agents to advise users on how much more to spend to qualify for free shipping. |

---

### `shipping.estimated_days`

| | |
|---|---|
| **JSON path** | `shipping.estimated_days` |
| **Type** | object |
| **Required** | No |
| **Description** | Estimated shipping time range in business days. |
| **Example** | `{ "min": 3, "max": 7 }` |
| **Agent value** | Used for delivery date estimation and filtering by users who need something by a specific date. |

`shipping.estimated_days` fields:

| Field | Type | Description |
|---|---|---|
| `min` | integer | Minimum estimated business days to delivery |
| `max` | integer | Maximum estimated business days to delivery |

---

## `metadata`

System and organizational metadata. Optional.

### `metadata.created_at`

| | |
|---|---|
| **JSON path** | `metadata.created_at` |
| **Type** | string (ISO 8601) |
| **Required** | No |
| **Description** | Timestamp when this product was first listed. |
| **Example** | `"2025-11-01T09:00:00Z"` |
| **Agent value** | Enables "find new arrivals" queries and freshness-based ranking. |

---

### `metadata.updated_at`

| | |
|---|---|
| **JSON path** | `metadata.updated_at` |
| **Type** | string (ISO 8601) |
| **Required** | No |
| **Description** | Timestamp of the most recent update to this product record. |
| **Example** | `"2026-03-15T14:22:00Z"` |
| **Agent value** | Used by agents to determine whether a cached product record is stale. Compared against `data_policy.cache_ttl`. |

---

### `metadata.tags`

| | |
|---|---|
| **JSON path** | `metadata.tags` |
| **Type** | array of strings |
| **Required** | No |
| **Description** | Free-form tags applied to the product by the store operator. |
| **Example** | `["single-origin", "light-roast", "gift", "subscription-eligible"]` |
| **Agent value** | Provides additional semantic signal for matching and filtering beyond structured attributes. |

---

## Full Product Object Example

```json
{
  "id": "prod_7a3f91bc",
  "url": "https://ironkettlecoffee.com/products/single-origin-ethiopia",
  "name": "Ethiopia Yirgacheffe Single Origin — 12 oz",
  "description": "A light-roast single origin from the Gedeo Zone highlands. Notes of jasmine, bergamot, and stone fruit. Sourced directly from the Kochere cooperative.",
  "brand": "Iron Kettle Coffee",
  "pricing": {
    "amount": "18.00",
    "currency": "USD",
    "compare_at": "24.00",
    "unit_pricing": {
      "amount": "1.50",
      "unit": "oz"
    }
  },
  "availability": {
    "status": "in_stock",
    "quantity": 143,
    "lead_time_days": null,
    "regions": ["US", "CA", "GB", "AU"]
  },
  "images": [
    {
      "url": "https://ironkettlecoffee.com/images/ethiopia-12oz-front.jpg",
      "alt": "Front of Ethiopia Yirgacheffe bag",
      "role": "primary"
    },
    {
      "url": "https://ironkettlecoffee.com/images/ethiopia-12oz-detail.jpg",
      "alt": "Tasting notes and origin label detail",
      "role": "detail"
    }
  ],
  "categories": [
    {
      "name": "Single Origin Coffee",
      "slug": "single-origin-coffee",
      "parent": "coffee"
    }
  ],
  "attributes": {
    "roast_level": "light",
    "process": "washed",
    "altitude_masl": "1800-2200",
    "harvest_season": "2025"
  },
  "variants": [
    {
      "id": "prod_7a3f91bc-12oz-whole",
      "attributes": { "size": "12 oz", "grind": "whole bean" },
      "pricing": { "amount": "18.00", "currency": "USD" },
      "availability": { "status": "in_stock", "quantity": 143 }
    },
    {
      "id": "prod_7a3f91bc-12oz-medium",
      "attributes": { "size": "12 oz", "grind": "medium" },
      "pricing": { "amount": "18.00", "currency": "USD" },
      "availability": { "status": "in_stock", "quantity": 87 }
    },
    {
      "id": "prod_7a3f91bc-5lb-whole",
      "attributes": { "size": "5 lb", "grind": "whole bean" },
      "pricing": { "amount": "72.00", "currency": "USD" },
      "availability": { "status": "in_stock", "quantity": 31 }
    }
  ],
  "identifiers": {
    "gtin": "00812345678902",
    "upc": "812345678902",
    "mpn": "IKC-ETH-12-WB"
  },
  "reviews": {
    "average_rating": 4.7,
    "count": 312,
    "url": "https://ironkettlecoffee.com/products/single-origin-ethiopia#reviews"
  },
  "shipping": {
    "free_shipping": false,
    "free_shipping_minimum": "50.00",
    "estimated_days": {
      "min": 3,
      "max": 7
    }
  },
  "metadata": {
    "created_at": "2025-11-01T09:00:00Z",
    "updated_at": "2026-03-15T14:22:00Z",
    "tags": ["single-origin", "light-roast", "gift", "subscription-eligible"]
  }
}
```
