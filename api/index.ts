import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../packages/api/src/index.js";

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & { status(code: number): ApiResponse };

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
