# Phase 3: Demo Data Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bulk up the Agora catalog to 50k+ products from 50+ stores across Shopify and Amazon, making the API demo impressive enough to pitch protocol adoption.

**Architecture:** Expand the existing Shopify crawler with ~40 new stores. Build Amazon anti-bot middleware (playwright-stealth, free proxy rotation, random delays) and an ASIN loader. All new stores get seeded into the `stores` table.

**Tech Stack:** Python, Scrapy, Playwright, playwright-stealth, psycopg2.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `crawler/crawler/middlewares/antibot.py` | Proxy rotation, stealth config, random delays |
| `crawler/crawler/data/shopify_stores.json` | Curated list of ~40 new Shopify store URLs |
| `crawler/crawler/data/asins.json` | Curated ASIN list for Amazon crawling |
| `crawler/crawl_shopify_bulk.py` | Bulk Shopify crawl script (like crawl_new.py but for 40+ stores) |

### Modified Files

| File | Change |
|------|--------|
| `crawler/crawler/spiders/amazon.py` | Add ASIN list loader, category crawling |
| `crawler/crawler/settings.py` | Add antibot middleware, tune concurrency for Amazon |
| `crawler/pyproject.toml` | Add playwright-stealth dependency |

---

## Task 1: Curate Shopify Store List

**Files:**
- Create: `crawler/crawler/data/shopify_stores.json`

- [ ] **Step 1: Create the curated store list**

```json
{
  "stores": [
    { "name": "Gymshark", "url": "https://www.gymshark.com", "category": "fashion" },
    { "name": "Fashion Nova", "url": "https://www.fashionnova.com", "category": "fashion" },
    { "name": "MVMT", "url": "https://www.mvmt.com", "category": "accessories" },
    { "name": "Chubbies", "url": "https://www.chubbiesshorts.com", "category": "fashion" },
    { "name": "Outdoor Voices", "url": "https://www.outdoorvoices.com", "category": "fashion" },
    { "name": "Bombas", "url": "https://bombas.com", "category": "fashion" },
    { "name": "Kotn", "url": "https://kotn.com", "category": "fashion" },
    { "name": "Marine Layer", "url": "https://www.marinelayer.com", "category": "fashion" },
    { "name": "Buck Mason", "url": "https://www.buckmason.com", "category": "fashion" },
    { "name": "Vuori", "url": "https://vuoriclothing.com", "category": "fashion" },
    { "name": "Rhone", "url": "https://www.rhone.com", "category": "fashion" },
    { "name": "True Classic", "url": "https://trueclassictees.com", "category": "fashion" },
    { "name": "Cuts Clothing", "url": "https://www.cutsclothing.com", "category": "fashion" },
    { "name": "Everlane", "url": "https://www.everlane.com", "category": "fashion" },
    { "name": "Reformation", "url": "https://www.thereformation.com", "category": "fashion" },
    { "name": "Glossier", "url": "https://www.glossier.com", "category": "beauty" },
    { "name": "Kylie Cosmetics", "url": "https://kyliecosmetics.com", "category": "beauty" },
    { "name": "Function of Beauty", "url": "https://www.functionofbeauty.com", "category": "beauty" },
    { "name": "Fenty Beauty", "url": "https://fentybeauty.com", "category": "beauty" },
    { "name": "Rare Beauty", "url": "https://www.rarebeauty.com", "category": "beauty" },
    { "name": "Ruggable", "url": "https://ruggable.com", "category": "home" },
    { "name": "Caraway", "url": "https://www.carawayhome.com", "category": "home" },
    { "name": "Our Place", "url": "https://fromourplace.com", "category": "home" },
    { "name": "Blueland", "url": "https://www.blueland.com", "category": "home" },
    { "name": "Public Goods", "url": "https://www.publicgoods.com", "category": "home" },
    { "name": "Liquid Death", "url": "https://liquiddeath.com", "category": "food" },
    { "name": "Athletic Brewing", "url": "https://athleticbrewing.com", "category": "food" },
    { "name": "Magic Spoon", "url": "https://www.magicspoon.com", "category": "food" },
    { "name": "Mud Water", "url": "https://mudwtr.com", "category": "food" },
    { "name": "OLIPOP", "url": "https://drinkolipop.com", "category": "food" },
    { "name": "Away", "url": "https://www.awaytravel.com", "category": "accessories" },
    { "name": "Bellroy", "url": "https://bellroy.com", "category": "accessories" },
    { "name": "Moment", "url": "https://www.shopmoment.com", "category": "accessories" },
    { "name": "Peak Design", "url": "https://www.peakdesign.com", "category": "accessories" },
    { "name": "Nomad Goods", "url": "https://nomadgoods.com", "category": "accessories" },
    { "name": "Pela Case", "url": "https://pelacase.com", "category": "accessories" },
    { "name": "Hydroflask", "url": "https://www.hydroflask.com", "category": "accessories" },
    { "name": "Beardbrand", "url": "https://www.beardbrand.com", "category": "grooming" },
    { "name": "Manscaped", "url": "https://www.manscaped.com", "category": "grooming" },
    { "name": "Beis Travel", "url": "https://www.beistravel.com", "category": "accessories" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add crawler/crawler/data/shopify_stores.json
git commit -m "feat: add curated list of 40 Shopify stores for bulk crawl"
```

---

## Task 2: Bulk Shopify Crawler

**Files:**
- Create: `crawler/crawl_shopify_bulk.py`

- [ ] **Step 1: Create the bulk crawl script**

Based on the existing `crawl_new.py` pattern but reads from the JSON store list, seeds the `stores` table, and links products to stores via `store_id`.

```python
"""Bulk crawl Shopify stores from curated list — seeds stores table, links products."""
import os
import sys
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import re

import psycopg2
from psycopg2.extras import Json


def generate_store_id(url: str) -> str:
    h = hashlib.sha256(url.encode()).hexdigest()[:12]
    return f"str_{h}"


def generate_product_id(source: str, source_url: str) -> str:
    h = hashlib.sha256(f"{source}:{source_url}".encode()).hexdigest()[:12]
    return f"agr_{h}"


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    return " ".join(text.split())[:2000]


def fetch_products(store_url: str) -> list[dict]:
    products = []
    page = 1
    while page <= 20:
        url = f"{store_url.rstrip('/')}/products.json?limit=50&page={page}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Agora Crawler/0.1"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                batch = data.get("products", [])
                if not batch:
                    break
                products.extend(batch)
                if len(batch) < 50:
                    break
                page += 1
        except Exception as e:
            print(f"  Error page {page}: {e}")
            break
    return products


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    stores_file = Path(__file__).parent / "crawler" / "data" / "shopify_stores.json"
    with open(stores_file) as f:
        store_list = json.load(f)["stores"]

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    total = 0

    for store_info in store_list:
        store_url = store_info["url"]
        store_name = store_info["name"]
        store_id = generate_store_id(store_url)

        # Seed stores table
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO stores (id, name, url, source, capabilities, product_count, status)
                VALUES (%s, %s, %s, 'scraped', %s, 0, 'active')
                ON CONFLICT (url) DO NOTHING
                """,
                (store_id, store_name, store_url, Json({})),
            )

        print(f"\nCrawling {store_name} ({store_url})...")
        raw = fetch_products(store_url)
        print(f"  Found {len(raw)} products")

        store_product_count = 0
        for p in raw:
            handle = p.get("handle", "")
            product_url = f"{store_url.rstrip('/')}/products/{handle}"
            name = p.get("title", "").strip()
            if not name:
                continue

            variants = p.get("variants", [])
            price = variants[0].get("price") if variants else None
            available = any(v.get("available", False) for v in variants)
            images = [img.get("src", "") for img in p.get("images", []) if img.get("src")][:5]

            categories = []
            if p.get("product_type"):
                categories.append(p["product_type"])

            attributes = {}
            for opt in p.get("options", []):
                if opt.get("name") and opt.get("values"):
                    attributes[opt["name"]] = ", ".join(opt["values"][:5])

            product_id = generate_product_id("shopify", product_url)
            now = datetime.now(timezone.utc)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO products (
                        id, source_url, source, name, description,
                        price_amount, price_currency, images, categories,
                        attributes, availability, seller_name, seller_url,
                        seller_rating, last_crawled, store_id
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO UPDATE SET
                        name=EXCLUDED.name, description=EXCLUDED.description,
                        price_amount=EXCLUDED.price_amount, images=EXCLUDED.images,
                        categories=EXCLUDED.categories, attributes=EXCLUDED.attributes,
                        availability=EXCLUDED.availability, last_crawled=EXCLUDED.last_crawled,
                        store_id=EXCLUDED.store_id
                    """,
                    (
                        product_id, product_url, "shopify", name,
                        strip_html(p.get("body_html", "")),
                        price, "USD",
                        Json(images), Json(categories), Json(attributes),
                        "in_stock" if available else "out_of_stock",
                        p.get("vendor", ""), store_url, None, now, store_id,
                    ),
                )

                if price:
                    cur.execute(
                        "INSERT INTO price_history (product_id, amount, currency) VALUES (%s,%s,%s)",
                        (product_id, price, "USD"),
                    )

            total += 1
            store_product_count += 1

        # Update store product count
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE stores SET product_count = %s, last_synced_at = %s WHERE id = %s",
                (store_product_count, datetime.now(timezone.utc), store_id),
            )

        print(f"  Indexed {store_product_count} products for {store_name}")

    conn.close()
    print(f"\nDone! Indexed {total} products from {len(store_list)} stores.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add crawler/crawl_shopify_bulk.py
git commit -m "feat: add bulk Shopify crawler with store linking"
```

---

## Task 3: Amazon Anti-Bot Middleware

**Files:**
- Create: `crawler/crawler/middlewares/__init__.py`
- Create: `crawler/crawler/middlewares/antibot.py`
- Modify: `crawler/pyproject.toml`
- Modify: `crawler/crawler/settings.py`

- [ ] **Step 1: Add playwright-stealth dependency**

In `crawler/pyproject.toml`, add to dependencies:
```toml
"playwright-stealth>=1.0.6",
```

- [ ] **Step 2: Create the antibot middleware**

```python
# crawler/crawler/middlewares/__init__.py
```

```python
# crawler/crawler/middlewares/antibot.py
"""Anti-bot middleware: random delays, UA rotation, proxy rotation, stealth."""
import random
import logging
import time

from scrapy import signals
from scrapy.http import Request

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
]


class RandomUserAgentMiddleware:
    """Rotate User-Agent header randomly per request."""

    def process_request(self, request: Request, spider):
        request.headers["User-Agent"] = random.choice(USER_AGENTS)


class RandomDelayMiddleware:
    """Add random delay between requests (2-8 seconds)."""

    def process_request(self, request: Request, spider):
        delay = random.uniform(2.0, 8.0)
        time.sleep(delay)


class PlaywrightStealthMiddleware:
    """Configure Playwright with stealth settings."""

    def process_request(self, request: Request, spider):
        if request.meta.get("playwright"):
            request.meta["playwright_context_kwargs"] = {
                "viewport": {"width": random.choice([1366, 1440, 1536, 1920]),
                             "height": random.choice([768, 900, 864, 1080])},
                "locale": random.choice(["en-US", "en-GB", "en-CA"]),
                "timezone_id": random.choice([
                    "America/New_York", "America/Chicago",
                    "America/Los_Angeles", "America/Denver",
                ]),
            }
```

- [ ] **Step 3: Update settings.py for Amazon crawling**

Add to `crawler/crawler/settings.py`:

```python
# Anti-bot middlewares (applied before download handlers)
DOWNLOADER_MIDDLEWARES = {
    "crawler.middlewares.antibot.RandomUserAgentMiddleware": 400,
    "crawler.middlewares.antibot.RandomDelayMiddleware": 410,
    "crawler.middlewares.antibot.PlaywrightStealthMiddleware": 420,
}

# Amazon-specific tuning
CONCURRENT_REQUESTS_PER_DOMAIN = 2
RETRY_TIMES = 3
RETRY_HTTP_CODES = [403, 429, 503]
```

- [ ] **Step 4: Commit**

```bash
git add crawler/crawler/middlewares/ crawler/pyproject.toml crawler/crawler/settings.py
git commit -m "feat: add anti-bot middleware for Amazon crawling"
```

---

## Task 4: Amazon Spider — ASIN Loader + Category Discovery

**Files:**
- Create: `crawler/crawler/data/asins.json`
- Modify: `crawler/crawler/spiders/amazon.py`

- [ ] **Step 1: Create a starter ASIN list**

Create `crawler/crawler/data/asins.json` with a curated set of popular ASINs across key categories. This is a bootstrap list — can be expanded later from Kaggle datasets.

```json
{
  "description": "Curated Amazon ASINs for demo catalog. Expand with Kaggle datasets.",
  "categories": {
    "electronics": [
      "B09V3KXJPB", "B0BSHF7WHW", "B0C8QJR77S", "B0BT2P9GYS",
      "B0CFCN1KKL", "B0D1XD1ZV3", "B09JQL3NWT", "B0CSTJ2Y7N"
    ],
    "fashion": [
      "B07QMH297K", "B08FBX6NM7", "B09JNKSW7Y", "B0B14DQKFJ",
      "B07PF1Y28C", "B078964BBN", "B09HGD7XWZ", "B07ZPC9QD4"
    ],
    "home": [
      "B07VFCMJBM", "B08GKSC27K", "B0BCWXYF3L", "B08CDM3VKN",
      "B07MFZY2F2", "B08GFQ5NR5", "B0B8RHP7M9", "B09ZHN7VQ6"
    ],
    "outdoor": [
      "B078WGF2CG", "B07BGKRQ44", "B08JQHP56C", "B078K3N8TJ",
      "B07GLJ9M4L", "B0776NCQWH", "B07FNFHTLM", "B07BHXHG6P"
    ]
  }
}
```

- [ ] **Step 2: Extend Amazon spider with ASIN loading**

Replace `crawler/crawler/spiders/amazon.py`:

```python
import json
from pathlib import Path

import scrapy
from crawler.spiders.base import BaseProductSpider


class AmazonSpider(BaseProductSpider):
    name = "amazon"
    allowed_domains = ["amazon.com"]

    def __init__(self, start_urls=None, asin_file=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = []

        if start_urls:
            self.start_urls = start_urls
        elif asin_file:
            self._load_asins(asin_file)
        else:
            # Default: load from data/asins.json
            default_path = Path(__file__).parent.parent / "data" / "asins.json"
            if default_path.exists():
                self._load_asins(str(default_path))

    def _load_asins(self, filepath: str):
        with open(filepath) as f:
            data = json.load(f)
        for category, asins in data.get("categories", {}).items():
            for asin in asins:
                self.start_urls.append(f"https://www.amazon.com/dp/{asin}")
        self.logger.info(f"Loaded {len(self.start_urls)} ASINs from {filepath}")

    def start_requests(self):
        for url in self.start_urls:
            yield self.make_playwright_request(url)

    def make_playwright_request(self, url):
        return scrapy.Request(
            url,
            callback=self.parse_product,
            meta={
                "playwright": True,
                "playwright_include_page": False,
            },
            dont_filter=True,
        )

    def parse_product(self, response):
        # Check for CAPTCHA/block
        if response.css("#captchacharacters").get():
            self.logger.warning(f"CAPTCHA detected on {response.url}, skipping")
            return

        name = self.clean_text(response.css("#productTitle::text").get())
        if not name:
            return

        whole = response.css(".a-price-whole::text").get("").strip().rstrip(".")
        fraction = response.css(".a-price-fraction::text").get("00").strip()
        symbol = response.css(".a-price-symbol::text").get("$").strip()
        price_text = f"{symbol}{whole}.{fraction}" if whole else None

        avail_text = self.clean_text(
            response.css("#availability span::text").get("")
        ).lower()
        if "in stock" in avail_text:
            availability = "in_stock"
        elif "unavailable" in avail_text or "out of stock" in avail_text:
            availability = "out_of_stock"
        else:
            availability = "unknown"

        description = self.clean_text(
            response.css("#productDescription p::text").get("")
        )

        # Try feature bullets as fallback description
        if not description:
            bullets = response.css("#feature-bullets li span::text").getall()
            description = " ".join(self.clean_text(b) for b in bullets[:5])

        images = []
        main_img = response.css("#landingImage::attr(data-old-hires)").get()
        if main_img:
            images.append(main_img)
        # Fallback to src
        if not images:
            main_img = response.css("#landingImage::attr(src)").get()
            if main_img:
                images.append(main_img)

        categories = [
            self.clean_text(a.css("::text").get())
            for a in response.css("#wayfinding-breadcrumbs_container a")
            if self.clean_text(a.css("::text").get())
        ]

        seller_name = self.clean_text(
            response.css("#bylineInfo::text").get()
        )

        # Extract rating
        rating_text = response.css("#acrPopover .a-size-base::text").get()
        rating = None
        if rating_text:
            try:
                rating = float(rating_text.strip().split()[0])
            except (ValueError, IndexError):
                pass

        yield self.make_item(
            source="amazon",
            source_url=response.url,
            name=name,
            description=description,
            price_text=price_text,
            images=images,
            categories=categories,
            availability=availability,
            seller_name=seller_name or None,
            seller_url="https://www.amazon.com",
            seller_rating=rating,
        )
```

- [ ] **Step 3: Commit**

```bash
git add crawler/crawler/data/asins.json crawler/crawler/spiders/amazon.py
git commit -m "feat: extend Amazon spider with ASIN loader and CAPTCHA detection"
```

---

## Task 5: Update Existing Crawl Scripts

**Files:**
- Modify: `crawler/crawl_new.py`

- [ ] **Step 1: Update crawl_new.py to also seed stores and set store_id**

Add store seeding and `store_id` linking to the existing crawl_new.py, following the same pattern as `crawl_shopify_bulk.py`. Add `store_id` to the INSERT statement.

- [ ] **Step 2: Commit**

```bash
git add crawler/crawl_new.py
git commit -m "feat: update crawl_new.py to seed stores and link products"
```
