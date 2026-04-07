import {
  pgTable,
  text,
  varchar,
  numeric,
  timestamp,
  jsonb,
  index,
  integer,
  pgEnum,
  vector,
  serial,
} from "drizzle-orm/pg-core";

export const availabilityEnum = pgEnum("availability", [
  "in_stock",
  "out_of_stock",
  "unknown",
]);

export const storeSourceEnum = pgEnum("store_source", ["native", "scraped"]);

export const stores = pgTable(
  "stores",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull().unique(),
    agoraJsonUrl: text("agora_json_url"),
    source: storeSourceEnum("source").notNull(),
    capabilities: jsonb("capabilities").$type<Record<string, string>>().default({}),
    productCount: integer("product_count").notNull().default(0),
    validationScore: integer("validation_score"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stores_source").on(table.source),
    index("idx_stores_status").on(table.status),
  ]
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(), // agr_xxx format
    sourceUrl: text("source_url").notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }),
    priceCurrency: varchar("price_currency", { length: 3 }).default("USD"),
    images: jsonb("images").$type<string[]>().default([]),
    categories: jsonb("categories").$type<string[]>().default([]),
    attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
    availability: availabilityEnum("availability").default("unknown"),
    sellerName: text("seller_name"),
    sellerUrl: text("seller_url"),
    sellerRating: numeric("seller_rating", { precision: 3, scale: 2 }),
    lastCrawled: timestamp("last_crawled", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
  },
  (table) => [
    index("idx_products_source").on(table.source),
    index("idx_products_availability").on(table.availability),
    index("idx_products_source_url").on(table.sourceUrl),
    index("idx_products_store").on(table.storeId),
  ]
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_price_history_product").on(table.productId),
    index("idx_price_history_recorded").on(table.recordedAt),
  ]
);

export const productEmbeddings = pgTable(
  "product_embeddings",
  {
    productId: text("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_embeddings_vector").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    parentId: integer("parent_id"),
    source: varchar("source", { length: 50 }),
  },
  (table) => [
    index("idx_categories_slug").on(table.slug),
    index("idx_categories_parent").on(table.parentId),
  ]
);

export const tierEnum = pgEnum("tier", ["free", "pro", "enterprise"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  githubId: text("github_id").notNull().unique(),
  githubUsername: text("github_username").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default(""),
  stripeCustomerId: text("stripe_customer_id"),
  tier: tierEnum("tier").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    key: varchar("key", { length: 64 }).primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tier: varchar("tier", { length: 20 }).notNull().default("free"),
    requestCount: integer("request_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_api_keys_user").on(table.userId),
  ]
);

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  tier: tierEnum("subscription_tier").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: serial("id").primaryKey(),
    apiKeyId: varchar("api_key_id", { length: 64 })
      .notNull()
      .references(() => apiKeys.key, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    statusCode: integer("status_code").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_usage_logs_key").on(table.apiKeyId),
    index("idx_usage_logs_timestamp").on(table.timestamp),
  ]
);
