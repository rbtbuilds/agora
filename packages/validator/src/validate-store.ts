import { validateManifest } from "./validate-manifest.js";
import { validateProduct } from "./validate-product.js";
import type { StoreValidationResult, ValidationCheck } from "./types.js";

export async function validateStore(storeUrl: string): Promise<StoreValidationResult> {
  const checks: ValidationCheck[] = [];
  const baseUrl = storeUrl.replace(/\/$/, "");

  // Step 1: Discover agora.json
  let manifestData: unknown;
  try {
    const manifestUrl = `${baseUrl}/.well-known/agora.json`;
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      checks.push({ name: "discovery", status: "fail", message: `/.well-known/agora.json returned ${res.status}` });
      return makeResult(baseUrl, false, checks, null, 0, 0);
    }
    manifestData = await res.json();
    checks.push({ name: "discovery", status: "pass", message: "/.well-known/agora.json found and parseable" });
  } catch (err) {
    checks.push({ name: "discovery", status: "fail", message: `Failed to fetch /.well-known/agora.json: ${(err as Error).message}` });
    return makeResult(baseUrl, false, checks, null, 0, 0);
  }

  // Step 2: Validate manifest
  const manifestResult = validateManifest(manifestData);
  checks.push(...manifestResult.checks);
  if (!manifestResult.valid || !manifestResult.manifest) {
    return makeResult(baseUrl, false, checks, null, 0, 0);
  }
  const manifest = manifestResult.manifest;

  // Step 3: Probe products endpoint
  const productsUrl = resolveCapabilityUrl(baseUrl, manifest.capabilities.products);
  let productsSampled = 0;
  let productErrors = 0;

  try {
    const res = await fetch(productsUrl);
    if (!res.ok) {
      checks.push({ name: "endpoint_products", status: "fail", message: `Products endpoint returned ${res.status}` });
    } else {
      checks.push({ name: "endpoint_products", status: "pass", message: "Products endpoint reachable" });
      const body = await res.json();
      const products = body?.data ?? (Array.isArray(body) ? body : []);
      if (products.length === 0) {
        checks.push({ name: "products_content", status: "warn", message: "Products endpoint returned no products" });
      } else {
        for (const product of products.slice(0, 5)) {
          productsSampled++;
          const productResult = validateProduct(product);
          if (!productResult.valid) productErrors++;
        }
        checks.push({
          name: "products_content",
          status: productErrors === 0 ? "pass" : "warn",
          message: `Sampled ${productsSampled} product(s), ${productErrors} validation error(s)`,
        });
      }
    }
  } catch (err) {
    checks.push({ name: "endpoint_products", status: "fail", message: `Failed to reach products endpoint: ${(err as Error).message}` });
  }

  const valid = checks.every((c) => c.status !== "fail");
  return makeResult(baseUrl, valid, checks, manifest, productsSampled, productErrors);
}

function resolveCapabilityUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function makeResult(
  url: string, valid: boolean, checks: ValidationCheck[],
  manifest: StoreValidationResult["manifest"],
  productsSampled: number, productErrors: number,
): StoreValidationResult {
  const total = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { url, valid, score, checks, manifest, productsSampled, productErrors };
}
