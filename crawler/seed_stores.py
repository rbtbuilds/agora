"""Seed the stores table with existing crawled Shopify stores."""
import os
import sys
import hashlib

import psycopg2
from psycopg2.extras import Json

EXISTING_STORES = [
    ("Allbirds", "https://www.allbirds.com"),
    ("tentree", "https://www.tentree.com"),
    ("Taylor Stitch", "https://www.taylorstitch.com"),
    ("Greyson", "https://www.greysonclothiers.com"),
    ("Girlfriend Collective", "https://www.girlfriend.com"),
    ("Ridge", "https://www.ridgewallet.com"),
    ("Pura Vida", "https://www.puravidabracelets.com"),
    ("Haute Hijab", "https://hautehijab.com"),
    ("Native", "https://www.nativecos.com"),
    ("Brooklinen", "https://www.brooklinen.com"),
    ("Death Wish Coffee", "https://www.deathwishcoffee.com"),
    ("ColourPop", "https://colourpop.com"),
]


def generate_store_id(url: str) -> str:
    h = hashlib.sha256(url.encode()).hexdigest()[:12]
    return f"str_{h}"


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True

    for name, url in EXISTING_STORES:
        store_id = generate_store_id(url)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO stores (id, name, url, source, capabilities, product_count, status)
                VALUES (%s, %s, %s, 'scraped', %s, 0, 'active')
                ON CONFLICT (url) DO NOTHING
                """,
                (store_id, name, url, Json({})),
            )
        print(f"  Seeded: {name} ({store_id})")

    conn.close()
    print(f"\nSeeded {len(EXISTING_STORES)} stores.")


if __name__ == "__main__":
    main()
