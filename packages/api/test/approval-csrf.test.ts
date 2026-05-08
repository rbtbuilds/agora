import { describe, it, expect, vi } from "vitest";

// The CSRF guard runs before any DB access, so the mocks here only need to
// not crash if a request gets that far.
vi.mock("@agora/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  checkouts: {},
  cartItems: {},
  products: {},
  stores: {},
  paymentMethods: {},
  carts: {},
  orders: {},
}));

vi.mock("../src/lib/webhook-dispatcher.js", () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
}));

import { approvalRouter } from "../src/routes/approval.js";

describe("approval CSRF guard", () => {
  it("rejects POST /:token/confirm with no Origin or Referer", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: { host: "agora-ecru-chi.vercel.app" },
    });
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toMatch(/Request blocked/);
  });

  it("rejects POST /:token/confirm with cross-origin Origin header", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        origin: "https://evil.example.com",
      },
    });
    expect(res.status).toBe(403);
  });

  it("rejects POST /:token/confirm with cross-origin Referer header", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        referer: "https://evil.example.com/page",
      },
    });
    expect(res.status).toBe(403);
  });

  it("rejects POST /:token/deny with cross-origin Origin header", async () => {
    const res = await approvalRouter.request("/xyz789/deny", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        origin: "https://evil.example.com",
      },
    });
    expect(res.status).toBe(403);
  });

  it("allows POST /:token/confirm with same-origin Origin header (then 404 on missing checkout)", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        origin: "https://agora-ecru-chi.vercel.app",
      },
    });
    // Origin matches host, so CSRF passes — falls through to 404 (no checkout
    // row matched the token in the mocked DB).
    expect(res.status).toBe(404);
  });

  it("allows POST /:token/confirm with same-origin Referer (then 404)", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        referer: "https://agora-ecru-chi.vercel.app/approve/abc123",
      },
    });
    expect(res.status).toBe(404);
  });

  it("rejects when Origin matches but Referer doesn't (defence-in-depth)", async () => {
    const res = await approvalRouter.request("/abc123/confirm", {
      method: "POST",
      headers: {
        host: "agora-ecru-chi.vercel.app",
        origin: "https://agora-ecru-chi.vercel.app",
        referer: "https://evil.example.com/page",
      },
    });
    expect(res.status).toBe(403);
  });
});
