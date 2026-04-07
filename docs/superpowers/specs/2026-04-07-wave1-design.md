# Wave 1: OpenAPI Spec, Protocol Registry, Store Analytics — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Feature 1: OpenAPI Spec

Hand-written OpenAPI 3.1 spec at `docs/openapi.yaml` documenting all API endpoints. Served at `GET /openapi.json` from the API (no auth required). Covers: products search, product detail, similar products, categories, store registration, store listing, store detail, protocol manifest. Includes schemas for Product, Store, Error, and all response wrappers.

## Feature 2: Protocol Registry

Make store listing and detail publicly accessible (no auth). Add search/filter capabilities and a network stats endpoint.

**Changes:**
- Mount `GET /v1/stores` and `GET /v1/stores/:id` outside auth middleware (public)
- `POST /v1/stores/register` stays behind auth
- Add query params to listing: `?q=` (name search), `?category=`, `?source=native|scraped`, `?sort=products|score|newest`
- Add `GET /v1/registry/stats` — total stores, total products, native vs scraped counts, total agent queries
- Enrich store listings with aggregate analytics (query count from Feature 3)

## Feature 3: Store Analytics

Track agent queries per store with daily rollups.

**New table:**
```sql
CREATE TABLE store_analytics (
  id SERIAL PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  UNIQUE(store_id, date)
);
```

**Middleware hook:** After search/product-detail requests return results, async-increment `store_analytics` for each store represented in the results.

**Public aggregate:** Store listings include `queries_this_week` and `total_queries`.

**Public endpoint:** `GET /v1/stores/:id/analytics` — returns weekly summary.

## File Changes

**New:**
- `docs/openapi.yaml` — OpenAPI 3.1 spec
- `packages/api/src/routes/registry.ts` — Public registry + stats routes
- `packages/api/src/middleware/analytics.ts` — Async store analytics tracking
- `packages/api/test/registry.test.ts` — Registry endpoint tests

**Modified:**
- `packages/db/src/schema.ts` — Add `storeAnalytics` table
- `api/index.ts` — Serve `/openapi.json`, mount public registry routes outside auth, add analytics middleware
- `packages/api/src/routes/stores.ts` — Keep only `POST /register` (auth-required)
