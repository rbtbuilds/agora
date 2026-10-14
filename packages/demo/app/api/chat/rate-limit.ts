import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

const DAILY_MESSAGE_LIMIT = 5;

const CONSUME_MESSAGE = `
local count = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])
if count >= limit then
  return {0, count}
end
count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIREAT", KEYS[1], ARGV[2])
end
return {1, count}
`;

interface DailyChatLimit {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function consumeDailyChatLimit(
  request: Request,
  now = new Date()
): Promise<DailyChatLimit> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Chat rate limit storage is not configured");

  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const forwarded = request.headers.get("x-vercel-forwarded-for");
  const localForwarded = isLocal ? request.headers.get("x-forwarded-for") : null;
  const ip = (forwarded ?? localForwarded ?? (isLocal ? "127.0.0.1" : ""))
    .split(",")[0]
    .trim();
  if (!ip) throw new Error("Client IP is unavailable");

  const day = now.toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const key = `agora:demo:chat:${day}:${ipHash}`;
  const resetAt = new Date(`${day}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  const expiresAt = Math.floor(resetAt.getTime() / 1000);

  const redis = new Redis({ url, token });
  const [allowed, count] = await redis.eval<[number, number], [number, number]>(
    CONSUME_MESSAGE,
    [key],
    [DAILY_MESSAGE_LIMIT, expiresAt]
  );

  return {
    allowed: allowed === 1,
    remaining: Math.max(0, DAILY_MESSAGE_LIMIT - Number(count)),
    resetAt,
  };
}
