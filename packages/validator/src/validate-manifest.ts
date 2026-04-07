import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import manifestSchema from "./schema/agora-manifest.schema.json" with { type: "json" };
import type { ManifestValidationResult, ValidationCheck, AgoraManifest } from "./types.js";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validateSchema = ajv.compile(manifestSchema);

export function validateManifest(input: unknown): ManifestValidationResult {
  const checks: ValidationCheck[] = [];

  // 1. Type-check: must be a non-null object
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    checks.push({
      name: "type",
      status: "fail",
      message: "Manifest must be a non-null object",
    });
    return { valid: false, checks, manifest: null };
  }

  // 2. Validate against JSON Schema using Ajv
  const schemaValid = validateSchema(input);

  if (!schemaValid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const field = err.instancePath ? err.instancePath.replace(/^\//, "") : err.params
        ? JSON.stringify(err.params)
        : "schema";
      checks.push({
        name: field || "schema",
        status: "fail",
        message: `${err.instancePath || ""} ${err.message ?? "schema error"}`.trim(),
      });
    }
    return { valid: false, checks, manifest: null };
  }

  // Schema passed
  checks.push({
    name: "schema",
    status: "pass",
    message: "Manifest matches the Agora Protocol JSON Schema",
  });

  const manifest = input as AgoraManifest;

  // 3. Check version === "1.0"
  if (manifest.version === "1.0") {
    checks.push({
      name: "version",
      status: "pass",
      message: "Protocol version is 1.0",
    });
  } else {
    checks.push({
      name: "version",
      status: "fail",
      message: `Unsupported protocol version: ${manifest.version}. Expected "1.0"`,
    });
  }

  // 4. Check required capabilities
  const caps = manifest.capabilities as Record<string, unknown> | undefined;
  if (caps?.["products"] && caps?.["product"]) {
    checks.push({
      name: "capabilities",
      status: "pass",
      message: "Required capabilities (products, product) are present",
    });
  } else {
    const missing: string[] = [];
    if (!caps?.["products"]) missing.push("products");
    if (!caps?.["product"]) missing.push("product");
    checks.push({
      name: "capabilities",
      status: "fail",
      message: `Missing required capabilities: ${missing.join(", ")}`,
    });
  }

  // 5. Warn on missing optional sections
  const optionalSections: Array<{ key: keyof AgoraManifest; label: string }> = [
    { key: "auth", label: "auth" },
    { key: "rate_limits", label: "rate_limits" },
    { key: "data_policy", label: "data_policy" },
  ];

  for (const { key, label } of optionalSections) {
    if (manifest[key] !== undefined) {
      checks.push({
        name: label,
        status: "pass",
        message: `Optional section "${label}" is present`,
      });
    } else {
      checks.push({
        name: label,
        status: "warn",
        message: `Optional section "${label}" is missing — consider adding it for better agent compatibility`,
      });
    }
  }

  // valid = true only if no fail checks
  const valid = checks.every((c) => c.status !== "fail");

  return { valid, checks, manifest: valid ? manifest : null };
}
