import { Redis } from "@upstash/redis";
import { db, usageLogs } from "@agora/db";
import { and, eq, gte, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Rate limiting
//
// Two limiters, both backed by Upstash Redis when configured so counters are
// shared across serverless replicas and survive cold starts:
//
//   1. Failed-auth limiter  -- key `authfail:<ip>`, 60s fixed window, cap 10.
//   2. Daily tier quota     -- key `quota:<apiKeyId>:<YYYY-MM-DD>` (UTC), 48h TTL.
//
// Degradation (chosen behaviour, see improvements/agora.md):
//   - No Upstash env configured -> fall back to the legacy in-memory auth
//     limiter and a read-only DB usage count. Identical to pre-Redis behaviour,
//     so this is safe to ship before the Upstash database exists.
//   - Env configured but a Redis call throws -> soft-fail OPEN for auth
//     failures (availability over strictness) and fall back to the DB usage
//     count for quota. Every degradation is logged.
// ---------------------------------------------------------------------------

const AUTH_FAILURE_LIMIT = 10;
const AUTH_FAILURE_WINDOW_S = 60;
// Comfortably outlives a single UTC calendar day so the per-day key always
// expires on its own without a sweeper.
const QUOTA_TTL_S = 48 * 60 * 60;

// ---- Redis client (lazy, env-derived, cached) -----------------------------

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    _redis = url && token ? new Redis({ url, token }) : null;
  }
  return _redis;
}

function logDegradation(op: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[rate-limit] Redis ${op} failed, degrading gracefully: ${message}`);
}

// ---- Legacy in-memory auth-failure limiter (no-env fallback) ---------------

const authFailures = new Map<string, { count: number; resetAt: number }>();

function memoryIsAuthLimited(ip: string): boolean {
  const record = authFailures.get(ip);
  if (!record || Date.now() > record.resetAt) return false;
  return record.count >= AUTH_FAILURE_LIMIT;
}

function memoryRecordAuthFailure(ip: string): void {
  const now = Date.now();
  const record = authFailures.get(ip);
  if (!record || now > record.resetAt) {
    authFailures.set(ip, { count: 1, resetAt: now + AUTH_FAILURE_WINDOW_S * 1000 });
  } else {
    record.count++;
  }
}

// ---- DB usage count (quota fallback) --------------------------------------

async function dbQuotaExceeded(apiKeyId: string, dailyLimit: number): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(usageLogs)
    .where(and(eq(usageLogs.apiKeyId, apiKeyId), gte(usageLogs.timestamp, todayStart)));

  const used = Number(rows[0]?.count ?? 0);
  return used >= dailyLimit;
}

// ---- Public API ------------------------------------------------------------

/** Returns true if this IP is currently blocked for too many failed auths. */
export async function isAuthFailureLimited(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return memoryIsAuthLimited(ip);

  try {
    const count = await redis.get<number>(`authfail:${ip}`);
    return (count ?? 0) >= AUTH_FAILURE_LIMIT;
  } catch (err) {
    logDegradation("authfail check", err);
    return false; // soft-fail OPEN
  }
}

/** Record one failed authentication attempt for an IP. */
export async function recordAuthFailure(ip: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryRecordAuthFailure(ip);
    return;
  }

  try {
    const key = `authfail:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, AUTH_FAILURE_WINDOW_S);
  } catch (err) {
    logDegradation("authfail record", err);
    // soft-fail: do not block on a recording failure
  }
}

/**
 * Atomically consume one unit of an API key's daily quota.
 * Returns true if the key has now exceeded its tier's daily limit.
 */
export async function isQuotaExceeded(apiKeyId: string, dailyLimit: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return dbQuotaExceeded(apiKeyId, dailyLimit);

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const key = `quota:${apiKeyId}:${day}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, QUOTA_TTL_S);
    return count > dailyLimit;
  } catch (err) {
    logDegradation("quota check", err);
    return dbQuotaExceeded(apiKeyId, dailyLimit);
  }
}

/** Test-only: reset module caches (Redis client handle + in-memory counters). */
export function __resetRateLimiter(): void {
  _redis = undefined;
  authFailures.clear();
}
