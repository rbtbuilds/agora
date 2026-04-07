BOT_NAME = "agora"

SPIDER_MODULES = ["crawler.spiders"]
NEWSPIDER_MODULE = "crawler.spiders"

ROBOTSTXT_OBEY = True

CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 1.5

ITEM_PIPELINES = {
    "crawler.pipelines.NormalizePipeline": 100,
    "crawler.pipelines.EmbeddingPipeline": 200,
    "crawler.pipelines.PostgresPipeline": 300,
}

DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
PLAYWRIGHT_BROWSER_TYPE = "chromium"

# Anti-bot middlewares (for Amazon crawling)
DOWNLOADER_MIDDLEWARES = {
    "crawler.middlewares.antibot.RandomUserAgentMiddleware": 400,
    "crawler.middlewares.antibot.RandomDelayMiddleware": 410,
    "crawler.middlewares.antibot.PlaywrightStealthMiddleware": 420,
}

# Amazon-specific tuning
CONCURRENT_REQUESTS_PER_DOMAIN = 2
RETRY_TIMES = 3
RETRY_HTTP_CODES = [403, 429, 503]
