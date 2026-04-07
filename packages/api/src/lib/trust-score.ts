import { db, stores, storeAnalytics } from "@agora/db";
import { eq, sql } from "drizzle-orm";

export interface TrustScore {
  score: number;
  breakdown: {
    protocol: number;
    dataQuality: number;
    activity: number;
  };
  details: string[];
}

export async function computeTrustScore(storeId: string): Promise<TrustScore> {
  const details: string[] = [];
  let protocol = 0;
  let dataQuality = 0;
  let activity = 0;

  // Get store
  const storeResult = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (storeResult.length === 0) {
    return { score: 0, breakdown: { protocol: 0, dataQuality: 0, activity: 0 }, details: ["Store not found"] };
  }
  const store = storeResult[0];

  // Protocol compliance
  if (store.source === "native") {
    protocol += 20;
    details.push("+20 agora.json discoverable");
  }
  const caps = (store.capabilities ?? {}) as Record<string, string>;
  if (store.agoraJsonUrl) {
    // Check capabilities from stored data
    if (caps.search) { protocol += 5; details.push("+5 search capability"); }
    if (caps.cart) { protocol += 5; details.push("+5 cart capability"); }
    if (caps.checkout) { protocol += 5; details.push("+5 checkout capability"); }
    // We assume auth/rate_limits/data_policy were checked at registration
    // Add points based on validationScore if it exists
    if ((store.validationScore ?? 0) >= 70) { protocol += 15; details.push("+15 full manifest sections"); }
    else if ((store.validationScore ?? 0) >= 50) { protocol += 10; details.push("+10 partial manifest sections"); }
  }

  // Data quality
  if (store.productCount > 0) {
    dataQuality += 5;
    details.push("+5 has products");
  }
  if (store.productCount >= 100) {
    dataQuality += 10;
    details.push("+10 100+ products");
  }
  if (store.productCount >= 500) {
    dataQuality += 5;
    details.push("+5 500+ products");
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (store.lastSyncedAt && store.lastSyncedAt >= sevenDaysAgo) {
    dataQuality += 10;
    details.push("+10 synced in last 7 days");
  }

  // Activity
  const analyticsResult = await db
    .select({
      totalQueries: sql<number>`coalesce(sum(${storeAnalytics.queryCount}), 0)`,
      recentQueries: sql<number>`coalesce(sum(case when ${storeAnalytics.date} >= ${sevenDaysAgo} then ${storeAnalytics.queryCount} else 0 end), 0)`,
    })
    .from(storeAnalytics)
    .where(eq(storeAnalytics.storeId, storeId));

  const totalQueries = Number(analyticsResult[0]?.totalQueries ?? 0);
  const recentQueries = Number(analyticsResult[0]?.recentQueries ?? 0);

  if (recentQueries > 0) {
    activity += 10;
    details.push("+10 queries in last 7 days");
  }
  if (totalQueries >= 100) {
    activity += 10;
    details.push("+10 100+ total queries");
  }

  const score = protocol + dataQuality + activity;

  // Update the store's validation score
  await db.update(stores).set({ validationScore: score }).where(eq(stores.id, storeId));

  return { score, breakdown: { protocol, dataQuality, activity }, details };
}
