"use client";
import Link from "next/link";
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
    <nav className="w-56 border-r border-border p-4 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <PlanBadge tier={user.tier} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                isActive ? "bg-accent/10 text-accent" : "text-secondary hover:text-[#e5e5e5] hover:bg-surface"
              }`}>
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-auto">
        <Link href="https://github.com/rbtbuilds/agora" target="_blank" className="text-xs text-secondary hover:text-[#e5e5e5] transition-colors">
          GitHub →
        </Link>
      </div>
    </nav>
  );
}
export { Nav };
