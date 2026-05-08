"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PlanBadge } from "./plan-badge";

interface NavProps {
  user: { name: string; avatarUrl: string; tier: string };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/keys", label: "API Keys" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

function Nav({ user }: NavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="w-56 border-r border-border p-4 flex flex-col gap-6">
      <Link href="/dashboard" className="flex items-center gap-3 group">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name || "Account avatar"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface border border-border" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
            {user.name}
          </p>
          <PlanBadge tier={user.tier} />
        </div>
      </Link>
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-secondary hover:text-white hover:bg-surface"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-auto pt-4 border-t border-border">
        <Link
          href="https://github.com/rbtbuilds/agora"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-secondary hover:text-white transition-colors"
        >
          GitHub →
        </Link>
      </div>
    </nav>
  );
}
export { Nav };
