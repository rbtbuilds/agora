import { describe, it, expect } from "vitest";
import { validateProduct } from "../src/validate-product.js";
import validProduct from "./fixtures/valid-product.json";
import invalidNoId from "./fixtures/invalid-product-no-id.json";

describe("validateProduct", () => {
  it("accepts a fully valid product", () => {
    const result = validateProduct(validProduct);
    expect(result.valid).toBe(true);
    expect(result.checks.every((c) => c.status !== "fail")).toBe(true);
  });

  it("accepts a minimal product with only required fields", () => {
    const minimal = {
      id: "prod-001",
      url: "https://example.com/products/minimal",
      name: "Minimal Product",
      pricing: { amount: "9.99", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(minimal);
    expect(result.valid).toBe(true);
  });

  it("rejects a product missing the id field", () => {
    const result = validateProduct(invalidNoId);
    expect(result.valid).toBe(false);
    expect(result.checks.some((c) => c.status === "fail")).toBe(true);
  });

  it("rejects a product with invalid price format", () => {
    const badPrice = {
      id: "prod-bad", url: "https://example.com/products/bad", name: "Bad Price",
      pricing: { amount: "19.9", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(badPrice);
    expect(result.valid).toBe(false);
  });

  it("rejects a product with invalid availability status", () => {
    const badAvail = {
      id: "prod-bad", url: "https://example.com/products/bad", name: "Bad Avail",
      pricing: { amount: "19.99", currency: "USD" },
      availability: { status: "maybe" },
    };
    const result = validateProduct(badAvail);
    expect(result.valid).toBe(false);
  });

  it("warns when optional enrichment fields are missing", () => {
    const minimal = {
      id: "prod-001", url: "https://example.com/products/minimal", name: "Minimal Product",
      pricing: { amount: "9.99", currency: "USD" },
      availability: { status: "in_stock" },
    };
    const result = validateProduct(minimal);
    const warns = result.checks.filter((c) => c.status === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns.some((w) => w.name === "identifiers")).toBe(true);
  });

  it("rejects non-object input", () => {
    const result = validateProduct(42 as any);
    expect(result.valid).toBe(false);
  });
});
