"use client";

import { useCountUp } from "./use-count-up";

export function HeroCounters() {
  const products = useCountUp(20000);
  const stores = useCountUp(50);
  const endpoints = useCountUp(30);

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span ref={products.ref} className="text-2xl font-bold font-mono text-white">
          {products.value.toLocaleString()}+
        </span>
        <span className="text-sm text-secondary">products</span>
      </div>
      <div className="hidden sm:block w-px h-6 bg-border" aria-hidden />
      <div className="flex items-baseline gap-2">
        <span ref={stores.ref} className="text-2xl font-bold font-mono text-white">
          {stores.value}+
        </span>
        <span className="text-sm text-secondary">stores</span>
      </div>
      <div className="hidden sm:block w-px h-6 bg-border" aria-hidden />
      <div className="flex items-baseline gap-2">
        <span ref={endpoints.ref} className="text-2xl font-bold font-mono text-white">
          {endpoints.value}+
        </span>
        <span className="text-sm text-secondary">endpoints</span>
      </div>
    </>
  );
}
