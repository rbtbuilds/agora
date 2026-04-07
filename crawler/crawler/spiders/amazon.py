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
        if not description:
            bullets = response.css("#feature-bullets li span::text").getall()
            description = " ".join(self.clean_text(b) for b in bullets[:5])

        images = []
        main_img = response.css("#landingImage::attr(data-old-hires)").get()
        if main_img:
            images.append(main_img)
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
