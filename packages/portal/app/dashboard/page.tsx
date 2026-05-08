import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db, apiKeys, usageLogs } from "@/lib/db";
import { eq, and, gte, sql, isNull } from "drizzle-orm";
import { PlanBadge } from "../components/plan-badge";
import { SectionLabel } from "../components/section-label";
import Link from "next/link";

const TIER_LIMITS: Record<string, number> = { free: 100, pro: 10000, enterprise: 999999 };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const keys = await db.select().from(apiKeys).where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let todayUsage = 0;
  if (keys.length > 0) {
    const keyIds = keys.map((k) => k.key);
    const todayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageLogs)
      .where(and(sql`${usageLogs.apiKeyId} = ANY(${keyIds})`, gte(usageLogs.timestamp, todayStart)));
    todayUsage = Number(todayResult[0]?.count ?? 0);
  }

  const dailyLimit = TIER_LIMITS[user.tier] ?? 100;
  const usagePct = Math.min(100, Math.round((todayUsage / dailyLimit) * 100));

  return (
    <div className="max-w-4xl">
      <div className="mb-3">
        <SectionLabel>Overview</SectionLabel>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-10">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest mb-3">Plan</p>
          <div className="flex items-center gap-2">
            <PlanBadge tier={user.tier} />
            {user.tier === "free" && (
              <Link href="/dashboard/billing" className="text-xs text-accent hover:underline">
                Upgrade
              </Link>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest mb-3">Today&apos;s Requests</p>
          <p className="text-2xl font-bold font-mono text-white">
            {todayUsage.toLocaleString()}
            <span className="text-secondary text-sm font-normal font-sans"> / {dailyLimit.toLocaleString()}</span>
          </p>
          <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent"
              style={{ width: `${usagePct}%` }}
              aria-hidden
            />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest mb-3">Active Keys</p>
          <p className="text-2xl font-bold font-mono text-white">{keys.length}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/dashboard/keys"
          className="bg-accent hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
        >
          Manage API Keys
        </Link>
        <Link
          href="https://github.com/rbtbuilds/agora#sdk-usage"
          target="_blank"
          className="bg-surface border border-border hover:border-secondary text-[#e5e5e5] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Read Docs →
        </Link>
      </div>
    </div>
  );
}
