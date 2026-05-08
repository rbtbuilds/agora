"use client";

import { useCountUp } from "./use-count-up";

type Format = "default" | "thousands";

function formatValue(value: number, format: Format): string {
  if (format === "thousands") return `${Math.round(value / 1000)}k`;
  return value.toLocaleString();
}

// Stacked value-on-top-of-label variant for the "What's Live" section.
// Same count-up signature as the hero, gated by IntersectionObserver so it
// fires when the section enters view rather than on first paint.
//
// Note: avoids accepting a `formatter` function prop because page.tsx is an
// RSC and React forbids passing functions across the server/client boundary.
export function LiveStat({
  target,
  suffix = "+",
  label,
  format = "default",
}: {
  target: number;
  suffix?: string;
  label: string;
  format?: Format;
}) {
  const { ref, value } = useCountUp<HTMLDivElement>(target);
  return (
    <div>
      <div ref={ref} className="text-2xl font-extrabold font-mono text-white mb-1">
        {formatValue(value, format)}
        {suffix}
      </div>
      <div className="text-xs text-secondary">{label}</div>
    </div>
  );
}
