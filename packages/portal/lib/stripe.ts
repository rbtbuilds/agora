import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Pin the API version so SDK upgrades don't change webhook delivery shape
// underneath us. 2026-04-22.dahlia is the version SDK v22 ships with.
// It inherits Basil's subscription period changes (period info on items,
// not the subscription itself) — see periodEndOf() in the webhook route.
// See https://docs.stripe.com/changelog/dahlia
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return _stripe;
}

// Lazy proxy so existing `stripe.xxx` call-sites keep working
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});
