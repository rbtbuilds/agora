import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";

// Stripe API 2025-03-31.basil moved current_period_{start,end} from the
// subscription level to subscription_items. For our single-price plans the
// first item's window IS the subscription window. Read it there.
function periodEndOf(sub: Stripe.Subscription): Date {
  const item = sub.items.data[0];
  const ts = (item as { current_period_end?: number }).current_period_end;
  if (typeof ts === "number") return new Date(ts * 1000);
  // Defensive fallback: if Stripe ever omits the field, push the date out a
  // month so we don't accidentally mark the subscription expired.
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        userId,
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0].price.id,
        tier: "pro",
        status: "active",
        currentPeriodEnd: periodEndOf(sub),
      });
      await db.update(users).set({ tier: "pro" }).where(eq(users.id, userId));
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      await db.update(subscriptions)
        .set({ status: sub.status, currentPeriodEnd: periodEndOf(sub) })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await db.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.stripeSubscriptionId, sub.id));
      const subRecord = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, sub.id)).limit(1);
      if (subRecord[0]) {
        await db.update(users).set({ tier: "free" }).where(eq(users.id, subRecord[0].userId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
