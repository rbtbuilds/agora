import { Agora, type Product } from "agora-sdk";

let client: Agora | null = null;

function getClient(): Agora {
  if (!client) {
    const apiKey = process.env.AGORA_API_KEY;
    if (!apiKey) {
      throw new Error("AGORA_API_KEY environment variable is required");
    }
    client = new Agora({
      apiKey,
      baseUrl: process.env.AGORA_API_URL ?? "https://api.agora.dev",
    });
  }
  return client;
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const agora = getClient();

  switch (name) {
    case "agora_search": {
      const result = await agora.search(args.query as string, {
        source: args.source as string | undefined,
        minPrice: args.minPrice as number | undefined,
        maxPrice: args.maxPrice as number | undefined,
        availability: args.availability as "in_stock" | "out_of_stock" | undefined,
      });

      if (result.data.length === 0) {
        return "No products found matching your search.";
      }

      const lines = result.data.map(
        (p: Product) =>
          `- **${p.name}** (${p.id})\n  Price: ${p.price ? `${p.price.currency} ${p.price.amount}` : "N/A"} | Source: ${p.source} | ${p.availability}`
      );

      return `Found ${result.meta.total} products:\n\n${lines.join("\n\n")}`;
    }

    case "agora_product": {
      const result = await agora.product(args.id as string);
      const p = result.data;

      return [
        `# ${p.name}`,
        ``,
        `**ID:** ${p.id}`,
        `**Source:** ${p.source} ([link](${p.sourceUrl}))`,
        `**Price:** ${p.price ? `${p.price.currency} ${p.price.amount}` : "N/A"}`,
        `**Availability:** ${p.availability}`,
        `**Categories:** ${p.categories.join(", ") || "None"}`,
        `**Description:** ${p.description.slice(0, 500)}`,
        ``,
        `*Data freshness: ${result.meta.freshness} (confidence: ${result.meta.confidence})*`,
      ].join("\n");
    }

    case "agora_similar": {
      const result = await agora.similar(args.id as string);

      if (result.data.length === 0) {
        return "No similar products found.";
      }

      const lines = result.data.map(
        (p: Product) =>
          `- **${p.name}** (${p.id})\n  Price: ${p.price ? `${p.price.currency} ${p.price.amount}` : "N/A"} | Source: ${p.source}`
      );

      return `Similar products:\n\n${lines.join("\n\n")}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
