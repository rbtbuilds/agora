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

// ---------------------------------------------------------------------------
// Commerce types
// ---------------------------------------------------------------------------

export interface Cart {
  id: string;
  consumerId: string;
  ownerId: string;
  status: "open" | "checked_out" | "abandoned";
  createdAt: string;
}

export interface CartItem {
  id: number;
  productId: string;
  storeId: string | null;
  name: string | null;
  price: string;
  quantity: number;
  createdAt: string;
}

export interface CartDetail extends Cart {
  items: CartItem[];
  subtotal: string;
}

export interface CartResult {
  data: Cart;
}

export interface CartDetailResult {
  data: CartDetail;
}

export interface CartItemResult {
  data: CartItem;
}

export interface CheckoutOptions {
  cartId: string;
  consumerId: string;
  paymentMethodId?: string;
  approvalMode?: "inline" | "async";
}

export interface CheckoutPending {
  id: string;
  approvalToken?: string;
  total: string;
  prompt: string;
  expiresAt: string;
  status: "pending";
}

export interface CheckoutPendingResult {
  data: CheckoutPending;
}

export interface CheckoutStatus {
  id: string;
  cartId: string;
  consumerId: string;
  ownerId: string;
  status: "pending" | "completed" | "denied" | "expired";
  approvalMode: "inline" | "async";
  totalAmount: string;
  paymentMethodId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface CheckoutStatusResult {
  data: CheckoutStatus;
}

export interface OrderSnapshot {
  productId: string;
  name: string;
  quantity: number;
  price: string;
}

export interface Order {
  id: string;
  checkoutId: string;
  consumerId: string;
  ownerId: string;
  storeId: string | null;
  status: "confirmed" | "fulfilled" | "cancelled";
  totalAmount: string;
  items: OrderSnapshot[];
  createdAt: string;
}

export interface CheckoutCompleted {
  checkoutId: string;
  status: "completed";
  orders: Array<{
    id: string;
    storeId: string | null;
    status: "confirmed";
    totalAmount: string;
    items: OrderSnapshot[];
  }>;
}

export interface CheckoutCompletedResult {
  data: CheckoutCompleted;
}

export interface OrdersListResult {
  data: Order[];
  meta: { total: number };
}

export interface OrderResult {
  data: Order;
}
