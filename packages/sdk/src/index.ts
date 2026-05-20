import { AgoraClient } from "./client.js";
import type {
  AgoraConfig,
  SearchOptions,
  SearchResult,
  ProductResult,
  SimilarResult,
  Category,
  CartResult,
  CartDetailResult,
  CartItemResult,
  CheckoutOptions,
  CheckoutPendingResult,
  CheckoutStatusResult,
  CheckoutCompletedResult,
  OrdersListResult,
  OrderResult,
} from "./types.js";

export type {
  AgoraConfig,
  Product,
  SearchOptions,
  SearchResult,
  ProductResult,
  SimilarResult,
  Category,
  Cart,
  CartItem,
  CartDetail,
  CartResult,
  CartDetailResult,
  CartItemResult,
  CheckoutOptions,
  CheckoutPending,
  CheckoutPendingResult,
  CheckoutStatus,
  CheckoutStatusResult,
  CheckoutCompleted,
  CheckoutCompletedResult,
  Order,
  OrderSnapshot,
  OrdersListResult,
  OrderResult,
} from "./types.js";

export class Agora {
  private client: AgoraClient;
  private baseUrl: string;

  constructor(config: AgoraConfig) {
    this.client = new AgoraClient(config);
    this.baseUrl = (config.baseUrl ?? "https://agora-ecru-chi.vercel.app").replace(/\/$/, "");
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Cart
  // -------------------------------------------------------------------------

  async createCart(consumerId: string): Promise<CartResult> {
    return this.client.post<CartResult>("/v1/cart", { consumerId });
  }

  async getCart(cartId: string): Promise<CartDetailResult> {
    return this.client.get<CartDetailResult>(`/v1/cart/${cartId}`, undefined, { skipCache: true });
  }

  async addToCart(cartId: string, productId: string, quantity: number = 1): Promise<CartItemResult> {
    return this.client.post<CartItemResult>(`/v1/cart/${cartId}/items`, { productId, quantity });
  }

  async removeFromCart(cartId: string, itemId: number): Promise<{ data: { deleted: boolean } }> {
    return this.client.delete<{ data: { deleted: boolean } }>(`/v1/cart/${cartId}/items/${itemId}`);
  }

  // -------------------------------------------------------------------------
  // Checkout
  // -------------------------------------------------------------------------

  async createCheckout(opts: CheckoutOptions): Promise<CheckoutPendingResult> {
    return this.client.post<CheckoutPendingResult>("/v1/checkout", opts);
  }

  async approveCheckout(checkoutId: string, approvalToken: string): Promise<CheckoutCompletedResult> {
    return this.client.post<CheckoutCompletedResult>(`/v1/checkout/${checkoutId}/approve`, { approvalToken });
  }

  async denyCheckout(checkoutId: string, approvalToken: string): Promise<{ data: { status: "denied" } }> {
    return this.client.post<{ data: { status: "denied" } }>(`/v1/checkout/${checkoutId}/deny`, { approvalToken });
  }

  async getCheckout(checkoutId: string): Promise<CheckoutStatusResult> {
    return this.client.get<CheckoutStatusResult>(`/v1/checkout/${checkoutId}`, undefined, { skipCache: true });
  }

  /**
   * Build the human-facing approval URL for a checkout.
   * Visit this URL in a browser to approve the purchase out-of-band.
   *
   * @param approvalToken — the token returned by `createCheckout` (inline mode)
   */
  approvalUrl(approvalToken: string): string {
    return `${this.baseUrl}/approve/${approvalToken}`;
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  async listOrders(consumerId: string): Promise<OrdersListResult> {
    return this.client.get<OrdersListResult>("/v1/orders", { consumerId }, { skipCache: true });
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    return this.client.get<OrderResult>(`/v1/orders/${orderId}`, undefined, { skipCache: true });
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  clearCache(): void {
    this.client.clearCache();
  }
}
