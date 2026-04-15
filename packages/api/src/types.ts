export type AppEnv = {
  Variables: {
    apiKey: string;
    userId: string;
  };
};

export interface ApiResponse<T> {
  data: T;
  meta: {
    freshness: string;
    source: string;
    confidence: number;
  };
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ProductResponse {
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

export interface SearchQuery {
  q: string;
  source?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
  category?: string;
  page?: string;
  perPage?: string;
}
