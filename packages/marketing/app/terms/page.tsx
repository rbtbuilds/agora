import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Agora",
  description: "Terms of using the Agora protocol, API, and developer portal.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "2026-05-08";

export default function TermsPage() {
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
        Terms of Service
      </h1>
      <p className="font-mono text-xs uppercase tracking-widest mb-12">
        Last updated {LAST_UPDATED}
      </p>

      <Section title="The service">
        <p>
          Agora is an open commerce protocol with a hosted API, public registry, and developer
          portal operated by Bento Labs. By creating an account, registering a store, or making
          API calls, you agree to these terms.
        </p>
      </Section>

      <Section title="License">
        <p>
          The Agora protocol, SDK, and validator are MIT-licensed. The hosted platform — API,
          registry, portal, and ingestion infrastructure — is licensed under{" "}
          <a
            href="https://mariadb.com/bsl11/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            BSL 1.1
          </a>
          . You can self-host for non-production or non-commercial use; production commercial
          use requires a commercial license — contact us.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc pl-6 space-y-2">
          <li>No scraping or registering stores you don&apos;t own without their consent.</li>
          <li>No abuse of rate limits, no key sharing, no resale of access.</li>
          <li>No use of the network to harvest personal data or send unsolicited communications.</li>
          <li>No agent activity that would breach the terms of the underlying stores.</li>
        </ul>
      </Section>

      <Section title="API keys">
        <p>You&apos;re responsible for keeping your API keys secret. Usage from a key counts
          against your account. You can revoke a key at any time in the dashboard. We may
          revoke keys we believe to be compromised or abusive, with notice where possible.</p>
      </Section>

      <Section title="Billing">
        <p>Paid plans are billed in advance via Stripe. You can cancel at any time and you
          retain access until the end of the current period. Refunds are at our discretion;
          contact us within 14 days if something&apos;s wrong.</p>
      </Section>

      <Section title="Service availability">
        <p>We aim for high availability but provide the service &quot;as is&quot; without
          warranty. Enterprise customers can request a written SLA.</p>
      </Section>

      <Section title="Liability">
        <p>To the maximum extent permitted by law, our total liability for the service is
          capped at the amount you paid us in the 12 months preceding the claim, or £100,
          whichever is greater. We&apos;re not liable for indirect or consequential losses.</p>
      </Section>

      <Section title="Termination">
        <p>You can close your account at any time. We may suspend or terminate access for
          breach of these terms or to comply with a legal obligation. We&apos;ll give notice
          where reasonable and possible.</p>
      </Section>

      <Section title="Changes">
        <p>We&apos;ll update these terms from time to time. Material changes will be announced
          on the dashboard and via email. Continued use after a change means you accept it.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of England and Wales. Disputes are subject
          to the exclusive jurisdiction of the courts of England and Wales.</p>
      </Section>

      <Section title="Contact">
        <p>Bento Labs · agora@bentolabs.co.uk</p>
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
