function PlanBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-800 text-zinc-300 border-zinc-700",
    pro: "bg-accent/20 text-accent border-accent-border",
    enterprise: "bg-amber-900/30 text-amber-400 border-amber-800",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${colors[tier] ?? colors.free}`}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}
export { PlanBadge };
