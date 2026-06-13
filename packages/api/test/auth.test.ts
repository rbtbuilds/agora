import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @agora/db before importing anything that depends on it.
vi.mock("@agora/db", () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();

  // Chain: db.select().from().where().limit()
  mockLimit.mockResolvedValue([{ key: "ak_test_valid_key_1234567890", tier: "free", revokedAt: null }]);
  // db.select().from().where() (no .limit) is awaited directly by the quota
  // DB-count fallback; an object without [0].count reads as usage 0 (under limit).
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      then: vi.fn().mockReturnValue({ catch: vi.fn() }),
    }),
  });

  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
    apiKeys: {},
    usageLogs: {},
  };
});

// Controllable in-process fake of the Upstash Redis REST client. The backing
// store lives OUTSIDE the rate-limit module so it survives a simulated cold
// start (module cache reset) — exactly what a real Redis server does and the
// whole reason for moving the counters off the in-memory Map.
const redis = vi.hoisted(() => ({
  store: new Map<string, number>(),
  ttl: new Map<string, number>(),
  down: false,
}));

vi.mock("@upstash/redis", () => {
  class Redis {
    async get(key: string): Promise<number | null> {
      if (redis.down) throw new Error("redis unreachable");
      return redis.store.get(key) ?? null;
    }
    async incr(key: string): Promise<number> {
      if (redis.down) throw new Error("redis unreachable");
      const next = (redis.store.get(key) ?? 0) + 1;
      redis.store.set(key, next);
      return next;
    }
    async expire(key: string, seconds: number): Promise<number> {
      if (redis.down) throw new Error("redis unreachable");
      redis.ttl.set(key, seconds);
      return 1;
    }
  }
  return { Redis };
});

import { Hono } from "hono";
import { authMiddleware } from "../src/middleware/auth.js";
import { __resetRateLimiter } from "../src/lib/rate-limit.js";

function createTestApp() {
  const app = new Hono();
  app.use("/v1/*", authMiddleware);
  app.get("/v1/test", (c) => c.json({ ok: true }));
  return app;
}

function badFormatRequest(ip: string) {
  return createTestApp().request("/v1/test", {
    headers: { Authorization: "Bearer not-a-valid-key", "x-forwarded-for": ip },
  });
}

function validRequest(ip = "9.9.9.9") {
  return createTestApp().request("/v1/test", {
    headers: { Authorization: "Bearer ak_test_valid_key_1234567890", "x-forwarded-for": ip },
  });
}

const VALID_KEY = "ak_test_valid_key_1234567890";
const todayUtc = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  redis.store.clear();
  redis.ttl.clear();
  redis.down = false;
  __resetRateLimiter();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth middleware — core behaviour", () => {
  it("rejects requests without an API key", async () => {
    const res = await createTestApp().request("/v1/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with invalid API key format", async () => {
    const res = await createTestApp().request("/v1/test", {
      headers: { Authorization: "Bearer not-a-valid-key" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts requests with valid API key found in database", async () => {
    const res = await createTestApp().request("/v1/test", {
      headers: { Authorization: "Bearer ak_test_valid_key_1234567890" },
    });
    expect(res.status).toBe(200);
  });
});

describe("auth-failure limiting — Redis backed", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    __resetRateLimiter();
  });

  it("blocks the 11th failed attempt from an IP and survives a cold start", async () => {
    // 10 bad attempts are allowed through to a 401 and counted in Redis.
    for (let i = 0; i < 10; i++) {
      const res = await badFormatRequest("1.2.3.4");
      expect(res.status).toBe(401);
    }

    // Simulate a serverless cold start: module caches are wiped, but the Redis
    // counter persists. With the old in-memory Map this reset would zero the
    // count and the next attempt would be a 401 again.
    __resetRateLimiter();

    const blocked = await badFormatRequest("1.2.3.4");
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("sets a 60s expiry on the counter so the window resets", async () => {
    await badFormatRequest("5.6.7.8");
    expect(redis.ttl.get("authfail:5.6.7.8")).toBe(60);

    // Simulate the TTL elapsing: the key disappears and the IP is clean again.
    redis.store.delete("authfail:5.6.7.8");
    redis.ttl.delete("authfail:5.6.7.8");

    // Push it back to the limit, then one more should be blocked again.
    for (let i = 0; i < 10; i++) await badFormatRequest("5.6.7.8");
    const res = await badFormatRequest("5.6.7.8");
    expect(res.status).toBe(429);
  });

  it("isolates counters per IP", async () => {
    for (let i = 0; i < 11; i++) await badFormatRequest("10.0.0.1");
    const other = await badFormatRequest("10.0.0.2");
    expect(other.status).toBe(401); // different IP, not blocked
  });
});

describe("daily quota — Redis backed", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    __resetRateLimiter();
  });

  it("blocks requests once the free-tier daily limit is exceeded", async () => {
    // Free tier = 100/day. Pre-seed today's counter at the limit.
    redis.store.set(`quota:${VALID_KEY}:${todayUtc()}`, 100);

    const res = await validRequest();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toContain("100");
  });

  it("allows requests under the daily limit", async () => {
    redis.store.set(`quota:${VALID_KEY}:${todayUtc()}`, 5);
    const res = await validRequest();
    expect(res.status).toBe(200);
  });
});

describe("graceful degradation — Redis unreachable", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    __resetRateLimiter();
    redis.down = true;
  });

  it("soft-fails OPEN for auth failures (never 429s when Redis is down)", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await badFormatRequest("2.2.2.2");
      expect(res.status).toBe(401); // always 401, never 429
    }
  });

  it("still serves valid requests via the DB-count quota fallback", async () => {
    const res = await validRequest();
    expect(res.status).toBe(200);
  });
});

describe("no Upstash env configured — in-memory fallback", () => {
  it("still enforces the auth-failure limit per instance", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await badFormatRequest("3.3.3.3");
      expect(res.status).toBe(401);
    }
    const blocked = await badFormatRequest("3.3.3.3");
    expect(blocked.status).toBe(429);
  });
});
