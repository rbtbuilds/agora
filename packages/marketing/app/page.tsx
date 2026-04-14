"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Animated Counter Hook ─── */
function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, value };
}

/* ─── Stagger Reveal Hook ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ─── Role Card Data ─── */
const roles = [
  {
    id: "developer",
    icon: "</>",
    title: "Developer",
    subtitle: "Build agents that shop",
  },
  {
    id: "store-owner",
    icon: "\u25A3",
    title: "Store Owner",
    subtitle: "Make your store agent-ready",
  },
  {
    id: "investor",
    icon: "\u2197",
    title: "Investor",
    subtitle: "The infrastructure opportunity",
  },
] as const;

/* ─── Store Features ─── */
const storeFeatures = [
  { icon: "\u25CB", label: "Registry listing", desc: "Discoverable by every agent on the network" },
  { icon: "\u25CB", label: "Analytics dashboard", desc: "See which agents browse, cart, and buy" },
  { icon: "\u25CB", label: "Trust score", desc: "Verified store badge and reliability rating" },
  { icon: "\u25CB", label: "Webhooks", desc: "Real-time notifications for agent actions" },
  { icon: "\u25CB", label: "Agent purchases", desc: "Automated checkout with order tracking" },
  { icon: "\u25CB", label: "Cross-store matching", desc: "Surface your products in multi-store searches" },
];

/* ─── Architecture Steps ─── */
const archSteps = ["Protocol", "Registry", "Search", "Cart", "Checkout", "Order"];

export default function Home() {
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const products = useCountUp(22562);
  const stores = useCountUp(52);
  const endpoints = useCountUp(30);

  const heroReveal = useReveal();
  const statsReveal = useReveal();
  const devReveal = useReveal();
  const storeReveal = useReveal();
  const investorReveal = useReveal();

  const handleRoleClick = useCallback((id: string) => {
    setActiveRole(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(167,139,250,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Ambient Gradient */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none opacity-30"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent, rgba(167,139,250,0.08), transparent, rgba(167,139,250,0.05), transparent)",
          animation: "spin 20s linear infinite",
        }}
      />

      <style>{`
        @keyframes spin { to { transform: translateX(-50%) rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }
      `}</style>

      <main className="relative z-10">
        {/* ═══ HERO ═══ */}
        <section className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
          <div
            ref={heroReveal.ref}
            className={`reveal ${heroReveal.visible ? "visible" : ""}`}
          >
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Protocol v1.0
              </span>
            </div>

            <h1 className="text-7xl sm:text-8xl font-extrabold tracking-tight leading-none mb-6">
              Agora
            </h1>

            <p className="text-xl sm:text-2xl text-secondary max-w-2xl leading-relaxed mb-6">
              The internet&apos;s missing commerce layer.
              <br />
              Built for AI agents. Open for everyone.
            </p>

            <p className="text-base text-secondary/70 max-w-xl leading-relaxed mb-16">
              The internet was built for human browsers. AI agents need to discover, search, and purchase from stores programmatically - but there&apos;s no standard interface for that. Agora is the open protocol that makes every store agent-ready.
            </p>

            {/* Role Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              {roles.map((role, i) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleClick(role.id)}
                  className={`reveal ${heroReveal.visible ? "visible" : ""} reveal-delay-${i + 1} group text-left p-5 rounded-xl border transition-all duration-300 ${
                    activeRole === role.id
                      ? "border-accent bg-accent-dim"
                      : "border-border bg-surface hover:border-secondary"
                  }`}
                >
                  <div className="text-2xl font-mono text-accent mb-3 transition-transform duration-300 group-hover:translate-x-1">
                    {role.icon}
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">
                    {role.title}
                  </div>
                  <div className="text-xs text-secondary">{role.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ STATS BANNER ═══ */}
        <section
          ref={statsReveal.ref}
          className={`reveal ${statsReveal.visible ? "visible" : ""} border-y border-border py-6 px-6`}
        >
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <span ref={products.ref} className="text-2xl font-bold font-mono text-white">
                  {products.value.toLocaleString()}
                </span>
                <span className="ml-2 text-sm text-secondary">products</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div>
                <span ref={stores.ref} className="text-2xl font-bold font-mono text-white">
                  {stores.value}
                </span>
                <span className="ml-2 text-sm text-secondary">stores</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div>
                <span ref={endpoints.ref} className="text-2xl font-bold font-mono text-white">
                  {endpoints.value}+
                </span>
                <span className="ml-2 text-sm text-secondary">endpoints</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="text-sm font-mono text-secondary">Protocol v1.0</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-green-500"
                style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
              />
              <span className="text-xs font-mono uppercase tracking-wider text-green-400">
                Network Operational
              </span>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono mb-6">
              How It Works
            </span>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
              Three layers. One protocol.
            </h2>
            <p className="text-lg text-secondary max-w-2xl mb-16">
              Agora connects AI agents to e-commerce stores through an open protocol. Stores publish a manifest describing their capabilities. Agents discover stores through a public registry. Purchases happen through a consumer-approved transaction layer.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
              <div>
                <div className="text-xs font-mono text-accent uppercase tracking-wider mb-3">01 Discover</div>
                <div className="text-sm font-semibold text-white mb-2">Stores serve agora.json</div>
                <p className="text-sm text-secondary leading-relaxed">
                  Like robots.txt tells crawlers what to index, agora.json tells agents what a store sells and how to buy it. A simple JSON manifest at <code className="text-accent/80">/.well-known/agora.json</code> declares the store&apos;s products endpoint, search capabilities, authentication, and rate limits.
                </p>
              </div>
              <div>
                <div className="text-xs font-mono text-accent uppercase tracking-wider mb-3">02 Search</div>
                <div className="text-sm font-semibold text-white mb-2">Agents query the network</div>
                <p className="text-sm text-secondary leading-relaxed">
                  The public registry indexes every protocol-compliant store. Agents search across all stores simultaneously - one query returns products from 52 stores, ranked by relevance. Cross-store matching finds the same product at different prices. Trust scores surface the most reliable stores.
                </p>
              </div>
              <div>
                <div className="text-xs font-mono text-accent uppercase tracking-wider mb-3">03 Transact</div>
                <div className="text-sm font-semibold text-white mb-2">Consumers approve, agents buy</div>
                <p className="text-sm text-secondary leading-relaxed">
                  Agents build carts and request checkout. Consumers approve each purchase either inline (&quot;Buy these boots for $89?&quot;) or via a secure approval link. Tokenized payments mean Agora never stores card numbers. Stores receive order notifications via webhooks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ DEVELOPER SECTION ═══ */}
        <section id="developer" className="py-28 px-6 scroll-mt-8">
          <div
            ref={devReveal.ref}
            className={`reveal ${devReveal.visible ? "visible" : ""} max-w-5xl mx-auto`}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono mb-6">
              For Developers
            </span>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Build agents that shop
            </h2>
            <p className="text-lg text-secondary max-w-2xl mb-6">
              Your agent shouldn&apos;t need to scrape HTML, reverse-engineer checkout flows, or handle a different API for every store. Agora gives you one unified interface to search 22,000+ products, compare prices across stores, and complete purchases - all through a single SDK.
            </p>
            <p className="text-base text-secondary/70 max-w-2xl mb-12">
              Three integration paths: a TypeScript SDK with built-in caching, an MCP server for Claude and ChatGPT, or direct REST API calls. Full OpenAPI spec at <a href="https://agora-ecru-chi.vercel.app/openapi.json" className="text-accent hover:underline">/openapi.json</a> and an interactive playground to test every endpoint before writing a line of code.
            </p>

            {/* SDK Code Block */}
            <div className="mb-8">
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-3">
                SDK Usage
              </div>
              <div className="bg-surface border border-border rounded-xl p-6 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                  <code>
                    <span className="text-accent">import</span>
                    <span className="text-white"> {"{"} Agora {"}"} </span>
                    <span className="text-accent">from</span>
                    <span className="text-green-400"> &apos;agora-sdk&apos;</span>
                    {"\n\n"}
                    <span className="text-accent">const</span>
                    <span className="text-white"> agora = </span>
                    <span className="text-accent">new</span>
                    <span className="text-white"> Agora({"{"} </span>
                    <span className="text-blue-400">apiKey</span>
                    <span className="text-white">: </span>
                    <span className="text-green-400">&apos;ak_your_key&apos;</span>
                    <span className="text-white"> {"}"})</span>
                    {"\n\n"}
                    <span className="text-accent">const</span>
                    <span className="text-white"> results = </span>
                    <span className="text-accent">await</span>
                    <span className="text-white"> agora.</span>
                    <span className="text-blue-400">search</span>
                    <span className="text-white">(</span>
                    <span className="text-green-400">&apos;hiking boots under $100&apos;</span>
                    <span className="text-white">)</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* MCP Config Block */}
            <div className="mb-12">
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-3">
                MCP Server Config
              </div>
              <div className="bg-surface border border-border rounded-xl p-6 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed text-secondary">
                  <code>
                    <span className="text-white">{"{"}</span>
                    {"\n"}
                    <span className="text-white">{"  "}&quot;</span>
                    <span className="text-blue-400">mcpServers</span>
                    <span className="text-white">&quot;: {"{"}</span>
                    {"\n"}
                    <span className="text-white">{"    "}&quot;</span>
                    <span className="text-blue-400">agora</span>
                    <span className="text-white">&quot;: {"{"}</span>
                    {"\n"}
                    <span className="text-white">{"      "}&quot;</span>
                    <span className="text-blue-400">url</span>
                    <span className="text-white">&quot;: </span>
                    <span className="text-green-400">&quot;https://agora-ecru-chi.vercel.app/mcp&quot;</span>
                    {"\n"}
                    <span className="text-white">{"    }"}</span>
                    {"\n"}
                    <span className="text-white">{"  }"}</span>
                    {"\n"}
                    <span className="text-white">{"}"}</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <a
                href="https://agora-ecru-chi.vercel.app/playground"
                className="inline-flex items-center px-6 py-3 rounded-lg bg-accent text-white text-sm font-semibold transition-all duration-200 hover:brightness-110"
              >
                API Playground
              </a>
              <a
                href="mailto:ceo@bentolabs.co.uk?subject=Agora%20API%20Key%20Request"
                className="inline-flex items-center px-6 py-3 rounded-lg border border-border text-sm font-semibold text-secondary transition-all duration-200 hover:border-secondary hover:text-white"
              >
                Request API Keys
              </a>
            </div>
          </div>
        </section>

        {/* ═══ STORE OWNER SECTION ═══ */}
        <section id="store-owner" className="py-28 px-6 border-t border-border scroll-mt-8">
          <div
            ref={storeReveal.ref}
            className={`reveal ${storeReveal.visible ? "visible" : ""} max-w-5xl mx-auto`}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono mb-6">
              For Store Owners
            </span>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Make your store agent-ready
            </h2>
            <p className="text-lg text-secondary max-w-2xl mb-6">
              AI agents are the next sales channel. When a consumer tells their AI assistant to &quot;find me hiking boots under $100,&quot; your store should be in those results. Agora makes that happen - instantly for Shopify stores, or through a simple protocol spec for custom platforms.
            </p>
            <p className="text-base text-secondary/70 max-w-2xl mb-6">
              Stores that join the protocol get listed in a public registry that every agent on the network can query. You get analytics showing how agents interact with your products, a trust score that boosts your visibility, and webhook notifications for every search, view, and purchase.
            </p>
            <p className="text-base text-secondary/70 max-w-2xl mb-12">
              For Shopify stores, it&apos;s a single API call - no code changes, no app installs, no configuration. We generate your protocol manifest, proxy your product feed in the standard format, and register you in the public registry. For custom platforms, implement two endpoints and validate with our CLI tool.
            </p>

            {/* Shopify Adapter Code Block */}
            <div className="mb-12">
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-3">
                Shopify Adapter
              </div>
              <div className="bg-surface border border-border rounded-xl p-6 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                  <code>
                    <span className="text-accent">curl</span>
                    <span className="text-white"> -X POST https://agora-ecru-chi.vercel.app/v1/adapter/shopify \</span>
                    {"\n"}
                    <span className="text-white">{"  "}-d </span>
                    <span className="text-green-400">&apos;{"{\"url\": \"https://your-store.com\"}"}&apos;</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 mb-12">
              {storeFeatures.map((f) => (
                <div key={f.label} className="flex items-start gap-3 py-2">
                  <span className="text-accent mt-0.5 text-lg leading-none">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{f.label}</div>
                    <div className="text-xs text-secondary mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Validator */}
            <div>
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-3">
                Validate your store
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 inline-block">
                <code className="text-sm font-mono">
                  <span className="text-accent">npx</span>
                  <span className="text-white"> @agora/validator </span>
                  <span className="text-secondary">https://yourstore.com</span>
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ INVESTOR SECTION ═══ */}
        <section id="investor" className="py-28 px-6 border-t border-border scroll-mt-8">
          <div
            ref={investorReveal.ref}
            className={`reveal ${investorReveal.visible ? "visible" : ""} max-w-5xl mx-auto`}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono mb-6">
              For Investors
            </span>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              The infrastructure layer
              <br />
              for agent commerce
            </h2>
            <p className="text-lg text-secondary max-w-2xl mb-6">
              The internet is being rebuilt for AI agents. Today, agents can read, write, and reason - but they can&apos;t buy. There&apos;s no standard way for an AI to discover what a store sells, compare prices, or complete a purchase. Agora is that standard.
            </p>
            <p className="text-base text-secondary/70 max-w-2xl mb-6">
              Like Stripe built the payment rails for the internet, Agora is building the commerce rails for the agent era. Stores implement a simple protocol (<code className="text-accent/80">agora.json</code> at <code className="text-accent/80">/.well-known/</code>), agents discover them through a public registry, and transactions flow through a consumer-approved checkout layer.
            </p>
            <p className="text-base text-secondary/70 max-w-2xl mb-16">
              The protocol is live. The registry is public. The transaction layer works end-to-end. 52 stores and 22,562 products are already indexed. The Shopify adapter means any of 4 million+ merchants can join with a single API call. The question isn&apos;t whether agent commerce will happen - it&apos;s who builds the infrastructure.
            </p>

            {/* Key Data Points */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-20">
              {[
                { value: "4M+", label: "Shopify stores", sub: "Addressable market" },
                { value: "Full", label: "Transaction layer", sub: "Search to checkout" },
                { value: "Open", label: "Protocol standard", sub: "MIT licensed" },
              ].map((d) => (
                <div key={d.label} className="py-6 pr-8">
                  <div className="text-3xl font-extrabold font-mono text-white mb-1">{d.value}</div>
                  <div className="text-sm font-semibold text-white mb-1">{d.label}</div>
                  <div className="text-xs text-secondary">{d.sub}</div>
                </div>
              ))}
            </div>

            {/* The Moat */}
            <div className="mb-20">
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-6">
                The Moat
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {[
                  {
                    title: "Protocol standard",
                    desc: "Like HTTP defined how browsers talk to servers, agora.json defines how agents talk to stores. Network effects compound with every adoption. Each new store makes the protocol more valuable for agents, each new agent makes it more valuable for stores. Open standard, MIT licensed - impossible to route around.",
                  },
                  {
                    title: "Discovery registry",
                    desc: "The public registry is the DNS of agent commerce. Agents don't need to know store URLs - they query the registry. Stores are ranked by trust score, analytics, and protocol compliance. First-mover advantage in building the canonical directory.",
                  },
                  {
                    title: "Commerce rail",
                    desc: "Every agent purchase flows through Agora's checkout layer. Consumer-approved payments via tokenized cards (Stripe). Transaction fees on every purchase that scales linearly with network volume. Infrastructure-grade recurring revenue.",
                  },
                ].map((m) => (
                  <div key={m.title}>
                    <div className="text-sm font-semibold text-white mb-2">{m.title}</div>
                    <div className="text-sm text-secondary leading-relaxed">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Flow */}
            <div>
              <div className="text-xs font-mono text-secondary uppercase tracking-wider mb-6">
                Architecture
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {archSteps.map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="px-4 py-2 rounded-lg bg-surface border border-border text-sm font-mono text-white">
                      {step}
                    </span>
                    {i < archSteps.length - 1 && (
                      <span className="text-secondary text-lg">&rsaquo;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ WHAT'S LIVE ═══ */}
        <section className="py-28 px-6 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs tracking-widest uppercase text-secondary font-mono mb-6">
              Live Now
            </span>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
              This isn&apos;t a whitepaper
            </h2>
            <p className="text-lg text-secondary max-w-2xl mb-16">
              Everything described on this page is deployed and running in production. Try any endpoint right now.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-16">
              {[
                { value: "22,562", label: "Products indexed" },
                { value: "52", label: "Stores on network" },
                { value: "30+", label: "API endpoints" },
                { value: "50", label: "Automated tests" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-extrabold font-mono text-white mb-1">{s.value}</div>
                  <div className="text-xs text-secondary">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: "Protocol spec + JSON Schemas", desc: "Formal specification with machine-readable validation" },
                { label: "CLI validator", desc: "npx @agora/validator checks any store's compliance" },
                { label: "Public registry", desc: "Searchable directory with analytics and trust scoring" },
                { label: "Shopify adapter", desc: "Zero-config onboarding for 4M+ Shopify stores" },
                { label: "Commerce transaction layer", desc: "Cart, checkout, and orders with consumer approval" },
                { label: "Webhook event system", desc: "HMAC-signed notifications for searches, views, and purchases" },
                { label: "Cross-store matching", desc: "Find the same product at different stores and prices" },
                { label: "Interactive API playground", desc: "Test every endpoint in your browser" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 py-2">
                  <span className="text-accent mt-1 text-sm">&#10003;</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="text-xs text-secondary mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-border py-12 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center gap-6 mb-8">
              {[
                { label: "GitHub", href: "https://github.com/rbtbuilds/agora" },
                { label: "API Playground", href: "https://agora-ecru-chi.vercel.app/playground" },
                { label: "Developer Portal", href: "mailto:ceo@bentolabs.co.uk?subject=Agora%20Portal%20Access" },
                { label: "Demo", href: "https://demo-five-coral-13.vercel.app" },
                { label: "Protocol Spec", href: "https://github.com/rbtbuilds/agora/blob/main/docs/protocol/spec.md" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-secondary hover:text-white transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="text-xs font-mono text-secondary">
              Agora Protocol v1.0 - Protocol, SDK, and tools: MIT. Platform: BSL 1.1.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
