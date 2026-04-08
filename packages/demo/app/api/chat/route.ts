import {
  streamText,
  tool,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const AGORA_API_URL =
  process.env.AGORA_API_URL ?? "https://agora-ecru-chi.vercel.app";
const AGORA_API_KEY = process.env.AGORA_API_KEY ?? "ak_test_123";

const SYSTEM_PROMPT = `You are Agora, an AI shopping assistant. You help users find products across e-commerce stores. Use the searchProducts tool to find products, then present results as helpful recommendations. Be concise and helpful. When showing products, mention the name, price, and availability. Keep responses short — 2-3 sentences plus the product results.`;

const searchProductsTool = tool({
  description:
    "Search for products across e-commerce stores. Use this whenever the user asks about products, shopping, or wants to find items.",
  inputSchema: z.object({
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

function getModels() {
  const models = [];

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    models.push(google("gemini-2.0-flash"));
  }

  return models;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const modelMessages = await convertToModelMessages(messages);
  const models = getModels();

  if (models.length === 0) {
    const noProviderPayload = JSON.stringify({ type: "error", errorText: "No AI provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY." });
    return new Response(
      `data: ${noProviderPayload}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  let lastError: unknown;

  for (const model of models) {
    try {
      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools: { searchProducts: searchProductsTool },
        stopWhen: stepCountIs(3),
      });
      return result.toUIMessageStreamResponse();
    } catch (error) {
      lastError = error;
      console.error(`Model failed, trying next:`, error);
      continue;
    }
  }

  // All models failed
  const errorMsg = lastError instanceof Error ? lastError.message : "All AI providers failed";
  const safePayload = JSON.stringify({ type: "error", errorText: errorMsg });
  return new Response(
    `data: ${safePayload}\n\ndata: [DONE]\n\n`,
    { headers: { "Content-Type": "text/event-stream" } }
  );
}
