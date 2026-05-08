import { describe, it, expect } from "vitest";
import { validateExternalUrl } from "../src/lib/url-validator.js";

describe("validateExternalUrl — SSRF guard", () => {
  describe("scheme enforcement", () => {
    it("accepts https URLs", () => {
      expect(validateExternalUrl("https://example.com").valid).toBe(true);
    });

    it("rejects http URLs", () => {
      const r = validateExternalUrl("http://example.com");
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/HTTPS/i);
    });

    it("rejects file:// URLs", () => {
      expect(validateExternalUrl("file:///etc/passwd").valid).toBe(false);
    });

    it("rejects ftp:// URLs", () => {
      expect(validateExternalUrl("ftp://example.com").valid).toBe(false);
    });

    it("rejects gopher:// URLs", () => {
      expect(validateExternalUrl("gopher://example.com").valid).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(validateExternalUrl("not a url").valid).toBe(false);
      expect(validateExternalUrl("").valid).toBe(false);
    });
  });

  describe("hostname blocklist", () => {
    it.each([
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "metadata.google.internal",
      "169.254.169.254",
    ])("rejects %s", (host) => {
      const r = validateExternalUrl(`https://${host}/`);
      expect(r.valid).toBe(false);
    });

    it("rejection is case-insensitive", () => {
      expect(validateExternalUrl("https://LOCALHOST/").valid).toBe(false);
      expect(validateExternalUrl("https://LocalHost/").valid).toBe(false);
    });
  });

  describe("private IPv4 ranges", () => {
    it.each([
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "192.168.255.255",
      "127.0.0.1",
      "127.1.2.3",
      "169.254.0.1",
    ])("rejects %s", (ip) => {
      expect(validateExternalUrl(`https://${ip}/`).valid).toBe(false);
    });

    it("does not over-block 172.32+ (outside RFC1918 172.16/12)", () => {
      // 172.32.x.x is public.
      expect(validateExternalUrl("https://172.32.0.1/").valid).toBe(true);
    });

    it("does not over-block 172.0–15 (outside RFC1918)", () => {
      expect(validateExternalUrl("https://172.0.0.1/").valid).toBe(true);
      expect(validateExternalUrl("https://172.15.255.255/").valid).toBe(true);
    });
  });

  describe("alternate IP encodings", () => {
    it("rejects octal-encoded localhost (0177.0.0.1)", () => {
      expect(validateExternalUrl("https://0177.0.0.1/").valid).toBe(false);
    });

    it("rejects octal in any octet", () => {
      expect(validateExternalUrl("https://10.00.0.1/").valid).toBe(false);
    });

    it("rejects decimal IP (2130706433 = 127.0.0.1)", () => {
      expect(validateExternalUrl("https://2130706433/").valid).toBe(false);
    });

    it("rejects hex IP (0x7f000001 = 127.0.0.1)", () => {
      expect(validateExternalUrl("https://0x7f000001/").valid).toBe(false);
    });

    it("rejects IPv6 bracketed notation", () => {
      expect(validateExternalUrl("https://[::1]/").valid).toBe(false);
      expect(validateExternalUrl("https://[fe80::1]/").valid).toBe(false);
    });
  });

  describe("public hostnames pass", () => {
    it.each([
      "https://example.com/",
      "https://api.shopify.com/",
      "https://store.example.com/products.json",
      "https://shop.example.co.uk/",
      "https://172.32.0.1/",
      "https://8.8.8.8/",
    ])("accepts %s", (url) => {
      expect(validateExternalUrl(url).valid).toBe(true);
    });
  });
});
