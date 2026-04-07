import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.js";
import { productsRouter } from "./routes/products.js";
import { categoriesRouter } from "./routes/categories.js";
import { storesRouter } from "./routes/stores.js";
import { registryRouter } from "./routes/registry.js";

const app = new Hono();

app.use("*", cors());

// Public registry routes — mounted BEFORE auth middleware
app.route("/v1/registry", registryRouter);

app.use("/v1/*", authMiddleware);

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1/products", productsRouter);
app.route("/v1/categories", categoriesRouter);
app.route("/v1/stores", storesRouter);

export default app;
