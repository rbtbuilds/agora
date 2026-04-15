import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { authMiddleware } from "./middleware/auth.js";
import { productsRouter } from "./routes/products.js";
import { categoriesRouter } from "./routes/categories.js";
import { storesRouter } from "./routes/stores.js";
import { registryRouter } from "./routes/registry.js";
import { adapterRouter, adapterPublicRouter } from "./routes/adapter.js";
import { commerceRouter } from "./routes/commerce.js";

const app = new Hono();

app.use("*", cors({
  origin: [
    "https://agora-portal.vercel.app",
    "https://demo-five-coral-13.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
});

app.use("*", bodyLimit({ maxSize: 100 * 1024 })); // 100KB

// Public registry routes — mounted BEFORE auth middleware
app.route("/v1/registry", registryRouter);

// Public adapter routes — agora.json manifest only (no auth required)
app.route("/v1/adapter", adapterPublicRouter);

app.use("/v1/*", authMiddleware);

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1/products", productsRouter);
app.route("/v1/categories", categoriesRouter);
app.route("/v1/stores", storesRouter);
// Protected adapter routes — registration + proxy (auth required)
app.route("/v1/adapter", adapterRouter);
app.route("/v1", commerceRouter);

export default app;
