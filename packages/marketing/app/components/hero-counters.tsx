"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      started.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, value };
}

export function HeroCounters() {
  const products = useCountUp(20000);
  const stores = useCountUp(50);
  const endpoints = useCountUp(30);

  return (
    <>
      <div>
        <span ref={products.ref} className="text-2xl font-bold font-mono text-white">
          {products.value.toLocaleString()}+
        </span>
        <span className="ml-2 text-sm text-secondary">products</span>
      </div>
      <div className="w-px h-6 bg-border" />
      <div>
        <span ref={stores.ref} className="text-2xl font-bold font-mono text-white">
          {stores.value}+
        </span>
        <span className="ml-2 text-sm text-secondary">stores</span>
      </div>
      <div className="w-px h-6 bg-border" />
      <div>
        <span ref={endpoints.ref} className="text-2xl font-bold font-mono text-white">
          {endpoints.value}+
        </span>
        <span className="ml-2 text-sm text-secondary">endpoints</span>
      </div>
    </>
  );
}
