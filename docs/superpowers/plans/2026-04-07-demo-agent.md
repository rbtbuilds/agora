# Agora Demo Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js demo app with a Chat tab (AI shopping agent) and Explore tab (direct product search) that showcases the Agora API.

**Architecture:** Next.js 15 App Router app in `packages/demo/`. Chat uses Vercel AI SDK with Groq (primary) + Gemini (fallback) for tool-calling LLM. Explore hits Agora API directly via server actions. Both tabs share a product card component.

**Tech Stack:** Next.js 15, Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/groq`, `@ai-sdk/google`), Tailwind CSS, Zod

---

## File Structure

```
packages/demo/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.ts
├── tsconfig.json
├── .env.local                    # Local env vars (gitignored)
├── app/
│   ├── layout.tsx                # Root layout, fonts, dark theme, metadata
│   ├── page.tsx                  # Main page — header + tab switcher + content
│   ├── globals.css               # Tailwind imports + custom scrollbar styles
│   ├── components/
│   │   ├── tabs.tsx              # Tab switcher component (Chat / Explore)
│   │   ├── chat.tsx              # Chat interface — messages, input, streaming
│   │   ├── explore.tsx           # Search bar, filters, product grid
│   │   └── product-card.tsx      # Shared product card (used by both tabs)
│   ├── actions/
│   │   └── search.ts             # Server action: search Agora API
│   └── api/
│       └── chat/
│           └── route.ts          # AI SDK streaming route handler
└── public/
    └── favicon.ico
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `packages/demo/package.json`
- Create: `packages/demo/next.config.ts`
- Create: `packages/demo/tailwind.config.ts`
- Create: `packages/demo/postcss.config.ts`
- Create: `packages/demo/tsconfig.json`
- Create: `packages/demo/app/globals.css`
- Create: `packages/demo/app/layout.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@agora/demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "ai": "^4",
    "@ai-sdk/react": "^1",
    "@ai-sdk/groq": "^1",
    "@ai-sdk/google": "^1",
    "zod": "^3.25"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.7",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

- [ ] **Step 2: Create next.config.ts**

```typescript
// packages/demo/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Create tailwind.config.ts**

```typescript
// packages/demo/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#18181b",
        border: "#27272a",
        accent: "#a78bfa",
        "accent-dim": "#1e1b2e",
        "accent-border": "#2d2640",
        price: "#22c55e",
        secondary: "#a1a1aa",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Create postcss.config.ts**

```typescript
// packages/demo/postcss.config.ts
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create globals.css**

```css
/* packages/demo/app/globals.css */
@import "tailwindcss";

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 3px;
}
```

- [ ] **Step 7: Create root layout**

```tsx
// packages/demo/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora Demo — AI Shopping Agent",
  description:
    "Search and discover products across e-commerce stores using AI. Powered by the Agora API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-[#e5e5e5] font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd /Users/matthewgoralczyk/Desktop/AI\ infrastructure/agora
npm install
```

- [ ] **Step 9: Verify Next.js builds**

```bash
cd packages/demo
npx next build
```

Expected: Build succeeds (with warning about no pages — that's fine).

- [ ] **Step 10: Commit**

```bash
cd ../..
git add packages/demo/
git commit -m "feat(demo): scaffold Next.js project with Tailwind dark theme"
```

---

## Task 2: Shared Product Card Component

**Files:**
- Create: `packages/demo/app/components/product-card.tsx`

- [ ] **Step 1: Create the product card component**

This component is shared between Chat and Explore tabs.

```tsx
// packages/demo/app/components/product-card.tsx
"use client";

interface Product {
  id: string;
  sourceUrl: string;
  source: string;
  name: string;
  description: string;
  price: { amount: string; currency: string } | null;
  images: string[];
  categories: string[];
  attributes: Record<string, string>;
  availability: "in_stock" | "out_of_stock" | "unknown";
  seller: { name: string | null; url: string | null; rating: string | null };
  lastCrawled: string;
}

function ProductCard({ product }: { product: Product }) {
  const imageUrl = product.images[0];

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-[#27272a] relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary text-sm">
            No image
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${
            product.availability === "in_stock"
              ? "bg-green-900/50 text-green-400"
              : "bg-red-900/50 text-red-400"
          }`}
        >
          {product.availability === "in_stock" ? "In Stock" : "Out of Stock"}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="text-sm font-medium text-[#e5e5e5] line-clamp-2 leading-snug">
          {product.name}
        </h3>
        {product.seller.name && (
          <p className="text-xs text-secondary">{product.seller.name}</p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          {product.price ? (
            <span className="text-price font-semibold">
              ${product.price.amount}
            </span>
          ) : (
            <span className="text-secondary text-sm">Price N/A</span>
          )}
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:text-[#c4b5fd] transition-colors"
          >
            View on store →
          </a>
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-[#27272a]" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-4 bg-[#27272a] rounded w-3/4" />
        <div className="h-3 bg-[#27272a] rounded w-1/2" />
        <div className="h-4 bg-[#27272a] rounded w-1/4 mt-2" />
      </div>
    </div>
  );
}

function ProductCardRow({ products }: { products: Product[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {products.map((product) => (
        <div key={product.id} className="w-48 flex-shrink-0">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}

export { ProductCard, ProductCardSkeleton, ProductCardRow };
export type { Product };
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthewgoralczyk/Desktop/AI\ infrastructure/agora
git add packages/demo/app/components/product-card.tsx
git commit -m "feat(demo): add shared product card component with skeleton and row variants"
```

---

## Task 3: Tab Switcher & Page Layout

**Files:**
- Create: `packages/demo/app/components/tabs.tsx`
- Create: `packages/demo/app/page.tsx`

- [ ] **Step 1: Create the tab switcher**

```tsx
// packages/demo/app/components/tabs.tsx
"use client";

import { useState } from "react";

type Tab = "chat" | "explore";

function Tabs({
  children,
}: {
  children: (activeTab: Tab) => React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4">
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "chat"
              ? "text-accent"
              : "text-secondary hover:text-[#e5e5e5]"
          }`}
        >
          Chat
          {activeTab === "chat" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("explore")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "explore"
              ? "text-accent"
              : "text-secondary hover:text-[#e5e5e5]"
          }`}
        >
          Explore
          {activeTab === "explore" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">{children(activeTab)}</div>
    </div>
  );
}

export { Tabs };
export type { Tab };
```

- [ ] **Step 2: Create the main page**

```tsx
// packages/demo/app/page.tsx
import { Tabs } from "./components/tabs";
import { Chat } from "./components/chat";
import { Explore } from "./components/explore";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold bg-gradient-to-r from-white via-accent to-indigo-500 bg-clip-text text-transparent">
            Agora
          </h1>
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent-border">
            Demo
          </span>
        </div>
        <a
          href="https://github.com/rbtbuilds/agora"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-secondary hover:text-[#e5e5e5] transition-colors"
        >
          GitHub →
        </a>
      </header>

      {/* Tabs + Content */}
      <Tabs>
        {(activeTab) => (
          <>
            <div className={activeTab === "chat" ? "h-full" : "hidden"}>
              <Chat />
            </div>
            <div className={activeTab === "explore" ? "h-full" : "hidden"}>
              <Explore />
            </div>
          </>
        )}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Create placeholder chat and explore components** (so the page renders)

```tsx
// packages/demo/app/components/chat.tsx
"use client";

function Chat() {
  return (
    <div className="flex items-center justify-center h-full text-secondary">
      Chat coming soon...
    </div>
  );
}

export { Chat };
```

```tsx
// packages/demo/app/components/explore.tsx
"use client";

function Explore() {
  return (
    <div className="flex items-center justify-center h-full text-secondary">
      Explore coming soon...
    </div>
  );
}

export { Explore };
```

- [ ] **Step 4: Verify it renders**

```bash
cd packages/demo
npx next dev --port 3001
```

Open http://localhost:3001 — should see the header with "Agora" + "Demo" badge, tab switcher, and placeholder content. Stop the dev server after verifying.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add packages/demo/app/
git commit -m "feat(demo): add tab switcher, page layout, and header"
```

---

## Task 4: Explore Tab — Search & Product Grid

**Files:**
- Create: `packages/demo/app/actions/search.ts`
- Modify: `packages/demo/app/components/explore.tsx`

- [ ] **Step 1: Create the server action for searching**

```typescript
// packages/demo/app/actions/search.ts
"use server";

import type { Product } from "../components/product-card";

const AGORA_API_URL =
  process.env.AGORA_API_URL ?? "https://agora-ecru-chi.vercel.app";
const AGORA_API_KEY = process.env.AGORA_API_KEY ?? "ak_test_123";

interface SearchParams {
  query: string;
  maxPrice?: string;
  minPrice?: string;
  availability?: string;
}

interface SearchResponse {
  data: Product[];
  meta: { total: number; page: number; perPage: number };
}

export async function searchProducts(
  params: SearchParams
): Promise<SearchResponse> {
  const url = new URL(`${AGORA_API_URL}/v1/products/search`);
  url.searchParams.set("q", params.query);
  if (params.maxPrice) url.searchParams.set("maxPrice", params.maxPrice);
  if (params.minPrice) url.searchParams.set("minPrice", params.minPrice);
  if (params.availability)
    url.searchParams.set("availability", params.availability);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AGORA_API_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Agora API error: ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 2: Implement the Explore tab**

```tsx
// packages/demo/app/components/explore.tsx
"use client";

import { useState, useTransition } from "react";
import { searchProducts } from "../actions/search";
import { ProductCard, ProductCardSkeleton } from "./product-card";
import type { Product } from "./product-card";

const PRICE_FILTERS = [
  { label: "Under $25", max: "25" },
  { label: "$25–50", min: "25", max: "50" },
  { label: "$50–100", min: "50", max: "100" },
  { label: "$100+", min: "100" },
];

function Explore() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function doSearch(
    searchQuery: string,
    filterIndex: number | null = activeFilter
  ) {
    if (!searchQuery.trim()) return;
    setError(null);
    setHasSearched(true);

    const filter = filterIndex !== null ? PRICE_FILTERS[filterIndex] : null;

    startTransition(async () => {
      try {
        const result = await searchProducts({
          query: searchQuery,
          minPrice: filter?.min,
          maxPrice: filter?.max,
        });
        setProducts(result.data);
        setTotal(result.meta.total);
      } catch {
        setError("Something went wrong. Please try again.");
        setProducts([]);
        setTotal(0);
      }
    });
  }

  function handleFilterClick(index: number) {
    const newFilter = activeFilter === index ? null : index;
    setActiveFilter(newFilter);
    if (query.trim()) {
      doSearch(query, newFilter);
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doSearch(query);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-[#e5e5e5] placeholder:text-secondary outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
      </form>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {PRICE_FILTERS.map((filter, i) => (
          <button
            key={filter.label}
            onClick={() => handleFilterClick(i)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilter === i
                ? "bg-accent/20 border-accent text-accent"
                : "bg-surface border-border text-secondary hover:text-[#e5e5e5] hover:border-[#3f3f46]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isPending && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isPending && error && (
        <div className="flex items-center justify-center flex-1 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!isPending && !error && hasSearched && products.length === 0 && (
        <div className="flex items-center justify-center flex-1 text-secondary text-sm">
          No products found. Try a different search.
        </div>
      )}

      {!isPending && !error && products.length > 0 && (
        <>
          <p className="text-xs text-secondary">
            {total} product{total !== 1 ? "s" : ""} found
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {!hasSearched && (
        <div className="flex items-center justify-center flex-1 text-secondary text-sm">
          Search for products to get started
        </div>
      )}
    </div>
  );
}

export { Explore };
```

- [ ] **Step 3: Create .env.local with Agora API config**

```bash
# packages/demo/.env.local
AGORA_API_URL=https://agora-ecru-chi.vercel.app
AGORA_API_KEY=ak_test_123
```

- [ ] **Step 4: Verify Explore tab works**

```bash
cd packages/demo
npx next dev --port 3001
```

Open http://localhost:3001, switch to "Explore" tab, search for "shoes". Should see product cards with images, prices, and availability badges. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add packages/demo/
git commit -m "feat(demo): add Explore tab with search, filters, and product grid"
```

---

## Task 5: Chat API Route Handler

**Files:**
- Create: `packages/demo/app/api/chat/route.ts`

- [ ] **Step 1: Create the chat route handler with tool calling and fallback**

```typescript
// packages/demo/app/api/chat/route.ts
import {
  streamText,
  tool,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const AGORA_API_URL =
  process.env.AGORA_API_URL ?? "https://agora-ecru-chi.vercel.app";
const AGORA_API_KEY = process.env.AGORA_API_KEY ?? "ak_test_123";

const SYSTEM_PROMPT = `You are Agora, an AI shopping assistant. You help users find products across e-commerce stores. Use the searchProducts tool to find products, then present results as helpful recommendations. Be concise and helpful. When showing products, mention the name, price, and availability. Keep responses short — 2-3 sentences plus the product results.`;

const searchProductsTool = tool({
  description:
    "Search for products across e-commerce stores. Use this whenever the user asks about products, shopping, or wants to find items.",
  parameters: z.object({
    query: z.string().describe("Search query for products"),
    maxPrice: z
      .number()
      .optional()
      .describe("Maximum price filter in dollars"),
    minPrice: z
      .number()
      .optional()
      .describe("Minimum price filter in dollars"),
  }),
  execute: async ({ query, maxPrice, minPrice }) => {
    const url = new URL(`${AGORA_API_URL}/v1/products/search`);
    url.searchParams.set("q", query);
    if (maxPrice) url.searchParams.set("maxPrice", String(maxPrice));
    if (minPrice) url.searchParams.set("minPrice", String(minPrice));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AGORA_API_KEY}` },
    });

    if (!res.ok) {
      return { error: `Search failed: ${res.status}` };
    }

    const data = await res.json();
    return {
      products: data.data.slice(0, 6),
      total: data.meta.total,
    };
  },
});

async function createStream(messages: UIMessage[]) {
  const modelMessages = convertToModelMessages(messages);

  try {
    // Try Groq first (faster, free tier)
    return streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { searchProducts: searchProductsTool },
      stopWhen: stepCountIs(3),
    });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 429) {
      // Fallback to Gemini on rate limit
      return streamText({
        model: google("gemini-2.0-flash"),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools: { searchProducts: searchProductsTool },
        stopWhen: stepCountIs(3),
      });
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = await createStream(messages);
  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthewgoralczyk/Desktop/AI\ infrastructure/agora
git add packages/demo/app/api/
git commit -m "feat(demo): add chat API route with Groq/Gemini fallback and searchProducts tool"
```

---

## Task 6: Chat UI Component

**Files:**
- Modify: `packages/demo/app/components/chat.tsx`

- [ ] **Step 1: Implement the full chat interface**

```tsx
// packages/demo/app/components/chat.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { ProductCardRow } from "./product-card";
import type { Product } from "./product-card";

const SUGGESTIONS = [
  "Find me running shoes under $80",
  "What wool shoes do you have?",
  "Show me kids' shoes",
  "Compare the cheapest loungers",
];

function Chat() {
  const { messages, input, setInput, sendMessage, isLoading, error } =
    useChat({
      api: "/api/chat",
    });

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                Ask Agora anything about products
              </h2>
              <p className="text-secondary text-sm">
                I can search across e-commerce stores to find what you need.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-secondary hover:text-[#e5e5e5] hover:border-[#3f3f46] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-start" : "justify-end"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-surface text-[#e5e5e5]"
                  : "bg-accent-dim border border-accent-border text-[#e5e5e5]"
              }`}
            >
              {message.role !== "user" && (
                <p className="text-accent text-xs font-medium mb-1">
                  Agora Agent
                </p>
              )}
              {message.parts.map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "tool-searchProducts") {
                  if (part.state === "result") {
                    const result = part.result as {
                      products?: Product[];
                      total?: number;
                      error?: string;
                    };
                    if (result.error) {
                      return (
                        <p key={i} className="text-red-400 text-sm">
                          {result.error}
                        </p>
                      );
                    }
                    if (result.products && result.products.length > 0) {
                      return (
                        <div key={i} className="mt-3">
                          <ProductCardRow products={result.products} />
                        </div>
                      );
                    }
                  }
                  if (part.state === "call") {
                    return (
                      <p key={i} className="text-secondary text-xs italic">
                        Searching products...
                      </p>
                    );
                  }
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-end">
            <div className="bg-accent-dim border border-accent-border rounded-xl px-4 py-3">
              <p className="text-accent text-xs font-medium mb-1">
                Agora Agent
              </p>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <p className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
              Something went wrong. Please try again.
            </p>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="p-4 border-t border-border flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any product..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-[#e5e5e5] placeholder:text-secondary outline-none focus:border-accent transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 disabled:cursor-not-allowed text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-lg"
        >
          →
        </button>
      </form>
    </div>
  );
}

export { Chat };
```

- [ ] **Step 2: Add LLM API keys to .env.local**

Append to `packages/demo/.env.local`:

```
GROQ_API_KEY=gsk_your_groq_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
```

The user will need to get these free API keys from:
- Groq: https://console.groq.com/keys
- Google AI Studio: https://aistudio.google.com/apikey

- [ ] **Step 3: Verify the chat works**

```bash
cd packages/demo
npx next dev --port 3001
```

Open http://localhost:3001, click a suggested prompt like "What wool shoes do you have?". The agent should call the searchProducts tool and render product cards inline. Stop dev server.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add packages/demo/app/components/chat.tsx packages/demo/.env.local
git commit -m "feat(demo): add chat UI with streaming, tool results, and product cards"
```

---

## Task 7: Build, Deploy, and Polish

**Files:**
- Modify: `packages/demo/app/page.tsx` (minor polish if needed)

- [ ] **Step 1: Verify full build works**

```bash
cd /Users/matthewgoralczyk/Desktop/AI\ infrastructure/agora/packages/demo
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Test both tabs end to end**

```bash
npx next dev --port 3001
```

Verify:
1. Chat tab: suggested prompts show, clicking one sends message, agent streams response, product cards render inline
2. Explore tab: search returns products, filter chips work, product cards show images/prices/availability
3. Tab switching preserves state (search results don't disappear)
4. Mobile responsive (resize browser)

- [ ] **Step 3: Commit any final fixes**

```bash
cd ../..
git add packages/demo/
git commit -m "feat(demo): final polish and build verification"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Deploy to Vercel**

The demo needs its own Vercel project since it's a Next.js app (different from the Hono API).

```bash
cd packages/demo
vercel deploy --prod --yes
```

If prompted for project setup, use these settings:
- Framework: Next.js
- Root directory: packages/demo

Add environment variables to the Vercel project:
```bash
vercel env add AGORA_API_URL production
# Enter: https://agora-ecru-chi.vercel.app
vercel env add AGORA_API_KEY production
# Enter: ak_test_123
vercel env add GROQ_API_KEY production
# Enter: your groq key
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
# Enter: your gemini key
```

Redeploy after adding env vars:
```bash
vercel deploy --prod --yes
```

- [ ] **Step 6: Update README with demo link**

Add to the top of the Agora README (`/Users/matthewgoralczyk/Desktop/AI infrastructure/agora/README.md`), below the badges:

```markdown
[**Try the Demo →**](https://your-demo-url.vercel.app)
```

- [ ] **Step 7: Final commit and push**

```bash
cd ../..
git add README.md
git commit -m "docs: add demo link to README"
git push origin main
```
