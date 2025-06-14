import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  username: varchar("username").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  walletAddress: varchar("wallet_address").unique(),
  avatarSvg: text("avatar_svg"),
  avatarConfig: jsonb("avatar_config"),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("1000.00"),
  unclaimedWinnings: decimal("unclaimed_winnings", { precision: 10, scale: 2 }).default("0.00"),
  hasSeenTutorial: boolean("has_seen_tutorial").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const markets = pgTable("markets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  categoryId: integer("category_id").references(() => categories.id),
  creatorId: varchar("creator_id").references(() => users.id),
  endDate: timestamp("end_date").notNull(),
  resolved: boolean("resolved").default(false),
  outcome: boolean("outcome"),
  totalVolume: decimal("total_volume", { precision: 12, scale: 4 }).default("0.0000"),
  yesPool: decimal("yes_pool", { precision: 12, scale: 4 }).default("1000.0000"),
  noPool: decimal("no_pool", { precision: 12, scale: 4 }).default("1000.0000"),
  yesPrice: decimal("yes_price", { precision: 5, scale: 4 }).default("0.5000"),
  noPrice: decimal("no_price", { precision: 5, scale: 4 }).default("0.5000"),
  participantCount: integer("participant_count").default(0),
  featured: boolean("featured").default(false),
  resolverUrl: text("resolver_url"), // URL for resolution determination
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  marketId: integer("market_id").references(() => markets.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  side: boolean("side").notNull(), // true for YES, false for NO
  price: decimal("price", { precision: 5, scale: 4 }).notNull(),
  shares: decimal("shares", { precision: 10, scale: 4 }).notNull(),
  resolved: boolean("resolved").default(false),
  payout: decimal("payout", { precision: 10, scale: 2 }),
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievement badges table
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(), // lucide icon name
  category: varchar("category", { length: 50 }).notNull(), // accuracy, volume, streak, etc.
  threshold: decimal("threshold", { precision: 10, scale: 2 }), // threshold value for earning
  color: varchar("color", { length: 20 }).notNull().default("#3B82F6"), // badge color
  rarity: varchar("rarity", { length: 20 }).notNull().default("common"), // common, rare, epic, legendary
  createdAt: timestamp("created_at").defaultNow(),
});

// User badges (many-to-many relationship)
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeId: integer("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow(),
  progress: decimal("progress", { precision: 10, scale: 2 }).default("0"), // current progress toward next badge
});

// Wallet data cache table for storing refreshed blockchain balances
export const walletData = pgTable("wallet_data", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").unique().notNull().references(() => users.id),
  solanaAddress: varchar("solana_address"),
  ethereumAddress: varchar("ethereum_address"),
  solanaBalance: varchar("solana_balance").default("0"),
  ethereumBalance: varchar("ethereum_balance").default("0"),
  totalUsdValue: varchar("total_usd_value").default("0"),
  tokens: jsonb("tokens").$type<Array<{
    symbol: string;
    balance: number;
    usdValue: number;
    chain: 'solana' | 'ethereum';
  }>>().default([]),
  lastRefreshed: timestamp("last_refreshed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdMarkets: many(markets),
  bets: many(bets),
  userBadges: many(userBadges),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  markets: many(markets),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  category: one(categories, {
    fields: [markets.categoryId],
    references: [categories.id],
  }),
  creator: one(users, {
    fields: [markets.creatorId],
    references: [users.id],
  }),
  bets: many(bets),
}));

export const betsRelations = relations(bets, ({ one }) => ({
  user: one(users, {
    fields: [bets.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [bets.marketId],
    references: [markets.id],
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertMarketSchema = createInsertSchema(markets).omit({
  id: true,
  totalVolume: true,
  yesPrice: true,
  noPrice: true,
  participantCount: true,
  resolved: true,
  outcome: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  endDate: z.string().transform((str) => new Date(str)),
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  resolved: true,
  payout: true,
  createdAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof markets.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// Extended types for API responses
export type MarketWithCategory = Market & {
  category: Category | null;
  creator: User | null;
};

export type BetWithMarket = Bet & {
  market: MarketWithCategory;
};

export type UserBadgeWithBadge = UserBadge & {
  badge: Badge;
};

export type UserStats = {
  totalBets: number;
  totalWinnings: string;
  winRate: number;
  portfolioValue: string;
};

export type WalletData = typeof walletData.$inferSelect;
export type InsertWalletData = typeof walletData.$inferInsert;
