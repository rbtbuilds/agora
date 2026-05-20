import { ResponseCache } from "./cache.js";
import type { AgoraConfig, AgoraError } from "./types.js";

const DEFAULT_BASE_URL = "https://agora-ecru-chi.vercel.app";
const DEFAULT_CACHE_TTL = 60000;

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON body (likely an HTML error page from a proxy or unhandled server error).
    return { __raw: text.slice(0, 500) };
  }
}

function buildError(response: Response, body: unknown): Error {
  const apiErr = (body as AgoraError | null)?.error;
  if (apiErr?.message) {
    return new Error(`${apiErr.code ?? response.status}: ${apiErr.message}`);
  }
  const raw = (body as { __raw?: string } | null)?.__raw;
  if (raw) {
    return new Error(`HTTP ${response.status} (non-JSON): ${raw.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  return new Error(`HTTP ${response.status}`);
}

export class AgoraClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: ResponseCache;

  constructor(config: AgoraConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.cache = new ResponseCache(config.cacheTtl ?? DEFAULT_CACHE_TTL);
  }

  async get<T>(
    path: string,
    params?: Record<string, string | undefined>,
    opts: { skipCache?: boolean } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const cacheKey = url.toString();
    if (!opts.skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw buildError(response, body);
    }

    if (!opts.skipCache) {
      this.cache.set(cacheKey, body);
    }
    return body as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });

    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw buildError(response, responseBody);
    }

    this.cache.clear();
    return responseBody as T;
  }

  async delete<T>(path: string): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw buildError(response, responseBody);
    }

    this.cache.clear();
    return responseBody as T;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
