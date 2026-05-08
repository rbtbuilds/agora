import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { UpgradeButton, ManageButton } from "./plan-actions";

const PLANS = [
  {
    name: "Free",
    tier: "free",
    price: "$0",
    period: "forever",
    features: ["100 requests/day", "1 API key", "Keyword search", "Community support"],
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$29",
    period: "/month",
    features: ["10,000 requests/day", "Unlimited API keys", "Semantic search", "Priority support"],
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited requests", "Unlimited keys", "Dedicated support", "Custom SLA", "On-premise option"],
  },
] as const;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentTier = user.tier ?? "free";
  const params = await searchParams;
  const showSuccess = params.success === "true";

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      {showSuccess && (
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
                isCurrent ? "border-accent ring-1 ring-accent" : "border-border"
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

              {plan.tier === "pro" && currentTier === "free" && <UpgradeButton />}
              {plan.tier === "pro" && currentTier === "pro" && <ManageButton />}
              {plan.tier === "enterprise" && (
                <a
                  href="mailto:agora@bentolabs.co.uk?subject=Agora Enterprise"
                  className="w-full block text-center bg-surface border border-border hover:border-[#3f3f46] text-[#e5e5e5] py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Contact Us
                </a>
              )}
              {plan.tier === "free" && currentTier === "free" && (
                <div className="w-full text-center text-secondary text-sm py-2">Current plan</div>
              )}
              {plan.tier === "free" && currentTier === "pro" && (
                <div className="w-full text-center text-secondary text-sm py-2">—</div>
              )}
            </div>
          );
        })}
      </div>

      {currentTier === "pro" && (
        <p className="text-xs text-secondary">
          Manage your payment method, view invoices, or cancel your subscription via{" "}
          <ManageButton variant="link">Stripe Customer Portal</ManageButton>.
        </p>
      )}
    </div>
  );
}
