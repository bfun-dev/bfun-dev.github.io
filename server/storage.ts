import {
  users,
  categories,
  markets,
  bets,
  badges,
  userBadges,
  walletData,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Market,
  type InsertMarket,
  type MarketWithCategory,
  type Bet,
  type InsertBet,
  type BetWithMarket,
  type Badge,
  type InsertBadge,
  type UserBadge,
  type InsertUserBadge,
  type UserBadgeWithBadge,
  type UserStats,
  type WalletData,
  type InsertWalletData,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql, gte, lte, ilike, inArray, gt } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByWallet(walletAddress: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  checkUsernameAvailable(username: string): Promise<boolean>;
  updateUsername(userId: string, username: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserBalance(userId: string, newBalance: string): Promise<void>;
  addToUserBalance(userId: string, additionalAmount: string): Promise<string>;
  updateUserAvatar(userId: string, avatarSvg: string, avatarConfig: any): Promise<void>;
  markTutorialSeen(userId: string): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Market operations
  getMarkets(filters?: {
    categoryIds?: number[];
    status?: 'active' | 'resolved' | 'all';
    search?: string;
    featured?: boolean;
  }): Promise<MarketWithCategory[]>;
  getMarket(id: number): Promise<MarketWithCategory | undefined>;
  createMarket(market: InsertMarket): Promise<Market>;
  updateMarketPrices(marketId: number, yesPrice: string, noPrice: string): Promise<void>;
  updateMarketPools(marketId: number, yesPool: string, noPool: string): Promise<void>;
  updateMarketVolume(marketId: number, additionalVolume: string): Promise<void>;
  resolveMarket(marketId: number, outcome: boolean): Promise<void>;

  // Bet operations
  createBet(bet: InsertBet): Promise<Bet>;
  getUserBets(userId: string): Promise<BetWithMarket[]>;
  getMarketBets(marketId: number): Promise<(Bet & { user: User | null })[]>;
  resolveBets(marketId: number, outcome: boolean): Promise<void>;

  // Statistics
  getMarketStats(): Promise<{
    totalVolume: string;
    activeUsers: number;
    totalMarkets: number;
    resolvedMarkets: number;
  }>;
  getUserStats(userId: string): Promise<UserStats>;

  // Badge operations
  getBadges(): Promise<Badge[]>;
  createBadge(badge: InsertBadge): Promise<Badge>;
  getUserBadges(userId: string): Promise<UserBadgeWithBadge[]>;
  awardBadge(userId: string, badgeId: number): Promise<UserBadge>;
  checkAndAwardBadges(userId: string): Promise<UserBadgeWithBadge[]>;

  // Wallet data operations
  getWalletData(userId: string): Promise<WalletData | undefined>;
  upsertWalletData(data: InsertWalletData): Promise<WalletData>;

  // Winnings operations
  claimWinnings(userId: string, betId: number): Promise<string>;
  getUnclaimedWinnings(userId: string): Promise<{ totalAmount: string; bets: any[] }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserByWallet(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return !user;
  }

  async updateUsername(userId: string, username: string): Promise<void> {
    const result = await db
      .update(users)
      .set({ username, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
      
    if (result.length === 0) {
      throw new Error("User not found or update failed");
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // Try to insert new user first
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
      return user;
    } catch (error: any) {
      // If insert fails due to constraint (user already exists), find and return existing user
      if (error.code === '23505') { // Unique constraint violation
        let existingUser: User | undefined;
        
        // First check by ID
        if (userData.id) {
          const [user] = await db.select().from(users).where(eq(users.id, userData.id));
          if (user) existingUser = user;
        }
        
        // Then check by wallet address if no user found
        if (!existingUser && userData.walletAddress) {
          const [user] = await db.select().from(users).where(eq(users.walletAddress, userData.walletAddress));
          if (user) existingUser = user;
        }
        
        // Finally check by email if no user found
        if (!existingUser && userData.email) {
          const [user] = await db.select().from(users).where(eq(users.email, userData.email));
          if (user) existingUser = user;
        }
        
        if (existingUser) {
          // Only update safe fields that won't cause foreign key issues
          const [updatedUser] = await db
            .update(users)
            .set({
              email: userData.email || existingUser.email,
              firstName: userData.firstName || existingUser.firstName,
              lastName: userData.lastName || existingUser.lastName,
              profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning();
          return updatedUser;
        }
      }
      
      throw error; // Re-throw if it's a different error
    }
  }

  async updateUserBalance(userId: string, newBalance: string): Promise<void> {
    await db
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async addToUserBalance(userId: string, additionalAmount: string): Promise<string> {
    // Atomic operation to add to balance avoiding race conditions
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const currentBalance = parseFloat(user.balance || '0');
    const additionalValue = parseFloat(additionalAmount);
    const newBalance = (currentBalance + additionalValue).toString();
    
    await db
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId));
      
    return newBalance;
  }

  async updateUserAvatar(userId: string, avatarSvg: string, avatarConfig: any): Promise<void> {
    await db
      .update(users)
      .set({ avatarSvg, avatarConfig, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async markTutorialSeen(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        hasSeenTutorial: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  // Market operations
  async getMarkets(filters?: {
    categoryIds?: number[];
    status?: 'active' | 'resolved' | 'all';
    search?: string;
    featured?: boolean;
  }): Promise<MarketWithCategory[]> {
    let query = db
      .select({
        id: markets.id,
        title: markets.title,
        description: markets.description,
        imageUrl: markets.imageUrl,
        categoryId: markets.categoryId,
        creatorId: markets.creatorId,
        endDate: markets.endDate,
        resolved: markets.resolved,
        outcome: markets.outcome,
        totalVolume: markets.totalVolume,
        yesPrice: markets.yesPrice,
        noPrice: markets.noPrice,
        participantCount: markets.participantCount,
        featured: markets.featured,
        resolverUrl: markets.resolverUrl,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          createdAt: categories.createdAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          balance: users.balance,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(markets)
      .leftJoin(categories, eq(markets.categoryId, categories.id))
      .leftJoin(users, eq(markets.creatorId, users.id));

    const conditions = [];

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      conditions.push(inArray(markets.categoryId, filters.categoryIds));
    }

    if (filters?.status === 'active') {
      conditions.push(eq(markets.resolved, false));
    } else if (filters?.status === 'resolved') {
      conditions.push(eq(markets.resolved, true));
    }
    // For 'all' status, we don't add any resolution filter

    if (filters?.search) {
      conditions.push(ilike(markets.title, `%${filters.search}%`));
    }

    if (filters?.featured) {
      conditions.push(eq(markets.featured, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(
      asc(markets.resolved), // Active markets (resolved=false) first
      desc(markets.createdAt) // Then by creation date within each group
    );

    return result.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      categoryId: row.categoryId,
      creatorId: row.creatorId,
      endDate: row.endDate,
      resolved: row.resolved,
      outcome: row.outcome,
      totalVolume: row.totalVolume,
      yesPrice: row.yesPrice,
      noPrice: row.noPrice,
      yesPool: row.yesPool,
      noPool: row.noPool,
      participantCount: row.participantCount,
      featured: row.featured,
      resolverUrl: row.resolverUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      category: row.category?.id ? row.category : null,
      creator: row.creator?.id ? row.creator : null,
    }));
  }

  async getMarket(id: number): Promise<MarketWithCategory | undefined> {
    const [result] = await db
      .select({
        id: markets.id,
        title: markets.title,
        description: markets.description,
        imageUrl: markets.imageUrl,
        categoryId: markets.categoryId,
        creatorId: markets.creatorId,
        endDate: markets.endDate,
        resolved: markets.resolved,
        outcome: markets.outcome,
        totalVolume: markets.totalVolume,
        yesPrice: markets.yesPrice,
        noPrice: markets.noPrice,
        participantCount: markets.participantCount,
        featured: markets.featured,
        resolverUrl: markets.resolverUrl,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          createdAt: categories.createdAt,
        },
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          balance: users.balance,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(markets)
      .leftJoin(categories, eq(markets.categoryId, categories.id))
      .leftJoin(users, eq(markets.creatorId, users.id))
      .where(eq(markets.id, id));

    if (!result) return undefined;

    return {
      id: result.id,
      title: result.title,
      description: result.description,
      imageUrl: result.imageUrl,
      categoryId: result.categoryId,
      creatorId: result.creatorId,
      endDate: result.endDate,
      resolved: result.resolved,
      outcome: result.outcome,
      totalVolume: result.totalVolume,
      yesPrice: result.yesPrice,
      noPrice: result.noPrice,
      participantCount: result.participantCount,
      featured: result.featured,
      resolverUrl: result.resolverUrl,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      category: result.category?.id ? result.category : null,
      creator: result.creator?.id ? result.creator : null,
    };
  }

  async createMarket(market: InsertMarket): Promise<Market> {
    const [newMarket] = await db
      .insert(markets)
      .values(market)
      .returning();
    return newMarket;
  }

  async updateMarketPrices(marketId: number, yesPrice: string, noPrice: string): Promise<void> {
    await db
      .update(markets)
      .set({ yesPrice, noPrice, updatedAt: new Date() })
      .where(eq(markets.id, marketId));
  }

  async updateMarketPools(marketId: number, yesPool: string, noPool: string): Promise<void> {
    await db
      .update(markets)
      .set({ yesPool, noPool, updatedAt: new Date() })
      .where(eq(markets.id, marketId));
  }

  async updateMarketVolume(marketId: number, additionalVolume: string): Promise<void> {
    await db
      .update(markets)
      .set({
        totalVolume: sql`${markets.totalVolume} + ${additionalVolume}`,
        participantCount: sql`${markets.participantCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(markets.id, marketId));
  }

  async resolveMarket(marketId: number, outcome: boolean): Promise<void> {
    await db
      .update(markets)
      .set({ resolved: true, outcome, updatedAt: new Date() })
      .where(eq(markets.id, marketId));
  }

  // Bet operations
  async createBet(bet: InsertBet): Promise<Bet> {
    const [newBet] = await db
      .insert(bets)
      .values(bet)
      .returning();
    return newBet;
  }

  async getUserBets(userId: string): Promise<BetWithMarket[]> {
    const result = await db
      .select({
        id: bets.id,
        userId: bets.userId,
        marketId: bets.marketId,
        amount: bets.amount,
        side: bets.side,
        price: bets.price,
        shares: bets.shares,
        resolved: bets.resolved,
        payout: bets.payout,
        createdAt: bets.createdAt,
        market: {
          id: markets.id,
          title: markets.title,
          description: markets.description,
          categoryId: markets.categoryId,
          creatorId: markets.creatorId,
          endDate: markets.endDate,
          resolved: markets.resolved,
          outcome: markets.outcome,
          totalVolume: markets.totalVolume,
          yesPrice: markets.yesPrice,
          noPrice: markets.noPrice,
          participantCount: markets.participantCount,
          featured: markets.featured,
          createdAt: markets.createdAt,
          updatedAt: markets.updatedAt,
          category: {
            id: categories.id,
            name: categories.name,
            color: categories.color,
            createdAt: categories.createdAt,
          },
          creator: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            balance: users.balance,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
        },
      })
      .from(bets)
      .innerJoin(markets, eq(bets.marketId, markets.id))
      .leftJoin(categories, eq(markets.categoryId, categories.id))
      .leftJoin(users, eq(markets.creatorId, users.id))
      .where(eq(bets.userId, userId))
      .orderBy(desc(bets.createdAt));

    return result.map(row => ({
      ...row,
      market: {
        ...row.market,
        category: row.market.category.id ? row.market.category : null,
        creator: row.market.creator.id ? row.market.creator : null,
      },
    }));
  }

  async getMarketBets(marketId: number): Promise<(Bet & { user: User | null })[]> {
    return db
      .select({
        id: bets.id,
        userId: bets.userId,
        marketId: bets.marketId,
        amount: bets.amount,
        side: bets.side,
        price: bets.price,
        shares: bets.shares,
        resolved: bets.resolved,
        payout: bets.payout,
        createdAt: bets.createdAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          balance: users.balance,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(bets)
      .leftJoin(users, eq(bets.userId, users.id))
      .where(eq(bets.marketId, marketId))
      .orderBy(desc(bets.createdAt));
  }

  async resolveBets(marketId: number, outcome: boolean): Promise<void> {
    console.log(`📊 Resolving bets for market ${marketId} with outcome: ${outcome ? 'YES' : 'NO'}`);
    
    // Get all bets for this market
    const allBets = await db
      .select()
      .from(bets)
      .where(eq(bets.marketId, marketId));

    const winningBets = allBets.filter(bet => bet.side === outcome);
    const losingBets = allBets.filter(bet => bet.side !== outcome);

    console.log(`💰 Found ${winningBets.length} winning bets and ${losingBets.length} losing bets`);

    // Calculate total pools (using net amounts that actually went into the pool)
    const totalWinningPool = winningBets.reduce((sum, bet) => sum + parseFloat(bet.shares || "0"), 0);
    const totalLosingPool = losingBets.reduce((sum, bet) => sum + parseFloat(bet.shares || "0"), 0);
    const totalPool = totalWinningPool + totalLosingPool;

    console.log(`Pool breakdown: Winning pool: $${totalWinningPool.toFixed(4)}, Losing pool: $${totalLosingPool.toFixed(4)}, Total: $${totalPool.toFixed(4)}`);

    // Calculate payouts for winning bets based on pool proportions
    for (const bet of winningBets) {
      if (!bet.userId) {
        console.log(`⚠️ Skipping bet ${bet.id} - no user ID`);
        continue;
      }

      const betNetAmount = parseFloat(bet.shares || "0");
      // Proportional share of the total pool based on bet size
      const proportionalShare = totalPool > 0 ? (betNetAmount / totalWinningPool) * totalPool : betNetAmount;
      
      console.log(`💸 User ${bet.userId} bet $${betNetAmount} net, gets proportional payout: $${proportionalShare.toFixed(4)}`);
      
      // Mark bet as resolved with payout but not yet claimed
      await db
        .update(bets)
        .set({ resolved: true, payout: proportionalShare.toString(), claimed: false })
        .where(eq(bets.id, bet.id));
    }

    // Mark losing bets as resolved with no payout
    console.log(`📉 Marking ${losingBets.length} losing bets as resolved with no payout`);
    
    await db
      .update(bets)
      .set({ resolved: true, payout: "0", claimed: true }) // Losing bets marked as "claimed" (no payout to claim)
      .where(and(eq(bets.marketId, marketId), eq(bets.side, !outcome)));
      
    console.log(`✅ Market ${marketId} bet resolution completed - payouts are now claimable`);
  }

  // New method to claim winnings
  async claimWinnings(userId: string, betId: number): Promise<string> {
    const bet = await db
      .select()
      .from(bets)
      .where(and(eq(bets.id, betId), eq(bets.userId, userId)))
      .limit(1);

    if (!bet.length) {
      throw new Error("Bet not found or doesn't belong to user");
    }

    const betData = bet[0];
    
    if (!betData.resolved) {
      throw new Error("Bet is not yet resolved");
    }

    if (betData.claimed) {
      throw new Error("Winnings already claimed");
    }

    const payout = parseFloat(betData.payout || "0");
    if (payout <= 0) {
      throw new Error("No winnings to claim");
    }

    // Mark as claimed
    await db
      .update(bets)
      .set({ claimed: true })
      .where(eq(bets.id, betId));

    // Add to user balance
    const user = await this.getUser(userId);
    if (user) {
      const currentBalance = parseFloat(user.balance || "0");
      const newBalance = (currentBalance + payout).toString();
      console.log(`💳 Claiming winnings for user ${userId}: ${currentBalance} + ${payout} = ${newBalance}`);
      await this.updateUserBalance(userId, newBalance);
      return newBalance;
    } else {
      throw new Error("User not found");
    }
  }

  // Get unclaimed winnings for a user
  async getUnclaimedWinnings(userId: string): Promise<{ totalAmount: string; bets: any[] }> {
    const unclaimedBets = await db
      .select({
        id: bets.id,
        marketId: bets.marketId,
        amount: bets.amount,
        side: bets.side,
        payout: bets.payout,
        createdAt: bets.createdAt,
        market: {
          id: markets.id,
          title: markets.title
        }
      })
      .from(bets)
      .innerJoin(markets, eq(bets.marketId, markets.id))
      .where(and(
        eq(bets.userId, userId),
        eq(bets.resolved, true),
        eq(bets.claimed, false),
        gt(bets.payout, "0")
      ))
      .orderBy(desc(bets.createdAt));

    const totalAmount = unclaimedBets.reduce((sum, bet) => 
      sum + parseFloat(bet.payout || "0"), 0
    ).toString();

    return { totalAmount, bets: unclaimedBets };
  }

  // Statistics
  async getMarketStats(): Promise<{
    totalVolume: string;
    activeUsers: number;
    totalMarkets: number;
    resolvedMarkets: number;
  }> {
    const [volumeResult] = await db
      .select({ totalVolume: sql<string>`COALESCE(SUM(${markets.totalVolume}), 0)` })
      .from(markets);

    const [activeUsersResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${bets.userId})` })
      .from(bets)
      .where(gte(bets.createdAt, sql`NOW() - INTERVAL '30 days'`));

    const [marketsResult] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        resolved: sql<number>`SUM(CASE WHEN ${markets.resolved} THEN 1 ELSE 0 END)`,
      })
      .from(markets);

    return {
      totalVolume: volumeResult.totalVolume || "0",
      activeUsers: activeUsersResult.count || 0,
      totalMarkets: marketsResult.total || 0,
      resolvedMarkets: marketsResult.resolved || 0,
    };
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [statsResult] = await db
      .select({
        totalBets: sql<number>`COUNT(*)`,
        totalWinnings: sql<string>`COALESCE(SUM(CASE WHEN ${bets.resolved} AND ${bets.payout} > 0 THEN ${bets.payout} ELSE 0 END), 0)`,
        winningBets: sql<number>`SUM(CASE WHEN ${bets.resolved} AND ${bets.payout} > 0 THEN 1 ELSE 0 END)`,
        resolvedBets: sql<number>`SUM(CASE WHEN ${bets.resolved} THEN 1 ELSE 0 END)`,
      })
      .from(bets)
      .where(eq(bets.userId, userId));

    const winRate = statsResult.resolvedBets > 0 
      ? (statsResult.winningBets / statsResult.resolvedBets) * 100 
      : 0;

    // Calculate portfolio value (unresolved bet values + current balance)
    const user = await this.getUser(userId);
    const unresolvedBets = await db
      .select({ totalValue: sql<string>`COALESCE(SUM(${bets.amount}), 0)` })
      .from(bets)
      .where(and(eq(bets.userId, userId), eq(bets.resolved, false)));

    const portfolioValue = (
      parseFloat(user?.balance || "0") + 
      parseFloat(unresolvedBets[0]?.totalValue || "0")
    ).toString();

    return {
      totalBets: statsResult.totalBets || 0,
      totalWinnings: statsResult.totalWinnings || "0",
      winRate,
      portfolioValue,
    };
  }

  // Badge operations
  async getBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.category, badges.threshold);
  }

  async createBadge(badge: InsertBadge): Promise<Badge> {
    const [newBadge] = await db.insert(badges).values(badge).returning();
    return newBadge;
  }

  async getUserBadges(userId: string): Promise<UserBadgeWithBadge[]> {
    const result = await db
      .select()
      .from(userBadges)
      .leftJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));

    return result.map(row => ({
      ...row.user_badges,
      badge: row.badges!,
    }));
  }

  async awardBadge(userId: string, badgeId: number): Promise<UserBadge> {
    // Check if user already has this badge
    const existingBadge = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
      .limit(1);

    if (existingBadge.length > 0) {
      return existingBadge[0];
    }

    const [newUserBadge] = await db
      .insert(userBadges)
      .values({ userId, badgeId })
      .returning();

    return newUserBadge;
  }

  async checkAndAwardBadges(userId: string): Promise<UserBadgeWithBadge[]> {
    // Get user stats for badge calculations
    const userStats = await this.getUserStats(userId);
    
    // Get all available badges
    const allBadges = await this.getBadges();
    
    // Get user's current badges to avoid duplicates
    const currentBadges = await this.getUserBadges(userId);
    const currentBadgeIds = currentBadges.map(ub => ub.badgeId);
    
    const newlyEarnedBadges: UserBadgeWithBadge[] = [];
    
    for (const badge of allBadges) {
      if (currentBadgeIds.includes(badge.id)) continue;
      
      let shouldAward = false;
      
      switch (badge.category) {
        case 'accuracy':
          shouldAward = userStats.winRate >= parseFloat(badge.threshold || "0");
          break;
        case 'volume':
          shouldAward = parseFloat(userStats.totalWinnings) >= parseFloat(badge.threshold || "0");
          break;
        case 'experience':
          shouldAward = userStats.totalBets >= parseFloat(badge.threshold || "0");
          break;
      }
      
      if (shouldAward) {
        const userBadge = await this.awardBadge(userId, badge.id);
        newlyEarnedBadges.push({
          ...userBadge,
          badge,
        });
      }
    }
    
    return newlyEarnedBadges;
  }

  // Wallet data operations
  async getWalletData(userId: string): Promise<WalletData | undefined> {
    const [wallet] = await db
      .select()
      .from(walletData)
      .where(eq(walletData.userId, userId));
    return wallet;
  }

  async upsertWalletData(data: InsertWalletData): Promise<WalletData> {
    const [wallet] = await db
      .insert(walletData)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: walletData.userId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return wallet;
  }
}

export const storage = new DatabaseStorage();
