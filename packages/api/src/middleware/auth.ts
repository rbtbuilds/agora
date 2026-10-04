import type { MiddlewareHandler } from "hono";
import { db, apiKeys, usageLogs } from "@agora/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { isAuthFailureLimited, recordAuthFailure, isQuotaExceeded } from "../lib/rate-limit.js";

const TIER_LIMITS: Record<string, number> = {
  free: 100,
  pro: 10000,
  enterprise: 999999,
};

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (await isAuthFailureLimited(ip)) {
    return c.json(
      { error: { code: "RATE_LIMITED", message: "Too many failed authentication attempts" } },
      429
    );
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    await recordAuthFailure(ip);
    console.warn(`[auth] failure from ${ip}: missing_header`, { endpoint: c.req.path, keyPrefix: "none" });
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
      401
    );
  }

  const apiKey = authHeader.slice(7);

  if (!apiKey.startsWith("ak_")) {
    await recordAuthFailure(ip);
    console.warn(`[auth] failure from ${ip}: invalid_format`, { endpoint: c.req.path, keyPrefix: apiKey.slice(0, 7) });
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid API key format" } },
      401
    );
  }

  // Validate key exists and isn't revoked
  const keyResult = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.key, apiKey), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (keyResult.length === 0) {
    await recordAuthFailure(ip);
    console.warn(`[auth] failure from ${ip}: invalid_or_revoked_key`, { endpoint: c.req.path, keyPrefix: apiKey.slice(0, 7) });
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" } },
      401
    );
  }

  const key = keyResult[0];
  const tier = key.tier ?? "free";
  const dailyLimit = TIER_LIMITS[tier] ?? 100;

  if (await isQuotaExceeded(apiKey, dailyLimit)) {
    return c.json(
      { error: { code: "RATE_LIMITED", message: `Daily limit of ${dailyLimit} requests exceeded. Upgrade your plan for more.` } },
      429
    );
  }

  c.set("apiKey", apiKey);
  c.set("userId", key.userId);
  await next();

  // Log usage after response (non-blocking). Source of truth for billing
  // analytics; the enforced quota counter lives in Redis (see rate-limit.ts).
  const status = c.res.status;
  db.insert(usageLogs)
    .values({ apiKeyId: apiKey, endpoint: c.req.path, statusCode: status })
    .then(() => db.update(apiKeys).set({ lastUsedAt: new Date(), requestCount: sql`${apiKeys.requestCount} + 1` } as any).where(eq(apiKeys.key, apiKey)))
    .catch((err) => console.error("Usage log error:", err));
};
