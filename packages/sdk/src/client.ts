import { ResponseCache } from "./cache.js";
import type { AgoraConfig, AgoraError } from "./types.js";

const DEFAULT_BASE_URL = "https://api.agora.dev";
const DEFAULT_CACHE_TTL = 60000;

export class AgoraClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: ResponseCache;

  constructor(config: AgoraConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.cache = new ResponseCache(config.cacheTtl ?? DEFAULT_CACHE_TTL);
  }

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const cacheKey = url.toString();
    const cached = this.cache.get<T>(cacheKey);
    if (cached) return cached;

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.json();

    if (!response.ok) {
      const err = body as AgoraError;
      throw new Error(err.error?.message ?? `API error: ${response.status}`);
    }

    this.cache.set(cacheKey, body);
    return body as T;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
