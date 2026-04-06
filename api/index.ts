import { handle } from "hono/vercel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "../packages/api/src/middleware/auth";
import { productsRouter } from "../packages/api/src/routes/products";
import { categoriesRouter } from "../packages/api/src/routes/categories";

const app = new Hono();

app.use("*", cors());
app.use("/v1/*", authMiddleware);

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1/products", productsRouter);
app.route("/v1/categories", categoriesRouter);

export default handle(app);
