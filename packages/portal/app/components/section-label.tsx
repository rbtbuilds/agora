// Reusable pill label — matches the marketing design language so portal
// sections feel like part of the same product.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono">
      {children}
    </span>
  );
}
