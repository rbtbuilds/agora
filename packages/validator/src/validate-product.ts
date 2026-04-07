import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import productSchema from "./schema/agora-product.schema.json" with { type: "json" };
import type { ProductValidationResult, ValidationCheck } from "./types.js";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validateSchema = ajv.compile(productSchema);

export function validateProduct(input: unknown): ProductValidationResult {
  const checks: ValidationCheck[] = [];

  // 1. Type-check: must be a non-null object
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    checks.push({
      name: "type",
      status: "fail",
      message: "Product must be a non-null object",
    });
    return { valid: false, checks };
  }

  // 2. Validate against JSON Schema using Ajv
  const schemaValid = validateSchema(input);

  if (!schemaValid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const field = err.instancePath
        ? err.instancePath.replace(/^\//, "")
        : err.params
        ? JSON.stringify(err.params)
        : "schema";
      checks.push({
        name: field || "schema",
        status: "fail",
        message: `${err.instancePath || ""} ${err.message ?? "schema error"}`.trim(),
      });
    }
    return { valid: false, checks };
  }

  // 3. Schema passed
  checks.push({
    name: "schema",
    status: "pass",
    message: "Product matches the Agora Protocol JSON Schema",
  });

  const product = input as Record<string, unknown>;

  // 4. Warn on missing optional enrichment fields
  const optionalFields: Array<{ key: string; label: string }> = [
    { key: "images", label: "images" },
    { key: "categories", label: "categories" },
    { key: "identifiers", label: "identifiers" },
    { key: "reviews", label: "reviews" },
    { key: "shipping", label: "shipping" },
  ];

  for (const { key, label } of optionalFields) {
    if (product[key] !== undefined) {
      checks.push({
        name: label,
        status: "pass",
        message: `Optional field "${label}" is present`,
      });
    } else {
      checks.push({
        name: label,
        status: "warn",
        message: `Optional field "${label}" is missing — consider adding it for better agent compatibility`,
      });
    }
  }

  // 5. Warn if no variants
  if (product["variants"] !== undefined) {
    checks.push({
      name: "variants",
      status: "pass",
      message: "Optional field \"variants\" is present",
    });
  } else {
    checks.push({
      name: "variants",
      status: "warn",
      message: "Optional field \"variants\" is missing — consider adding variants for better agent compatibility",
    });
  }

  // valid = true only if no fail checks
  const valid = checks.every((c) => c.status !== "fail");

  return { valid, checks };
}
