"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Wraps a chunk of content so it fades up only when the user scrolls it
// into view. Below-the-fold sections use this; above-the-fold sections use
// the CSS-only `.reveal-on-load` class so the hero is interactive instantly.
//
// Honours prefers-reduced-motion: skips the animation entirely.
export function RevealOnScroll({
  children,
  className = "",
  threshold = 0.15,
}: {
  children: ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`reveal-when-visible ${visible ? "visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
