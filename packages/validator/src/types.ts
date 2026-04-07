export interface ValidationCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  manifest: AgoraManifest | null;
}

export interface ProductValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
}

export interface StoreValidationResult {
  url: string;
  valid: boolean;
  score: number;
  checks: ValidationCheck[];
  manifest: AgoraManifest | null;
  productsSampled: number;
  productErrors: number;
}

export interface AgoraManifest {
  $schema?: string;
  version: string;
  store: {
    name: string;
    url: string;
    description?: string;
    logo?: string;
    categories?: string[];
    currency?: string;
    locale?: string;
  };
  capabilities: {
    products: string;
    product: string;
    search?: string;
    inventory?: string;
    cart?: string;
    checkout?: string;
  };
  auth?: {
    type: "none" | "api_key" | "bearer" | "oauth2";
    registration?: string;
  };
  rate_limits?: {
    requests_per_minute?: number;
    burst?: number;
  };
  data_policy?: {
    cache_ttl?: number;
    attribution_required?: boolean;
    commercial_use?: boolean;
  };
}

export interface AgoraProduct {
  id: string;
  url: string;
  name: string;
  description?: string;
  brand?: string;
  pricing: {
    amount: string;
    currency: string;
    compare_at?: string;
    unit_pricing?: { amount: string; unit: string };
  };
  availability: {
    status: "in_stock" | "out_of_stock" | "preorder" | "backorder";
    quantity?: number;
    lead_time_days?: number | null;
    regions?: string[];
  };
  images?: Array<{
    url: string;
    alt?: string;
    role?: "primary" | "gallery" | "swatch" | "lifestyle";
  }>;
  categories?: Array<{
    name: string;
    slug: string;
    parent?: string;
  }>;
  attributes?: Record<string, string | string[]>;
  variants?: Array<{
    id: string;
    attributes: Record<string, string>;
    pricing?: AgoraProduct["pricing"];
    availability?: AgoraProduct["availability"];
  }>;
  identifiers?: {
    gtin?: string | null;
    upc?: string | null;
    isbn?: string | null;
    asin?: string | null;
    mpn?: string | null;
  };
  reviews?: {
    average_rating?: number;
    count?: number;
    url?: string;
  };
  shipping?: {
    free_shipping?: boolean;
    free_shipping_minimum?: string;
    estimated_days?: { min: number; max: number };
  };
  metadata?: {
    created_at?: string;
    updated_at?: string;
    tags?: string[];
  };
}
