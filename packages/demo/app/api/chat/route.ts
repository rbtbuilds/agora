import {
  streamText,
  tool,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import { consumeDailyChatLimit } from "./rate-limit";

const AGORA_API_URL =
  process.env.AGORA_API_URL ?? "https://agora-ecru-chi.vercel.app";
const AGORA_API_KEY = process.env.AGORA_API_KEY ?? "ak_test_123";

const SYSTEM_PROMPT = `You are Agora, a shopping assistant. When a user asks for products, call searchProducts with a short, specific search query (one to three product words) and any requested price limits. Recommend only products returned by the tool. If there are no matches, say so. Keep the answer to two or three short sentences; product cards appear below it.`;

interface CatalogProduct {
  id: string;
  name: string;
  sourceUrl: string;
  images: string[];
  price: { amount: string; currency: string } | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  seller: { name: string | null };
  categories: string[];
}

function relevantProducts(products: CatalogProduct[], query: string): CatalogProduct[] {
  if (!/\b(shoes?|sneakers?|trainers?|runners?|loungers?|boots?|sandals?|slippers?)\b/i.test(query)) {
    return products;
  }

  return products.filter(
    (product) =>
      product.categories.some((category) => /^(shoes|footwear|sneakers|boots|sandals)$/i.test(category)) ||
      /\b(sneakers?|trainers?|runners?|loungers?|boots?|sandals?|slippers?)\b/i.test(product.name)
  );
}

const searchProductsTool = tool({
  description:
    "Search for products across e-commerce stores. Use this whenever the user asks about products, shopping, or wants to find items.",
  inputSchema: z.object({
    query: z.string().min(1).max(80).describe("One to three product words to search for"),
    maxPrice: z
      .number()
      .nonnegative()
      .optional()
      .describe("Maximum price filter in dollars"),
    minPrice: z
      .number()
      .nonnegative()
      .optional()
      .describe("Minimum price filter in dollars"),
  }),
  execute: async ({ query, maxPrice, minPrice }) => {
    async function search(searchQuery: string): Promise<CatalogProduct[]> {
      const url = new URL(`${AGORA_API_URL}/v1/products/search`);
      url.searchParams.set("q", searchQuery);
      if (maxPrice !== undefined) url.searchParams.set("maxPrice", String(maxPrice));
      if (minPrice !== undefined) url.searchParams.set("minPrice", String(minPrice));

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AGORA_API_KEY}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Agora search returned ${response.status}`);
      const data = await response.json();
      return data.data as CatalogProduct[];
    }

    let matches: CatalogProduct[];
    try {
      const filterMatches = (products: CatalogProduct[]) =>
        relevantProducts(products, query).filter((product) => {
          if (minPrice === undefined && maxPrice === undefined) return true;
          if (!product.price || product.price.currency !== "USD") return false;
          const amount = Number(product.price.amount);
          return Number.isFinite(amount) &&
            (minPrice === undefined || amount >= minPrice) &&
            (maxPrice === undefined || amount <= maxPrice);
        });

      matches = filterMatches(await search(query));
      const lastWord = query.trim().split(/\s+/).at(-1);
      if (matches.length === 0 && lastWord && lastWord !== query.trim()) {
        matches = filterMatches(await search(lastWord));
      }
    } catch (error) {
      console.error("Product search failed:", error);
      return { error: "Product search is temporarily unavailable." };
    }

    const products = matches.slice(0, 6).map((product) => ({
      id: product.id,
      name: product.name,
      sourceUrl: product.sourceUrl,
      images: product.images.slice(0, 1),
      price: product.price,
      availability: product.availability,
      seller: { name: product.seller.name },
    }));
    return {
      products,
      total: products.length,
    };
  },
});

export async function POST(req: Request) {
  let modelMessages;
  try {
    const body = await req.json();
    const messages = body.messages as UIMessage[];
    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 12 ||
      messages[messages.length - 1]?.role !== "user" ||
      messages.some(
        (message) =>
          !Array.isArray(message.parts) ||
          message.parts.some((part) => part.type === "text" && part.text.length > 500)
      )
    ) {
      return new Response("Invalid chat message.", { status: 400 });
    }
    modelMessages = await convertToModelMessages(messages);
  } catch {
    return new Response("Invalid chat message.", { status: 400 });
  }

  let limit;
  try {
    limit = await consumeDailyChatLimit(req);
  } catch (error) {
    console.error("Chat rate limit failed:", error);
    return new Response("The assistant is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!limit.allowed) {
    return new Response("Daily limit reached. Try again after midnight UTC.", {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))),
      },
    });
  }

  const result = streamText({
    model: "nvidia/nemotron-3.5-lightning-free",
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: { searchProducts: searchProductsTool },
    stopWhen: stepCountIs(2),
    maxOutputTokens: 800,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("Chat model failed:", error);
      return "The assistant is temporarily unavailable.";
    },
  });
}
