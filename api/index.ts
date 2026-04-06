import type { VercelRequest, VercelResponse } from "@vercel/node";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const webRequest = new Request(url.toString(), {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
  });

  const response = await app.fetch(webRequest);

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.text();
  res.end(body);
}
