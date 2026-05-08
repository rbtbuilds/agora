"use client";

import { useState } from "react";

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  async function handleUpgrade() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }
  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {loading ? "Redirecting..." : "Upgrade to Pro"}
    </button>
  );
}

export function ManageButton({
  variant = "primary",
  children = "Manage Subscription",
}: {
  variant?: "primary" | "link";
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  async function handleManage() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }

  if (variant === "link") {
    return (
      <button onClick={handleManage} disabled={loading} className="text-accent hover:underline disabled:opacity-50">
        {loading ? "Redirecting..." : children}
      </button>
    );
  }

  return (
    <button
      onClick={handleManage}
      disabled={loading}
      className="w-full bg-surface border border-border hover:border-[#3f3f46] text-[#e5e5e5] py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {loading ? "Redirecting..." : children}
    </button>
  );
}
