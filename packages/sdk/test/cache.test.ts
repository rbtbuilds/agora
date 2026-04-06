import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResponseCache } from "../src/cache.js";

describe("ResponseCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns cached value within TTL", () => {
    const cache = new ResponseCache(60000);
    cache.set("key1", { data: "test" });
    expect(cache.get("key1")).toEqual({ data: "test" });
  });

  it("returns undefined after TTL expires", () => {
    const cache = new ResponseCache(1000);
    cache.set("key1", { data: "test" });
    vi.advanceTimersByTime(1500);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("clears all entries", () => {
    const cache = new ResponseCache(60000);
    cache.set("key1", { data: "a" });
    cache.set("key2", { data: "b" });
    cache.clear();
    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toBeUndefined();
  });
});
