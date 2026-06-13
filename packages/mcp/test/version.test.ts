import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VERSION } from "../src/version.js";

// Guards against the serverInfo.version drift that shipped in 0.1.2/0.2.0:
// the MCP server's self-reported version must always equal the published
// package version. If anyone re-hardcodes a literal in version.ts, this fails.
describe("mcp server version", () => {
  it("equals the package.json version (never drifts)", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version: string };
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
