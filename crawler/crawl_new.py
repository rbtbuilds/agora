"""Crawl new stores only — no embeddings, fast indexing."""
import os
import sys
import json
import hashlib
from datetime import datetime, timezone
import urllib.request

import psycopg2
from psycopg2.extras import Json

NEW_STORES = [
    "https://www.tentree.com",
    "https://www.taylorstitch.com",
    "https://www.greysonclothiers.com",
    "https://www.girlfriend.com",
    "https://www.ridgewallet.com",
    "https://www.puravidabracelets.com",
    "https://hautehijab.com",
    "https://www.nativecos.com",
    "https://www.brooklinen.com",
    "https://www.deathwishcoffee.com",
    "https://colourpop.com",
]


def generate_store_id(url: str) -> str:
    h = hashlib.sha256(url.encode()).hexdigest()[:12]
    return f"str_{h}"


def generate_product_id(source, source_url):
    short_hash = hashlib.sha256(f"{source}:{source_url}".encode()).hexdigest()[:12]
    return f"agr_{short_hash}"


def fetch_products(store_url):
    products = []
    page = 1
    while page <= 20:  # Cap at 1000 products per store
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


def strip_html(text):
    if not text:
        return ""
    import re
    text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
    return ' '.join(text.split())[:2000]


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    total = 0

    for store_url in NEW_STORES:
        store_id = generate_store_id(store_url)
        store_name = store_url.rstrip("/").split("//")[-1]

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

        print(f"\nCrawling {store_url}...")
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
            if total % 50 == 0:
                print(f"  Indexed {total} products total...")

        # Update store product count
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE stores SET product_count = %s, last_synced_at = %s WHERE id = %s",
                (store_product_count, datetime.now(timezone.utc), store_id),
            )

        print(f"  Indexed {store_product_count} products for {store_url}")

    conn.close()
    print(f"\nDone! Indexed {total} new products.")


if __name__ == "__main__":
    main()
