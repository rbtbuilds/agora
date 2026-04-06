import { AgoraClient } from "./client.js";
import type {
  AgoraConfig,
  SearchOptions,
  SearchResult,
  ProductResult,
  SimilarResult,
  Category,
} from "./types.js";

export type {
  AgoraConfig,
  Product,
  SearchOptions,
  SearchResult,
  ProductResult,
  SimilarResult,
  Category,
} from "./types.js";

export class Agora {
  private client: AgoraClient;

  constructor(config: AgoraConfig) {
    this.client = new AgoraClient(config);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return this.client.get<SearchResult>("/v1/products/search", {
      q: query,
      source: options?.source,
      minPrice: options?.minPrice?.toString(),
      maxPrice: options?.maxPrice?.toString(),
      availability: options?.availability,
      category: options?.category,
      page: options?.page?.toString(),
      perPage: options?.perPage?.toString(),
    });
  }

  async product(id: string): Promise<ProductResult> {
    return this.client.get<ProductResult>(`/v1/products/${id}`);
  }

  async similar(id: string): Promise<SimilarResult> {
    return this.client.get<SimilarResult>(`/v1/products/${id}/similar`);
  }

  async categories(parentId?: number): Promise<{ data: Category[]; meta: { total: number } }> {
    return this.client.get("/v1/categories", {
      parentId: parentId?.toString(),
    });
  }

  clearCache(): void {
    this.client.clearCache();
  }
}
