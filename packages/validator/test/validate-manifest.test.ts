import { describe, it, expect } from "vitest";
import { validateManifest } from "../src/validate-manifest.js";

import validManifest from "./fixtures/valid-manifest.json";
import minimalManifest from "./fixtures/minimal-manifest.json";
import missingStore from "./fixtures/invalid-manifest-missing-store.json";
import noProductsCap from "./fixtures/invalid-manifest-no-products-cap.json";

describe("validateManifest", () => {
  it("accepts a fully valid manifest", () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest).not.toBeNull();
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("accepts a minimal manifest with only required fields", () => {
    const result = validateManifest(minimalManifest);
    expect(result.valid).toBe(true);
    expect(result.manifest?.store.name).toBe("Minimal Store");
  });

  it("rejects a manifest missing the store field", () => {
    const result = validateManifest(missingStore);
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.status === "fail")).toBe(true);
  });

  it("rejects a manifest missing required capabilities", () => {
    const result = validateManifest(noProductsCap);
    expect(result.valid).toBe(false);
    const failCheck = result.checks.find((c) => c.status === "fail");
    expect(failCheck?.message).toContain("products");
  });

  it("warns on missing optional fields like auth and rate_limits", () => {
    const result = validateManifest(minimalManifest);
    const warns = result.checks.filter((c) => c.status === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns.some((w) => w.name === "auth")).toBe(true);
  });

  it("rejects non-object input", () => {
    const result = validateManifest("not an object" as any);
    expect(result.valid).toBe(false);
  });

  it("rejects null input", () => {
    const result = validateManifest(null as any);
    expect(result.valid).toBe(false);
  });
});
