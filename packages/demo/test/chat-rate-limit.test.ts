import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  expiry: new Map<string, number>(),
  unavailable: false,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    async eval(_script: string, keys: string[], args: number[]) {
      if (redisState.unavailable) throw new Error("Redis unavailable");
      const [key] = keys;
      const [limit, expiresAt] = args;
      const count = redisState.counts.get(key) ?? 0;
      if (count >= limit) return [0, count];
      redisState.counts.set(key, count + 1);
      if (count === 0) redisState.expiry.set(key, expiresAt);
      return [1, count + 1];
    }
  },
}));

import { consumeDailyChatLimit } from "../app/api/chat/rate-limit";

const requestFrom = (ip: string) =>
  new Request("https://demo.example/api/chat", {
    headers: { "x-vercel-forwarded-for": ip },
  });

beforeEach(() => {
  redisState.counts.clear();
  redisState.expiry.clear();
  redisState.unavailable = false;
  vi.stubEnv("KV_REST_API_URL", "https://redis.example");
  vi.stubEnv("KV_REST_API_TOKEN", "test-token");
});

afterEach(() => vi.unstubAllEnvs());

describe("daily chat limit", () => {
  it("allows five messages and blocks the sixth until midnight UTC", async () => {
    const now = new Date("2026-10-14T23:59:00.000Z");
    const request = requestFrom("203.0.113.10");

    for (let count = 1; count <= 5; count++) {
      expect(await consumeDailyChatLimit(request, now)).toMatchObject({
        allowed: true,
        remaining: 5 - count,
      });
    }
    expect(await consumeDailyChatLimit(request, now)).toMatchObject({
      allowed: false,
      remaining: 0,
    });

    const [key] = redisState.counts.keys();
    expect(key).not.toContain("203.0.113.10");
    expect(redisState.expiry.get(key)).toBe(Date.parse("2026-10-15T00:00:00.000Z") / 1000);
    expect(await consumeDailyChatLimit(request, new Date("2026-10-15T00:00:00.000Z"))).toMatchObject({
      allowed: true,
      remaining: 4,
    });
  });

  it("keeps separate counters for different IP addresses", async () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    for (let i = 0; i < 5; i++) {
      await consumeDailyChatLimit(requestFrom("203.0.113.10"), now);
    }

    expect(await consumeDailyChatLimit(requestFrom("203.0.113.11"), now)).toMatchObject({
      allowed: true,
      remaining: 4,
    });
  });

  it("fails closed when storage is not configured or unavailable", async () => {
    vi.stubEnv("KV_REST_API_TOKEN", "");
    await expect(consumeDailyChatLimit(requestFrom("203.0.113.10"))).rejects.toThrow();

    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    redisState.unavailable = true;
    await expect(consumeDailyChatLimit(requestFrom("203.0.113.10"))).rejects.toThrow();
  });

  it("uses a local IP for localhost but requires Vercel's IP header on public hosts", async () => {
    const local = new Request("http://localhost:3031/api/chat");
    expect(await consumeDailyChatLimit(local)).toMatchObject({ allowed: true });

    const publicRequest = new Request("https://demo.example/api/chat");
    await expect(consumeDailyChatLimit(publicRequest)).rejects.toThrow("Client IP is unavailable");
  });
});
