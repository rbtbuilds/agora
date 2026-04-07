"""Anti-bot middleware: random delays, UA rotation, stealth."""
import random
import time

from scrapy.http import Request

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
    """Configure Playwright with stealth viewport/locale settings."""

    def process_request(self, request: Request, spider):
        if request.meta.get("playwright"):
            request.meta["playwright_context_kwargs"] = {
                "viewport": {
                    "width": random.choice([1366, 1440, 1536, 1920]),
                    "height": random.choice([768, 900, 864, 1080]),
                },
                "locale": random.choice(["en-US", "en-GB", "en-CA"]),
                "timezone_id": random.choice([
                    "America/New_York", "America/Chicago",
                    "America/Los_Angeles", "America/Denver",
                ]),
            }
