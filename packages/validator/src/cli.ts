#!/usr/bin/env node
import { validateStore } from "./validate-store.js";

const url = process.argv[2];

if (!url) {
  console.error("Usage: agora-validator <store-url>");
  console.error("Example: agora-validator https://example.com");
  process.exit(1);
}

async function main() {
  console.log(`\nValidating ${url}...\n`);
  const result = await validateStore(url);
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "\u2713" : check.status === "warn" ? "!" : "\u2717";
    const color = check.status === "pass" ? "\x1b[32m" : check.status === "warn" ? "\x1b[33m" : "\x1b[31m";
    console.log(`  ${color}${icon}\x1b[0m ${check.name}: ${check.message}`);
  }
  console.log(`\n  Score: ${result.score}/100`);
  console.log(`  Products sampled: ${result.productsSampled}`);
  console.log(`  Product errors: ${result.productErrors}`);
  console.log(`  Result: ${result.valid ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}\n`);
  process.exit(result.valid ? 0 : 1);
}

main();
