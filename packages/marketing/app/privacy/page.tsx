import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Agora",
  description: "How Agora collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "2026-05-08";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-28 text-secondary">
      <Link href="/" className="text-sm font-mono text-accent hover:underline">
        ← Back to Agora
      </Link>

      <div className="mt-8 mb-2">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono">
          Legal
        </span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-white mt-4 mb-2">
        Privacy Policy
      </h1>
      <p className="font-mono text-xs uppercase tracking-widest mb-12">
        Last updated {LAST_UPDATED}
      </p>

      <Section title="What we collect">
        <p>
          Agora collects only what&apos;s needed to operate the service:
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li>
            <strong className="text-white">GitHub profile data</strong> when you sign in: your
            GitHub user ID, username, display name, email, and avatar URL.
          </li>
          <li>
            <strong className="text-white">API usage telemetry</strong>: which endpoints your
            API key calls, response status codes, and timestamps. We do not log request bodies.
          </li>
          <li>
            <strong className="text-white">Billing data via Stripe</strong>: if you subscribe,
            Stripe processes your card. We store only your Stripe customer ID and subscription
            status; we never see card numbers or CVCs.
          </li>
          <li>
            <strong className="text-white">Store registry data</strong>: store URLs you register,
            their public manifests, and metadata derived from them.
          </li>
        </ul>
      </Section>

      <Section title="What we don't collect">
        <ul className="list-disc pl-6 space-y-2">
          <li>Browsing behavior outside the dashboard.</li>
          <li>Card numbers or payment instrument details (handled by Stripe).</li>
          <li>The contents of agent search queries beyond what&apos;s necessary to fulfil them.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>To operate the service, enforce rate limits, send service emails, process payments,
          and improve search and registry quality. We do not sell user data and do not use it
          to train third-party models.</p>
      </Section>

      <Section title="Data retention">
        <p>Account data is kept while your account is active. API usage logs are retained for
          90 days for analytics and abuse prevention. Stripe billing records are retained per
          tax regulations. You can delete your account at any time by emailing us.</p>
      </Section>

      <Section title="Sub-processors">
        <ul className="list-disc pl-6 space-y-2">
          <li>Vercel — hosting</li>
          <li>Neon — managed Postgres</li>
          <li>Stripe — payments and billing</li>
          <li>GitHub — OAuth identity</li>
          <li>OpenAI — semantic search embeddings (queries only, not user identity)</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>You can request a copy of your data, correct it, or delete it by emailing{" "}
          <a href="mailto:agora@bentolabs.co.uk" className="text-accent hover:underline">
            agora@bentolabs.co.uk
          </a>
          . If you&apos;re in the EEA or UK, the legal basis for processing is contract performance
          (running the service you signed up for) and legitimate interest (security and fraud
          prevention).
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Bento Labs · agora@bentolabs.co.uk
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 pb-10 border-b border-border last:border-0 last:pb-0 leading-relaxed">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  );
}
