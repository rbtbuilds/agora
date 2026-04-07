# Agora Demo Agent — Design Spec

**Date:** 2026-04-07
**Status:** Approved

## Overview

A Next.js demo app with two tabs — a conversational AI shopping agent (Chat) and a direct product search UI (Explore). Lives at `packages/demo/` in the monorepo. Deployed on Vercel. Purpose: give visitors an instant "holy shit" moment by letting them interact with the Agora API through a polished interface.

## Architecture

```
Browser → Next.js App
  ├── Chat tab → AI SDK → Groq/Gemini → tool call → Agora API → DB
  └── Explore tab → server action → Agora API → DB
```

The demo is a thin frontend. All product data comes from the Agora API (`https://agora-ecru-chi.vercel.app`). The LLM is only used in the Chat tab to understand natural language and decide when to search.

## LLM Strategy

**Primary:** Groq (Llama 3.3 70B) — free tier: 30 RPM, 14,400 requests/day. Extremely fast inference.

**Fallback:** Google Gemini 2.0 Flash — free tier: 15 RPM, 1M tokens/day.

**Fallback logic:** Route handler tries Groq first. On 429 (rate limit), retries with Gemini. User never sees the switch. Both providers support tool calling via the Vercel AI SDK.

## Chat Tab

**System prompt:**
> "You are Agora, an AI shopping assistant. You help users find products across e-commerce stores. Use the searchProducts tool to find products, then present results as helpful recommendations. Be concise and helpful. When showing products, mention the name, price, and availability."

**Tool: `searchProducts`**
- Parameters: `query` (string, required), `maxPrice` (number, optional), `minPrice` (number, optional)
- Implementation: calls `GET /v1/products/search` on the Agora API with the given parameters
- Returns: array of product objects to the LLM

**UI:**
- User messages: left-aligned, dark grey background (#18181b)
- Agent messages: right-aligned, purple-tinted background (#1e1b2e, border #2d2640)
- Product cards: rendered inline when the agent's tool call returns products — image, name, price, availability, link to source. Horizontally scrollable row.
- Input bar: fixed at bottom, dark input field with purple send button
- Streaming: responses stream token-by-token via the AI SDK

**Suggested prompts:** Show 3-4 example queries above the input when chat is empty:
- "Find me running shoes under $80"
- "What wool shoes do you have?"
- "Show me kids' shoes"
- "Compare the cheapest loungers"

## Explore Tab

**Search bar:** Full-width at top with placeholder "Search products..."

**Filter chips:** Below search bar. Price ranges: under $25, $25-50, $50-100, $100+. Availability toggle.

**Product grid:** 3 columns desktop, 2 tablet, 1 mobile.

**Product card (shared with Chat):**
- Product image (first from images array, with fallback placeholder)
- Product name
- Price in green
- Seller name
- Availability badge (green "In Stock" / red "Out of Stock")
- "View on store →" link to sourceUrl

**States:**
- Loading: skeleton card grid
- Empty: "No products found. Try a different search."
- Error: "Something went wrong. Please try again."

**Implementation:** Server action that calls the Agora API directly. No LLM involved.

## Visual Design

**Theme:** Dark & minimal, consistent with the API landing page.
- Background: #0a0a0a
- Surface: #18181b
- Border: #27272a
- Text: #e5e5e5
- Secondary text: #a1a1aa
- Accent: #a78bfa (purple)
- Price: #22c55e (green)
- Font: system font stack (-apple-system, BlinkMacSystemFont, etc.)

**Layout:**
- Header: "Agora" logo (text), "Demo" badge, GitHub link
- Tabs: "Chat" and "Explore" below header
- Content: fills remaining viewport height
- Responsive: works on mobile

## Tech Stack

- Next.js 15 (App Router)
- Vercel AI SDK v4 with `@ai-sdk/groq` + `@ai-sdk/google`
- Tailwind CSS
- No component library — hand-rolled components

## Project Structure

```
packages/demo/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── app/
│   ├── layout.tsx            # Root layout, fonts, dark theme
│   ├── page.tsx              # Main page with Chat/Explore tabs
│   ├── components/
│   │   ├── chat.tsx          # Chat interface
│   │   ├── explore.tsx       # Search + filter + product grid
│   │   ├── product-card.tsx  # Shared product card component
│   │   └── tabs.tsx          # Tab switcher
│   └── api/
│       └── chat/
│           └── route.ts      # AI SDK route handler
└── public/
    └── favicon.ico
```

## Environment Variables

```
GROQ_API_KEY=gsk_...          # Groq free tier key
GOOGLE_GENERATIVE_AI_API_KEY=...  # Gemini free tier key
AGORA_API_KEY=ak_test_123     # Agora API key (hardcoded for demo)
AGORA_API_URL=https://agora-ecru-chi.vercel.app
```

## Deployment

Deployed as part of the monorepo on Vercel. Separate Vercel project pointing to `packages/demo/` as root directory, or deployed alongside the API.

## Out of Scope

- User authentication / API key signup (Tier 1 item #3, separate spec)
- More data sources (Tier 1 item #2, separate effort)
- Price tracking / alerts (Tier 2)
- The Agora Protocol (Tier 2)
