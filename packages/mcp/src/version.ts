import { readFileSync } from "node:fs";

// Resolve the version from package.json at runtime so the MCP server's
// self-reported serverInfo.version can never drift from the published package
// version. Works in dev (tsx: src/../package.json) and when published
// (dist/index.js -> ../package.json at the package root).
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

export const VERSION: string = pkg.version;
