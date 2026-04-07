import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db, apiKeys, usageLogs } from "@agora/db";
import { eq, and, gte, sql, isNull } from "drizzle-orm";
import { PlanBadge } from "../components/plan-badge";
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

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-secondary text-xs uppercase tracking-wider mb-1">Plan</p>
          <div className="flex items-center gap-2">
            <PlanBadge tier={user.tier} />
            {user.tier === "free" && (
              <Link href="/dashboard/billing" className="text-xs text-accent hover:underline">Upgrade</Link>
            )}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-secondary text-xs uppercase tracking-wider mb-1">Today&apos;s Requests</p>
          <p className="text-xl font-semibold">
            {todayUsage.toLocaleString()} <span className="text-secondary text-sm font-normal">/ {dailyLimit.toLocaleString()}</span>
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-secondary text-xs uppercase tracking-wider mb-1">Active Keys</p>
          <p className="text-xl font-semibold">{keys.length}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard/keys" className="bg-accent hover:bg-[#8b5cf6] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Manage API Keys
        </Link>
        <Link href="https://github.com/rbtbuilds/agora#sdk-usage" target="_blank"
          className="bg-surface border border-border hover:border-[#3f3f46] text-[#e5e5e5] px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Read Docs →
        </Link>
      </div>
    </div>
  );
}
