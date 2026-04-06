export interface AgoraConfig {
  apiKey: string;
  baseUrl?: string;
  cacheTtl?: number;
}

export interface Product {
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

export interface SearchOptions {
  source?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in_stock" | "out_of_stock";
  category?: string;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  data: Product[];
  meta: { total: number; page: number; perPage: number };
}

export interface ProductResult {
  data: Product;
  meta: { freshness: string; source: string; confidence: number };
}

export interface SimilarResult {
  data: Product[];
  meta: { total: number; page: number; perPage: number };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  source: string | null;
}

export interface AgoraError {
  error: { code: string; message: string };
}
