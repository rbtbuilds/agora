"use client";

import { useState, useEffect } from "react";

const PLANS = [
  {
    name: "Free", tier: "free", price: "$0", period: "forever",
    features: ["100 requests/day", "1 API key", "Keyword search", "Community support"],
  },
  {
    name: "Pro", tier: "pro", price: "$29", period: "/month",
    features: ["10,000 requests/day", "Unlimited API keys", "Semantic search", "Priority support"],
    highlight: true,
  },
  {
    name: "Enterprise", tier: "enterprise", price: "Custom", period: "",
    features: ["Unlimited requests", "Unlimited keys", "Dedicated support", "Custom SLA", "On-premise option"],
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>("free");

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setCurrentTier(d.tier ?? "free"));
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  async function handleManage() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setPortalLoading(false);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      {/* Success banner */}
      {typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("success") === "true" && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-800 rounded-xl">
            <p className="text-green-400 text-sm font-medium">
              Payment successful! You&apos;re now on the Pro plan.
            </p>
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          return (
            <div
              key={plan.tier}
              className={`bg-surface border rounded-xl p-5 flex flex-col ${
                isCurrent
                  ? "border-accent ring-1 ring-accent"
                  : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {isCurrent && (
                  <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent-border">
                    Current
                  </span>
                )}
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-secondary text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-secondary flex items-center gap-2">
                    <span className="text-price">✓</span> {f}
                  </li>
                ))}
              </ul>

              {/* Upgrade to Pro button — only if on free */}
              {plan.tier === "pro" && currentTier === "free" && (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? "Redirecting..." : "Upgrade to Pro"}
                </button>
              )}

              {/* Current plan indicator for Pro users */}
              {plan.tier === "pro" && currentTier === "pro" && (
                <button
                  onClick={handleManage}
                  disabled={portalLoading}
                  className="w-full bg-surface border border-border hover:border-[#3f3f46] text-[#e5e5e5] py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {portalLoading ? "Redirecting..." : "Manage Subscription"}
                </button>
              )}

              {/* Enterprise */}
              {plan.tier === "enterprise" && (
                <a
                  href="mailto:agora@bentolabs.co.uk?subject=Agora Enterprise"
                  className="w-full block text-center bg-surface border border-border hover:border-[#3f3f46] text-[#e5e5e5] py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Contact Us
                </a>
              )}

              {/* Free tier — show downgrade option if on Pro */}
              {plan.tier === "free" && currentTier === "free" && (
                <div className="w-full text-center text-secondary text-sm py-2">
                  Current plan
                </div>
              )}
              {plan.tier === "free" && currentTier === "pro" && (
                <div className="w-full text-center text-secondary text-sm py-2">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Manage subscription link for Pro users */}
      {currentTier === "pro" && (
        <p className="text-xs text-secondary">
          Manage your payment method, view invoices, or cancel your subscription via{" "}
          <button onClick={handleManage} className="text-accent hover:underline">
            Stripe Customer Portal
          </button>
          .
        </p>
      )}
    </div>
  );
}
