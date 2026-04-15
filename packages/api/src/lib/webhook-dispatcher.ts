import crypto from "node:crypto";
import { db, webhooks } from "@agora/db";
import { eq } from "drizzle-orm";
import { safeFetch } from "./url-validator.js";

interface WebhookEvent {
  event: string;
  store_id: string;
  data: Record<string, unknown>;
}

export async function dispatchWebhooks(event: WebhookEvent): Promise<void> {
  // Find active webhooks for this store that subscribe to this event
  const hooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.storeId, event.store_id));

  const activeHooks = hooks.filter(
    (h) => h.active === 1 && (h.events as string[]).includes(event.event)
  );

  const payload = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  });

  // Fire all webhooks concurrently, don't await (fire and forget)
  for (const hook of activeHooks) {
    const signature = crypto
      .createHmac("sha256", hook.secret)
      .update(payload)
      .digest("hex");

    safeFetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agora-Signature": `sha256=${signature}`,
        "X-Agora-Event": event.event,
      },
      body: payload,
    }).catch((err) => {
      console.error(`Webhook delivery failed for ${hook.id}:`, err.message);
    });
  }
}
