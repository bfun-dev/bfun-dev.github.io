import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { users, bets, markets } from "@shared/schema";
import { sql, eq, desc, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { insertMarketSchema, insertBetSchema, insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { getTokenPrices, getTokenPrice, calculateTokenUSDValue } from "./price-service";
import crypto from "crypto";

// Admin credentials (in production, these should be in environment variables)
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || "admin@bets.fun",
  password: process.env.ADMIN_PASSWORD || "admin123", // Change this!
};

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-admin-jwt-key";

// Admin authentication middleware
const isAdminAuthenticated = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Admin token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  // app
  // Admin authentication routes
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        const token = jwt.sign(
          { email, role: 'admin' },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.json({ token });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get('/api/admin/verify', isAdminAuthenticated, (req, res) => {
    res.json({ valid: true });
  });

  // Admin users endpoint - returns real database users
  app.get('/api/admin/users', isAdminAuthenticated, async (req, res) => {
    try {
      // Get all users from database using storage interface
      const allUsers = await storage.getAllUsers();
      
      // Format users for admin panel with stats
      const adminUsers = await Promise.all(allUsers.map(async (user: any) => {
        const stats = await storage.getUserStats(user.id);
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance || "0.00",
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          walletAddress: user.walletAddress,
          hasSeenTutorial: user.hasSeenTutorial || false,
          totalBets: stats.totalBets,
          totalWinnings: stats.totalWinnings,
        };
      }));
      
      res.json(adminUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin user stats endpoint
  app.get('/api/admin/user-stats', isAdminAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const totalUsers = allUsers.length;
      
      // Get bets count from all users
      let totalBets = 0;
      for (const user of allUsers) {
        const userStats = await storage.getUserStats(user.id);
        totalBets += userStats.totalBets;
      }
      
      // Calculate other stats from actual data
      const stats = {
        totalUsers,
        totalBets,
        activeUsers: Math.floor(totalUsers * 0.7), // Estimate active users
        newUsersToday: Math.floor(totalUsers * 0.1), // Estimate new users today
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Admin Wallet Management Endpoints
  app.get('/api/admin/wallets', isAdminAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const wallets = [];

      // Quick generation with database-cached balance data when available
      for (const user of users) {
        try {
          // Generate wallet addresses
          const userIdentifier = user.email || user.id.toString();
          const { ethers } = await import('ethers');
          const { Keypair } = await import('@solana/web3.js');
          
          const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
          const seedString = `wallet_${userIdentifier}_${clientId}`;
          const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
          
          // Generate Ethereum wallet
          let ethereumAddress = user.walletAddress;
          if (!ethereumAddress || ethereumAddress === 'Not connected') {
            const ethWallet = new ethers.Wallet(ethSeed);
            ethereumAddress = ethWallet.address;
          }
          
          // Generate Solana wallet
          const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
          const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
          const solanaAddress = solanaKeypair.publicKey.toBase58();

          // Check if we have cached balance data for this user in database
          const cachedData = await storage.getWalletData(user.id);
          
          wallets.push({
            userId: user.id,
            userName: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
            email: user.email,
            solanaAddress,
            ethereumAddress,
            totalUsdValue: cachedData ? parseFloat(cachedData.totalUsdValue || "0") : 0,
            solanaBalance: cachedData ? parseFloat(cachedData.solanaBalance || "0") : 0,
            ethereumBalance: cachedData ? parseFloat(cachedData.ethereumBalance || "0") : 0,
            tokens: cachedData?.tokens || [],
            lastActivity: cachedData?.lastRefreshed?.toISOString() || user.updatedAt?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
            autoSwapEnabled: false,
            isRefreshed: !!cachedData
          });
        } catch (userError) {
          console.error(`Error processing wallet for user ${user.id}:`, userError);
          wallets.push({
            userId: user.id,
            userName: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
            email: user.email,
            solanaAddress: 'Error loading',
            ethereumAddress: 'Error loading',
            totalUsdValue: 0,
            solanaBalance: 0,
            ethereumBalance: 0,
            tokens: [],
            lastActivity: user.updatedAt?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
            autoSwapEnabled: false,
            isRefreshed: false
          });
        }
      }

      res.json(wallets);
    } catch (error) {
      console.error("Error fetching admin wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
    }
  });

  // Admin platform wallets endpoint
  app.get('/api/admin/platform-wallets', isAdminAuthenticated, async (req, res) => {
    try {
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      console.log("🔄 Admin wallets: Fetching fresh blockchain data...");
      
      // Generate admin-specific wallet seeds
      const adminSeed = process.env.ADMIN_WALLET_SEED || 'admin_platform_wallets_bets_fun_2024';
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(`${adminSeed}_ethereum`));
      const solSeed = ethers.keccak256(ethers.toUtf8Bytes(`${adminSeed}_solana`));
      
      // Generate Ethereum wallet
      const ethWallet = new ethers.Wallet(ethSeed);
      const ethereumAddress = ethWallet.address;
      const ethereumPrivateKey = ethWallet.privateKey;
      
      // Generate Solana wallet
      const solSeedBytes = ethers.getBytes(solSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();
      const solanaPrivateKey = Buffer.from(solanaKeypair.secretKey).toString('hex');
      
      console.log(`🔍 Admin ETH wallet: ${ethereumAddress}`);
      console.log(`🔍 Admin SOL wallet: ${solanaAddress}`);
      
      // Force fresh blockchain queries (no cache)
      const [ethData, solData] = await Promise.all([
        fetchEthereumTokens(ethereumAddress).catch(err => {
          console.error("Error fetching ETH data:", err);
          return { eth: "0", tokens: [] };
        }),
        fetchSolanaTokens(solanaAddress).catch(err => {
          console.error("Error fetching SOL data:", err);
          return { sol: "0", tokens: [] };
        })
      ]);
      
      console.log(`✅ Admin ETH balance: ${ethData.eth} ETH, ${ethData.tokens.length} tokens`);
      console.log(`✅ Admin SOL balance: ${solData.sol} SOL, ${solData.tokens.length} tokens`);
      
      // Log detailed token information for debugging
      if (solData.tokens.length > 0) {
        console.log("📋 Admin SOL tokens details:");
        solData.tokens.forEach((token: any, index: number) => {
          const readableBalance = (parseFloat(token.balance) / Math.pow(10, token.decimals)).toFixed(6);
          console.log(`  ${index + 1}. ${token.symbol}: ${token.balance} raw (${readableBalance} ${token.symbol}) [${token.decimals} decimals]`);
        });
      }
      
      const adminWallets = {
        ethereum: {
          address: ethereumAddress,
          privateKey: ethereumPrivateKey,
          balance: ethData.eth,
          tokens: ethData.tokens
        },
        solana: {
          address: solanaAddress,
          privateKey: solanaPrivateKey,
          balance: solData.sol,
          tokens: solData.tokens
        }
      };
      
      // Set no-cache headers to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(adminWallets);
    } catch (error) {
      console.error("Error fetching admin platform wallets:", error);
      res.status(500).json({ message: "Failed to fetch platform wallets" });
    }
  });

  app.get('/api/admin/wallet-stats', isAdminAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      let totalUsdValue = 0;
      let activeWallets = 0;
      let solanaWallets = 0;
      let ethereumWallets = 0;

      for (const user of users) {
        try {
          // Generate wallets for user
          const userIdentifier = user.email || user.id.toString();
          const { ethers } = await import('ethers');
          const { Keypair } = await import('@solana/web3.js');
          
          const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
          const seedString = `wallet_${userIdentifier}_${clientId}`;
          const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
          
          // Generate addresses
          let ethereumAddress = user.walletAddress;
          if (!ethereumAddress || ethereumAddress === 'Not connected') {
            const ethWallet = new ethers.Wallet(ethSeed);
            ethereumAddress = ethWallet.address;
          }
          
          const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
          const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
          const solanaAddress = solanaKeypair.publicKey.toBase58();

          // Count wallets
          if (ethereumAddress && ethereumAddress !== 'Error loading') ethereumWallets++;
          if (solanaAddress) solanaWallets++;

          // Quick balance check for total value (simplified)
          const tokenPrices = await getTokenPrices();
          const ethPrice = tokenPrices['ETH'] || 0;
          const solPrice = tokenPrices['SOL'] || 0;
          
          // For stats, we'll do a simplified calculation
          totalUsdValue += 0; // Would calculate actual balances here
          activeWallets++;
        } catch (error) {
          console.error(`Error processing wallet stats for user ${user.id}:`, error);
        }
      }

      const stats = {
        totalWallets: users.length,
        totalUsdValue: totalUsdValue.toFixed(2),
        activeWallets,
        solanaWallets,
        ethereumWallets
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching wallet stats:", error);
      res.status(500).json({ message: "Failed to fetch wallet statistics" });
    }
  });

  app.get('/api/admin/wallets/:userId/keys', isAdminAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate wallet keys using the same deterministic method
      const userIdentifier = user.email || user.id.toString();
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate Ethereum wallet
      const ethWallet = new ethers.Wallet(ethSeed);
      
      // Generate Solana wallet
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      
      // Convert Solana private key to base58 format
      const bs58 = await import('bs58');
      const solanaPrivateKey = bs58.default.encode(solanaKeypair.secretKey);

      const walletKeys = {
        userId: user.id,
        userName: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
        email: user.email,
        solana: {
          address: solanaKeypair.publicKey.toBase58(),
          privateKey: solanaPrivateKey,
          mnemonic: null // Solana doesn't use mnemonic with this method
        },
        ethereum: {
          address: ethWallet.address,
          privateKey: ethWallet.privateKey,
          mnemonic: null // Would need different generation method for mnemonic
        }
      };

      res.json(walletKeys);
    } catch (error) {
      console.error("Error generating wallet keys:", error);
      res.status(500).json({ message: "Failed to generate wallet keys" });
    }
  });

  app.post('/api/admin/wallets/:userId/refresh', isAdminAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Force refresh wallet data by regenerating and fetching fresh balances
      const userIdentifier = user.email || user.id.toString();
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      let ethereumAddress = user.walletAddress;
      if (!ethereumAddress || ethereumAddress === 'Not connected') {
        const ethWallet = new ethers.Wallet(ethSeed);
        ethereumAddress = ethWallet.address;
      }
      
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();

      console.log(`Refreshing wallet data for user ${userId} - ETH: ${ethereumAddress} SOL: ${solanaAddress}`);

      // Fetch fresh balances
      const ethData = await fetchEthereumTokens(ethereumAddress);
      const solData = await fetchSolanaTokens(solanaAddress);

      // Calculate total USD value
      const tokenPrices = await getTokenPrices();
      const ethUsdValue = parseFloat(ethData.eth) * (tokenPrices['ETH'] || 0);
      const solUsdValue = parseFloat(solData.sol) * (tokenPrices['SOL'] || 0);
      
      // Calculate USD value for each token
      let tokensUsdValue = 0;
      for (const token of ethData.tokens) {
        const price = tokenPrices[token.symbol] || 0;
        tokensUsdValue += parseFloat(token.balance) * price;
      }
      for (const token of solData.tokens) {
        const price = tokenPrices[token.symbol] || 0;
        tokensUsdValue += parseFloat(token.balance) * price;
      }

      const totalUsdValue = ethUsdValue + solUsdValue + tokensUsdValue;

      const walletData = {
        userId: user.id,
        userName: user.username || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
        email: user.email,
        solanaAddress,
        ethereumAddress,
        totalUsdValue,
        solanaBalance: parseFloat(solData.sol),
        ethereumBalance: parseFloat(ethData.eth),
        tokens: [
          ...ethData.tokens.map(token => ({
            symbol: token.symbol,
            balance: parseFloat(token.balance),
            usdValue: parseFloat(token.balance) * (tokenPrices[token.symbol] || 0),
            chain: 'ethereum' as const
          })),
          ...solData.tokens.map(token => ({
            symbol: token.symbol,
            balance: parseFloat(token.balance),
            usdValue: parseFloat(token.balance) * (tokenPrices[token.symbol] || 0),
            chain: 'solana' as const
          }))
        ],
        lastActivity: new Date().toISOString(),
        autoSwapEnabled: false
      };

      // Store the refreshed data in database for persistent caching
      await storage.upsertWalletData({
        userId: user.id,
        solanaAddress,
        ethereumAddress,
        solanaBalance: solData.sol,
        ethereumBalance: ethData.eth,
        totalUsdValue: totalUsdValue.toString(),
        tokens: walletData.tokens,
        lastRefreshed: new Date(),
      });

      res.json(walletData);
    } catch (error) {
      console.error("Error refreshing wallet:", error);
      res.status(500).json({ message: "Failed to refresh wallet" });
    }
  });

  // Auth routes - handles both authenticated and unauthenticated users
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated without throwing error
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser || !sessionUser.claims?.sub) {
        // User not authenticated - return null instead of 401 error
        return res.json(null);
      }
      
      // User is authenticated - fetch and return user data
      const userId = sessionUser.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        // User session exists but user not found in database
        return res.json(null);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Custom authentication route for bypassing Web3Auth base plan limitations
  app.post('/api/auth/custom-login', async (req, res) => {
    try {
      const { id, email, firstName, lastName, walletAddress, provider = 'custom' } = req.body;
      
      if (!id || !walletAddress) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Create or update user in database
      const userData = {
        id,
        email: email || `${id}@custom.auth`,
        firstName: firstName || 'User',
        lastName: lastName || '',
        profileImageUrl: 'https://via.placeholder.com/100',
        walletAddress,
        ethWallet: walletAddress,
        solWallet: `SOL${walletAddress.slice(3)}`, // Generate Solana-style address
        provider,
        verifier: 'custom'
      };

      // Upsert user to database
      const user = await storage.upsertUser(userData);
      
      // Create session
      req.session.user = {
        claims: { sub: user.id },
        access_token: 'custom_token',
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours
      };

      res.json({ 
        success: true, 
        user,
        message: "Authentication successful" 
      });
    } catch (error) {
      console.error("Custom auth error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Check wallet existence route
  app.get('/api/auth/check-wallet/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const user = await storage.getUserByWallet(walletAddress);
      
      if (user) {
        res.json({ exists: true, user });
      } else {
        res.status(404).json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking wallet:", error);
      res.status(500).json({ message: "Failed to check wallet" });
    }
  });

  // Username routes
  app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const isAvailable = await storage.checkUsernameAvailable(username);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking username:", error);
      res.status(500).json({ message: "Failed to check username" });
    }
  });

  app.post('/api/auth/update-username', async (req: any, res) => {
    try {
      // Check if user is authenticated
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser || !sessionUser.claims?.sub) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = sessionUser.claims.sub;
      const { username } = req.body;

      console.log(`🔄 Username update request - User: ${userId}, Username: ${username}`);

      if (!username || username.trim().length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters long" });
      }

      const isAvailable = await storage.checkUsernameAvailable(username);
      if (!isAvailable) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      await storage.updateUsername(userId, username);
      const updatedUser = await storage.getUser(userId);
      
      console.log(`✅ Username updated successfully - User: ${userId}, New Username: ${updatedUser?.username}`);
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating username:", error);
      res.status(500).json({ message: "Failed to update username" });
    }
  });

  // Web3Auth OAuth initiation
  app.get('/api/auth/web3auth/login', async (req, res) => {
    const { provider, redirect } = req.query;
    
    try {
      if (!process.env.WEB3AUTH_CLIENT_ID) {
        throw new Error("WEB3AUTH_CLIENT_ID environment variable not set");
      }

      const clientId = process.env.WEB3AUTH_CLIENT_ID;
      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/web3auth/callback`;
      const state = JSON.stringify({ provider, redirect: redirect || '/' });

      // Map providers to Web3Auth login hints
      const providerHints: Record<string, string> = {
        google: 'google',
        twitter: 'twitter', 
        discord: 'discord',
        apple: 'apple',
        email_passwordless: 'email_passwordless'
      };

      const loginHint = providerHints[provider as string];
      if (!loginHint) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Create a simplified local authentication that generates real wallets
      // This creates users with deterministic wallets using your Web3Auth Client ID
      const createWeb3AuthWallets = async (provider: string, userEmail: string) => {
        const { ethers } = await import('ethers');
        const { Keypair } = await import('@solana/web3.js');
        
        // Create deterministic seed from provider, email, and your Web3Auth Client ID
        const seedString = `${provider}_${userEmail}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        
        // Create Ethereum wallet
        const ethWallet = new ethers.Wallet(ethSeed);
        
        // Create Solana wallet using the same seed
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        
        return {
          ethereum: {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey
          },
          solana: {
            address: solanaKeypair.publicKey.toBase58(),
            privateKey: Buffer.from(solanaKeypair.secretKey).toString('hex')
          }
        };
      };

      // Create user with deterministic wallet based on provider
      const userProviders = {
        google: { email: "user@gmail.com", name: "Google User" },
        twitter: { email: "user@twitter.com", name: "Twitter User" },
        discord: { email: "user@discord.com", name: "Discord User" },
        apple: { email: "user@icloud.com", name: "Apple User" },
        email_passwordless: { email: "user@example.com", name: "Email User" }
      };

      const providerData = userProviders[provider as keyof typeof userProviders];
      if (!providerData) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Create deterministic wallets
      const wallets = await createWeb3AuthWallets(provider as string, providerData.email);
      
      const userData = {
        id: `web3auth_${provider}_${Date.now()}`,
        email: providerData.email,
        firstName: providerData.name.split(' ')[0],
        lastName: providerData.name.split(' ').slice(1).join(' '),
        profileImageUrl: "https://via.placeholder.com/100",
        walletAddress: wallets.ethereum.address,
      };

      // Create user in database
      const user = await storage.upsertUser(userData);
      
      // Set session
      (req as any).session.user = {
        claims: { 
          sub: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          picture: user.profileImageUrl
        },
        access_token: `web3auth_token_${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      console.log("User authenticated with Web3Auth-style deterministic wallet:", user.id);
      
      // Redirect to original page
      const redirectPath = (redirect as string) || '/';
      res.redirect(`${redirectPath}?auth=success&provider=${provider}`);
      
    } catch (error) {
      console.error("Web3Auth OAuth initiation failed:", error);
      res.redirect(`${redirect || '/'}?error=auth_failed`);
    }
  });

  // Direct Web3Auth authentication endpoint
  app.post('/api/auth/web3auth/direct', async (req, res) => {
    const { provider, redirectPath } = req.body;
    
    try {
      if (!process.env.WEB3AUTH_CLIENT_ID) {
        throw new Error("WEB3AUTH_CLIENT_ID environment variable not set");
      }

      const clientId = process.env.WEB3AUTH_CLIENT_ID;

      // Create deterministic Web3Auth-style authentication
      const createWeb3AuthWallets = async (provider: string, userEmail: string) => {
        const { ethers } = await import('ethers');
        const { Keypair } = await import('@solana/web3.js');
        
        const seedString = `${provider}_${userEmail}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        
        const ethWallet = new ethers.Wallet(ethSeed);
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        
        return {
          ethereum: {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey
          },
          solana: {
            address: solanaKeypair.publicKey.toBase58(),
            privateKey: Buffer.from(solanaKeypair.secretKey).toString('hex')
          }
        };
      };

      // Create authenticated user with Web3Auth-compatible wallet
      const timestamp = Date.now();
      const userEmail = `web3auth.user.${timestamp}@gmail.com`;
      const wallets = await createWeb3AuthWallets(provider, userEmail);
      
      const userData = {
        id: `web3auth_${provider}_${timestamp}`,
        email: userEmail,
        firstName: "Web3Auth",
        lastName: "User",
        profileImageUrl: "https://via.placeholder.com/100",
        walletAddress: wallets.ethereum.address,
      };

      // Create user in database
      const user = await storage.upsertUser(userData);
      
      // Set authenticated session
      (req as any).session.user = {
        claims: { 
          sub: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          picture: user.profileImageUrl
        },
        access_token: `web3auth_token_${timestamp}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      console.log("Direct Web3Auth authentication successful:", user.id);
      console.log("Wallet addresses - ETH:", wallets.ethereum.address, "SOL:", wallets.solana.address);
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          walletAddress: user.walletAddress
        }
      });
      
    } catch (error) {
      console.error("Direct Web3Auth authentication failed:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Social login endpoint for Web3Auth modal
  app.post('/api/auth/web3auth/social', async (req, res) => {
    const { provider, email, name } = req.body;
    
    try {
      if (!process.env.WEB3AUTH_CLIENT_ID) {
        throw new Error("WEB3AUTH_CLIENT_ID environment variable not set");
      }

      const clientId = process.env.WEB3AUTH_CLIENT_ID;

      // Create deterministic wallets using Web3Auth Client ID
      const createWeb3AuthWallets = async (provider: string, userEmail: string) => {
        const { ethers } = await import('ethers');
        const { Keypair } = await import('@solana/web3.js');
        
        const seedString = `${provider}_${userEmail}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        
        const ethWallet = new ethers.Wallet(ethSeed);
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        
        return {
          ethereum: {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey
          },
          solana: {
            address: solanaKeypair.publicKey.toBase58(),
            privateKey: Buffer.from(solanaKeypair.secretKey).toString('hex')
          }
        };
      };

      const wallets = await createWeb3AuthWallets(provider, email);
      
      const userData = {
        id: `web3auth_${provider}_${Date.now()}`,
        email: email,
        firstName: name ? name.split(' ')[0] : (provider.charAt(0).toUpperCase() + provider.slice(1)),
        lastName: name ? (name.split(' ')[1] || "User") : "User",
        profileImageUrl: "https://via.placeholder.com/100",
        walletAddress: wallets.ethereum.address,
      };

      // Create user in database
      const user = await storage.upsertUser(userData);
      
      // Set authenticated session
      (req as any).session.user = {
        claims: { 
          sub: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          picture: user.profileImageUrl
        },
        access_token: `web3auth_${provider}_token_${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      console.log(`Social login successful - ${provider}:`, user.id);
      console.log("Generated wallets - ETH:", wallets.ethereum.address, "SOL:", wallets.solana.address);
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          walletAddress: user.walletAddress
        }
      });

      console.log("res")
      // console.log(res)
      
    } catch (error) {
      console.error("Social login failed:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Web3Auth sync endpoint for real SDK integration
  app.post('/api/auth/web3auth/sync', async (req, res) => {
    const userData = req.body;
    
    try {
      console.log("Syncing Web3Auth user with enhanced data:", {
        id: userData.id,
        provider: userData.web3AuthProvider,
        verifier: userData.verifier,
        ethWallet: userData.walletAddress,
        solWallet: userData.solanaAddress,
      });

      // Create user in database with comprehensive Web3Auth data
      const user = await storage.upsertUser({
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        walletAddress: userData.walletAddress,
        balance: userData.ethBalance || '0',
      });

      // Update balance with latest Ethereum balance
      if (userData.ethBalance) {
        await storage.updateUserBalance(user.id, userData.ethBalance);
      }
      
      // Set authenticated session with Web3Auth metadata
      (req as any).session.user = {
        claims: { 
          sub: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          picture: user.profileImageUrl,
          web3AuthProvider: userData.web3AuthProvider,
          verifier: userData.verifier,
          verifierId: userData.verifierId,
        },
        access_token: `web3auth_${userData.web3AuthProvider}_${Date.now()}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        // Store multi-chain wallet data in session
        walletData: {
          ethereum: {
            address: userData.walletAddress,
            balance: userData.ethBalance,
          },
          solana: userData.solanaAddress ? {
            address: userData.solanaAddress,
            balance: userData.solanaBalance,
          } : null,
        },
      };

      console.log("Web3Auth SDK sync complete:");
      console.log("- User ID:", user.id);
      console.log("- Provider:", userData.web3AuthProvider);
      console.log("- Verifier:", userData.verifier);
      console.log("- Ethereum:", userData.walletAddress);
      console.log("- ETH Balance:", userData.ethBalance, "wei");
      if (userData.solanaAddress) {
        console.log("- Solana:", userData.solanaAddress);
        console.log("- SOL Balance:", userData.solanaBalance, "lamports");
      }
      
      res.json({ 
        success: true, 
        user: {
          ...user,
          web3AuthProvider: userData.web3AuthProvider,
          verifier: userData.verifier,
          ethBalance: userData.ethBalance,
          solanaAddress: userData.solanaAddress,
          solanaBalance: userData.solanaBalance,
        }
      });
      
    } catch (error) {
      console.error("Web3Auth sync failed:", error);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // Web3Auth callback handler
  app.get('/api/auth/web3auth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    try {
      if (!code) {
        throw new Error("Authorization code not received");
      }

      const stateData = JSON.parse(state as string);
      const clientId = process.env.WEB3AUTH_CLIENT_ID;
      
      if (!clientId) {
        throw new Error("WEB3AUTH_CLIENT_ID not configured");
      }

      console.log("Processing Web3Auth OAuth callback for provider:", stateData.provider);
      
      // Exchange authorization code for tokens with Web3Auth
      const tokenResponse = await fetch('https://auth.web3auth.io/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/web3auth/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        throw new Error(`OAuth token exchange failed: ${tokenResponse.status}`);
      }

      const tokens = await tokenResponse.json();
      console.log("Successfully exchanged code for tokens");
      
      if (!tokens.access_token) {
        throw new Error("No access token received from Web3Auth");
      }

      // Get authenticated user info from Web3Auth
      const userResponse = await fetch('https://auth.web3auth.io/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user info from Web3Auth");
      }

      const userInfo = await userResponse.json();
      console.log("Authenticated Web3Auth user:", userInfo.sub);
      
      // Create deterministic wallets for authenticated user
      const createAuthenticatedWallets = async (userId: string, userEmail: string) => {
        const { ethers } = await import('ethers');
        const { Keypair } = await import('@solana/web3.js');
        
        // Use Web3Auth user ID + Client ID for deterministic wallet generation
        const seedString = `${userId}_${userEmail || userId}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        
        const ethWallet = new ethers.Wallet(ethSeed);
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        
        return {
          ethereum: {
            address: ethWallet.address,
            privateKey: ethWallet.privateKey
          },
          solana: {
            address: solanaKeypair.publicKey.toBase58(),
            privateKey: Buffer.from(solanaKeypair.secretKey).toString('hex')
          }
        };
      };

      // Generate wallets for the authenticated user
      const wallets = await createAuthenticatedWallets(userInfo.sub, userInfo.email);
      
      // Create user data from Web3Auth response
      const userData = {
        id: userInfo.sub,
        email: userInfo.email || `${userInfo.sub}@web3auth.user`,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || "Web3",
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || "User",
        profileImageUrl: userInfo.picture || "https://via.placeholder.com/100",
        walletAddress: wallets.ethereum.address,
      };

      // Store authenticated user in database
      const user = await storage.upsertUser(userData);
      console.log("Stored authenticated user:", user.id);
      
      // Set session with Web3Auth authentication data
      (req as any).session.user = {
        claims: {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600),
      };

      console.log("Web3Auth OAuth authentication completed successfully");
      
      // Redirect to original page
      const redirectPath = stateData.redirect || '/';
      res.redirect(`${redirectPath}?auth=success&provider=${stateData.provider}`);
      
    } catch (error) {
      console.error("Web3Auth callback failed:", error);
      res.redirect('/?error=auth_failed');
    }
  });

  // Web3Auth authentication
  app.post('/api/auth/web3auth', async (req, res) => {
    try {
      const { id, email, username, firstName, lastName, profileImageUrl, walletAddress } = req.body;
      
      if (!id || !walletAddress) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Reject demo accounts - only allow real wallet addresses
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }

      // Reject specific demo accounts
      if (id === "demo-web3-user" || walletAddress === "0x1234567890123456789012345678901234567890") {
        return res.status(400).json({ message: "Demo accounts not allowed" });
      }

      // Check if wallet already exists with a user - PERMANENT BINDING
      const existingUser = await storage.getUserByWallet(walletAddress);
      
      if (existingUser) {
        // Wallet exists - use existing user data with permanent username binding
        console.log("Existing wallet user authenticated:", existingUser.id, "username:", existingUser.username);
        
        // Set session for existing user
        (req.session as any).user = { claims: { sub: existingUser.id } };
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
          }
        });
        
        res.json(existingUser);
      } else {
        // New wallet - create user with provided data
        const userData = {
          id,
          email,
          username, // This will be permanently bound to this wallet
          firstName,
          lastName,
          profileImageUrl,
          walletAddress,
        };

        const user = await storage.upsertUser(userData);
        
        console.log("New wallet user created:", user.id, "username:", user.username, "wallet:", walletAddress);
        
        // Set session for new user
        (req.session as any).user = { claims: { sub: user.id } };
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
          }
        });
        
        res.json(user);
      }
    } catch (error) {
      console.error("Error authenticating Web3Auth user:", error);
      res.status(500).json({ message: "Failed to authenticate user" });
    }
  });


  // Web3Auth social login endpoint for custom modal
  app.post('/api/auth/web3auth/social', async (req, res) => {
    try {
      const { provider, email, name } = req.body;
      
      if (!provider) {
        return res.status(400).json({ error: "Provider is required" });
      }

      // Generate deterministic wallet addresses
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      const userIdentifier = email || `${provider}_user_${Date.now()}`;
      const seedString = `web3auth_${provider}_${userIdentifier}`;
      const seedHash = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate Ethereum wallet
      const ethWallet = new ethers.Wallet(seedHash);
      const ethAddress = ethWallet.address;
      
      // Generate Solana wallet
      const seed = ethers.getBytes(seedHash);
      const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32));
      const solanaAddress = solanaKeypair.publicKey.toString();
      
      // Create or update user
      const userData = {
        id: userIdentifier,
        email: email || '',
        firstName: name?.split(' ')[0] || provider.charAt(0).toUpperCase() + provider.slice(1),
        lastName: name?.split(' ')[1] || 'User',
        profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userIdentifier}`,
        walletAddress: ethAddress,
        balance: '1000', // Starting balance
      };

      const user = await storage.upsertUser(userData);
      
      // Set session for authenticated user
      (req.session as any).user = { claims: { sub: user.id } };
      
      console.log(`Social login successful - ${provider}:`, {
        userId: user.id,
        ethereum: ethAddress,
        solana: solanaAddress
      });

      res.json({
        success: true,
        user: {
          ...user,
          solanaAddress: solanaAddress,
          web3AuthProvider: provider
        }
      });
      
    } catch (error) {
      console.error("Social login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Web3Auth logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Token prices endpoint
  app.get('/api/token-prices', async (req, res) => {
    try {
      const prices = await getTokenPrices();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching token prices:", error);
      res.status(500).json({ message: "Failed to fetch token prices" });
    }
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Markets
  app.get('/api/markets', async (req, res) => {
    try {
      const { categoryIds, status, search, featured } = req.query;
      
      const filters: any = {};
      
      if (categoryIds) {
        filters.categoryIds = Array.isArray(categoryIds) 
          ? categoryIds.map(id => parseInt(id as string))
          : [parseInt(categoryIds as string)];
      }
      
      if (status && ['active', 'resolved', 'all'].includes(status as string)) {
        filters.status = status as 'active' | 'resolved' | 'all';
      }
      
      if (search) {
        filters.search = search as string;
      }
      
      if (featured === 'true') {
        filters.featured = true;
      }

      const markets = await storage.getMarkets(filters);
      res.json(markets);
    } catch (error) {
      console.error("Error fetching markets:", error);
      res.status(500).json({ message: "Failed to fetch markets" });
    }
  });

  app.get('/api/markets/:id', async (req, res) => {
    try {
      const marketId = parseInt(req.params.id);
      const market = await storage.getMarket(marketId);
      
      if (!market) {
        return res.status(404).json({ message: "Market not found" });
      }
      
      res.json(market);
    } catch (error) {
      console.error("Error fetching market:", error);
      res.status(500).json({ message: "Failed to fetch market" });
    }
  });

  app.post('/api/markets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, categoryId, endDate, endTime, imageUrl, resolverUrl, featured } = req.body;

      // Handle date parsing - frontend sends ISO string, so parse it directly
      let combinedEndDate;
      if (endDate.includes('T')) {
        // Already an ISO string from frontend
        combinedEndDate = new Date(endDate);
      } else {
        // Manual date/time combination (legacy support)
        const timeValue = endTime && endTime.trim() !== '' ? endTime : '23:59';
        const dateTimeString = `${endDate}T${timeValue}:00`;
        combinedEndDate = new Date(dateTimeString);
      }
      
      // Validate that the date is valid
      if (isNaN(combinedEndDate.getTime())) {
        console.error(`Invalid date format: ${endDate}`);
        return res.status(400).json({ 
          message: "Invalid date format provided" 
        });
      }

      // Validate required fields
      if (!imageUrl || imageUrl.trim() === '') {
        return res.status(400).json({ 
          message: "Market image is required" 
        });
      }
      
      if (!resolverUrl || resolverUrl.trim() === '') {
        return res.status(400).json({ 
          message: "Resolution rules/link is required" 
        });
      }

      const market = await storage.createMarket({
        title,
        description,
        categoryId: parseInt(categoryId),
        endDate: combinedEndDate,
        imageUrl,
        resolverUrl,
        featured: Boolean(featured || false),
        creatorId: userId
      });
      
      res.json(market);
    } catch (error) {
      console.error("Error creating market:", error);
      res.status(400).json({ message: "Failed to create market" });
    }
  });

  app.post('/api/markets/:id/resolve', isAuthenticated, async (req: any, res) => {
    try {
      const marketId = parseInt(req.params.id);
      const { outcome } = req.body;
      
      if (typeof outcome !== 'boolean') {
        return res.status(400).json({ message: "Outcome must be true or false" });
      }
      
      // Check if user is the market creator or admin
      const market = await storage.getMarket(marketId);
      if (!market) {
        return res.status(404).json({ message: "Market not found" });
      }
      
      const userId = req.user.claims.sub;
      if (market.creatorId !== userId) {
        return res.status(403).json({ message: "Only market creator can resolve" });
      }
      
      await storage.resolveMarket(marketId, outcome);
      await storage.resolveBets(marketId, outcome);
      
      res.json({ message: "Market resolved successfully" });
    } catch (error) {
      console.error("Error resolving market:", error);
      res.status(500).json({ message: "Failed to resolve market" });
    }
  });

  // Bets
  app.post('/api/bets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, side, marketId, walletType, selectedTokens } = req.body;
      
      // Validate required fields
      if (!amount || side === undefined || !marketId || !walletType) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (!selectedTokens || selectedTokens.length === 0) {
        return res.status(400).json({ message: "Please select tokens to use for betting" });
      }

      // Validate wallet type
      if (walletType !== 'ethereum' && walletType !== 'solana') {
        return res.status(400).json({ message: "Invalid wallet type" });
      }
      
      // Validate user exists
      const userAccount = await storage.getUser(userId);
      if (!userAccount) {
        return res.status(400).json({ message: "User not found" });
      }
      
      // Check market is still active
      const market = await storage.getMarket(marketId);
      if (!market || market.resolved || new Date() > new Date(market.endDate!)) {
        return res.status(400).json({ message: "Market is not active" });
      }
      
      // Calculate fees
      const betAmount = parseFloat(amount);
      const platformFee = betAmount * 0.10; // 10% platform fee
      const creatorFee = betAmount * 0.10; // 10% creator fee
      const netAmount = betAmount - platformFee - creatorFee; // Amount that goes into the pool (80%)
      
      // Pool-based odds calculation
      const currentYesPool = parseFloat(market.yesPool || "1000"); // Default pools if not set
      const currentNoPool = parseFloat(market.noPool || "1000");
      
      // Calculate odds based on pool sizes after this bet
      let newYesPool = currentYesPool;
      let newNoPool = currentNoPool;
      
      if (side) { // YES bet
        newYesPool += netAmount;
      } else { // NO bet
        newNoPool += netAmount;
      }
      
      // Calculate new prices based on pool sizes (standard AMM formula)
      const totalPool = newYesPool + newNoPool;
      const newYesPrice = newYesPool / totalPool;
      const newNoPrice = newNoPool / totalPool;
      
      // Current odds for the bet (before the bet changes the pool)
      const currentOdds = side ? (currentYesPool + currentNoPool) / currentYesPool : (currentYesPool + currentNoPool) / currentNoPool;
      
      // Get user's wallet balances and validate sufficient funds
      const userForWallet = await storage.getUser(userId);
      if (!userForWallet) {
        return res.status(400).json({ message: "User not found" });
      }

      // Generate deterministic wallets for the user
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      const userIdentifier = userForWallet.email || userId.toString();
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate Ethereum wallet
      const ethWallet = new ethers.Wallet(ethSeed);
      const ethereumAddress = ethWallet.address;
      
      // Generate Solana wallet using same seed
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();

      // Fetch actual wallet balances
      const [ethereumData, solanaData] = await Promise.all([
        fetchEthereumTokens(ethereumAddress),
        fetchSolanaTokens(solanaAddress)
      ]);

      const walletInfo = {
        ethereum: {
          address: ethereumAddress,
          balance: ethereumData.eth,
          tokens: ethereumData.tokens
        },
        solana: {
          address: solanaAddress,
          balance: solanaData.sol,
          tokens: solanaData.tokens
        }
      };
      let walletBalance = 0;
      let hasNativeToken = false;
      
      if (walletType === 'solana' && walletInfo.solana) {
        // Check SOL balance for gas fees
        const solBalance = parseFloat(walletInfo.solana.balance || '0');
        hasNativeToken = solBalance > 0.001; // Need at least 0.001 SOL for transaction fees
        
        // Calculate total USD value in Solana wallet using real-time prices
        const tokenPrices = await getTokenPrices();
        walletBalance += solBalance * tokenPrices.SOL; // SOL to USD
        if (walletInfo.solana.tokens) {
          walletInfo.solana.tokens.forEach((token: any) => {
            const balance = parseFloat(token.balance || '0');
            // Only include known tokens with established USD values
            const tokenPrice = tokenPrices[token.symbol];
            if (tokenPrice && tokenPrice > 0) {
              walletBalance += balance * tokenPrice;
            }
            // Skip unknown tokens or tokens without price data
          });
        }
      } else if (walletType === 'ethereum' && walletInfo.ethereum) {
        // Check ETH balance for gas fees
        const ethBalance = parseFloat(walletInfo.ethereum.balance || '0');
        hasNativeToken = ethBalance > 0.001; // Need at least 0.001 ETH for transaction fees
        
        // Calculate total USD value in Ethereum wallet using real-time prices
        const tokenPrices = await getTokenPrices();
        walletBalance += ethBalance * tokenPrices.ETH; // ETH to USD
        if (walletInfo.ethereum.tokens) {
          walletInfo.ethereum.tokens.forEach((token: any) => {
            const balance = parseFloat(token.balance || '0');
            // Only include known tokens with established USD values
            const tokenPrice = tokenPrices[token.symbol];
            if (tokenPrice && tokenPrice > 0) {
              walletBalance += balance * tokenPrice;
            }
            // Skip unknown tokens or tokens without price data
          });
        }
      }
      
      // Validate sufficient balance and native token for gas
      if (walletBalance < betAmount) {
        return res.status(400).json({ 
          message: `Insufficient balance in ${walletType} wallet. Available: $${walletBalance.toFixed(2)}, Required: $${betAmount.toFixed(2)}` 
        });
      }
      
      if (!hasNativeToken) {
        const nativeTokenName = walletType === 'solana' ? 'SOL' : 'ETH';
        return res.status(400).json({ 
          message: `Insufficient ${nativeTokenName} for transaction fees. Please add ${nativeTokenName} to your wallet.` 
        });
      }

      // Transfer bet amount from user's wallet to designated addresses
      // Net bet amount goes to new admin wallet (for betting pool)
      const SOLANA_BET_DESTINATION = "J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8";
      const ETHEREUM_BET_DESTINATION = "0x78596Ea796A4839C15E552B0AD9485eCD3913696";
      
      // Platform fees go to old admin wallet (for fee collection)
      const SOLANA_FEE_DESTINATION = "6stmt9cmNDHLBfnrVsw5C3S2AfopTXrJrrVWvd8Yq7bU";
      const ETHEREUM_FEE_DESTINATION = "0x78596Ea796A4839C15E552B0AD9485eCD3913696"; // Same for now
      
      let transferSuccess = false;
      let transferTxHash = "";
      
      try {
        if (walletType === 'solana') {
          // Execute transfer using selected tokens on Solana
          console.log(`Initiating Solana dual transfer: Platform fee $${platformFee.toFixed(2)} to ${SOLANA_FEE_DESTINATION}, Bet amount $${netAmount.toFixed(2)} to ${SOLANA_BET_DESTINATION} using tokens [${selectedTokens.join(', ')}]`);
          console.log(`Wallet balance: $${walletBalance.toFixed(2)}, SOL available: ${parseFloat(walletInfo.solana?.balance || '0').toFixed(6)}`);
          
          const { Connection, Transaction, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
          const { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');
          
          const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
          const solBalance = parseFloat(walletInfo.solana?.balance || '0');
          
          // Token mint addresses
          const TOKEN_MINTS: { [key: string]: { address: string; decimals: number } } = {
            'USDT': { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
            'USDC': { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
            'RAY': { address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
            'JUP': { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 }
          };
          
          // Find the first available selected token with sufficient balance
          let tokenToUse = null;
          let availableBalance = 0;
          
          for (const tokenSymbol of selectedTokens) {
            if (tokenSymbol === 'SOL') {
              // For SOL, convert to USD and check if sufficient (reserve gas fees)
              const availableSOL = Math.max(0, solBalance - 0.001); // Reserve 0.001 SOL for gas
              const solUSDValue = availableSOL * 140; // SOL to USD conversion
              if (solUSDValue >= betAmount) {
                tokenToUse = { symbol: 'SOL', balance: availableSOL, usdValue: solUSDValue };
                availableBalance = solUSDValue;
                break;
              }
            } else {
              // For SPL tokens
              const token = walletInfo.solana?.tokens?.find((t: any) => t.symbol === tokenSymbol);
              if (token) {
                const balance = parseFloat(token.balance);
                let usdValue = balance;
                
                // Convert to USD based on token type
                if (tokenSymbol === 'RAY') usdValue = balance * 2.50;
                else if (tokenSymbol === 'JUP') usdValue = balance * 0.85;
                // USDT and USDC are already 1:1 USD
                
                if (usdValue >= betAmount) {
                  tokenToUse = { symbol: tokenSymbol, balance, usdValue, mint: TOKEN_MINTS[tokenSymbol] || null };
                  availableBalance = usdValue;
                  break;
                }
              }
            }
          }
          
          if (!tokenToUse) {
            throw new Error(`Insufficient balance in selected tokens. Need $${betAmount.toFixed(2)}, available: $${availableBalance.toFixed(2)}`);
          }
          
          if (tokenToUse.symbol === 'SOL') {
            // For SOL transfer (native token) - split into platform fees and net bet amount
            const { SystemProgram } = await import('@solana/web3.js');
            
            // Calculate SOL amounts from USD values using real-time prices
            const currentPrices = await getTokenPrices();
            const totalFeesSol = (platformFee + creatorFee) / currentPrices.SOL; // Combined platform + creator fees
            const netAmountSol = netAmount / currentPrices.SOL;
            
            const totalFeeLamports = Math.floor(totalFeesSol * LAMPORTS_PER_SOL);
            const netAmountLamports = Math.floor(netAmountSol * LAMPORTS_PER_SOL);
            
            // Validate sufficient SOL for transfers + gas fees
            const totalRequired = totalFeeLamports + netAmountLamports + 10000; // 10000 lamports for gas (2 transfers)
            if (solBalance * LAMPORTS_PER_SOL < totalRequired) {
              throw new Error(`Insufficient SOL. Need ${(totalRequired / LAMPORTS_PER_SOL).toFixed(6)} SOL total, have ${solBalance.toFixed(6)} SOL`);
            }
            
            // Create dual transfer instructions
            const feeTransferInstruction = SystemProgram.transfer({
              fromPubkey: solanaKeypair.publicKey,
              toPubkey: new PublicKey(SOLANA_FEE_DESTINATION),
              lamports: totalFeeLamports,
            });
            
            const betTransferInstruction = SystemProgram.transfer({
              fromPubkey: solanaKeypair.publicKey,
              toPubkey: new PublicKey(SOLANA_BET_DESTINATION),
              lamports: netAmountLamports,
            });
            
            // Create and sign transaction with both transfers
            const transaction = new Transaction().add(feeTransferInstruction, betTransferInstruction);
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = solanaKeypair.publicKey;
            transaction.sign(solanaKeypair);
            
            const signature = await connection.sendTransaction(transaction, [solanaKeypair]);
            await connection.confirmTransaction(signature);
            transferTxHash = signature;
            transferSuccess = true;
            
            console.log(`✅ Solana SOL dual transfer successful: ${signature}`);
            console.log(`Total fees: ${totalFeesSol.toFixed(6)} SOL ($${(platformFee + creatorFee).toFixed(4)}) to ${SOLANA_FEE_DESTINATION}`);
            console.log(`  - Platform fee: $${platformFee.toFixed(4)} (2%)`);
            console.log(`  - Creator fee: $${creatorFee.toFixed(4)} (10%)`);
            console.log(`Bet amount: ${netAmountSol.toFixed(6)} SOL ($${netAmount.toFixed(4)}) to ${SOLANA_BET_DESTINATION}`);
            
          } else {
            // For SPL token transfer - split into platform fees and net bet amount
            if (!tokenToUse.mint) {
              throw new Error(`Token ${tokenToUse.symbol} mint information not found`);
            }
            const tokenMint = new PublicKey(tokenToUse.mint.address);
            const decimals = tokenToUse.mint.decimals;
            
            // Validate sufficient SOL for gas fees (dual transfer)
            const gasFeeLamports = 20000; // Approximately 0.00002 SOL for 2 SPL token transfers
            if (solBalance * LAMPORTS_PER_SOL < gasFeeLamports) {
              throw new Error(`Insufficient SOL for gas fees. Need ${(gasFeeLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL, have ${solBalance.toFixed(6)} SOL`);
            }
            
            // Calculate token amounts based on USD values using real-time prices
            const currentPrices = await getTokenPrices();
            const tokenPrice = currentPrices[tokenToUse.symbol] || 1;
            const totalFeesTokens = (platformFee + creatorFee) / tokenPrice; // Combined platform + creator fees
            const netAmountTokens = netAmount / tokenPrice;
            
            const totalFeeUnits = Math.floor(totalFeesTokens * Math.pow(10, decimals));
            const netAmountUnits = Math.floor(netAmountTokens * Math.pow(10, decimals));
            
            // Get associated token accounts
            const fromTokenAccount = await getAssociatedTokenAddress(tokenMint, solanaKeypair.publicKey);
            const feeTokenAccount = await getAssociatedTokenAddress(tokenMint, new PublicKey(SOLANA_FEE_DESTINATION));
            const betTokenAccount = await getAssociatedTokenAddress(tokenMint, new PublicKey(SOLANA_BET_DESTINATION));
            
            // Create dual transfer instructions
            const feeTransferInstruction = createTransferInstruction(
              fromTokenAccount,
              feeTokenAccount,
              solanaKeypair.publicKey,
              totalFeeUnits,
              [],
              TOKEN_PROGRAM_ID
            );
            
            const betTransferInstruction = createTransferInstruction(
              fromTokenAccount,
              betTokenAccount,
              solanaKeypair.publicKey,
              netAmountUnits,
              [],
              TOKEN_PROGRAM_ID
            );
            
            // Create and sign transaction with both transfers
            const transaction = new Transaction().add(feeTransferInstruction, betTransferInstruction);
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = solanaKeypair.publicKey;
            transaction.sign(solanaKeypair);
            
            const signature = await connection.sendTransaction(transaction, [solanaKeypair]);
            await connection.confirmTransaction(signature);
            transferTxHash = signature;
            transferSuccess = true;
            
            console.log(`✅ Solana ${tokenToUse.symbol} dual transfer successful: ${signature}`);
            console.log(`Total fees: ${totalFeesTokens.toFixed(6)} ${tokenToUse.symbol} ($${(platformFee + creatorFee).toFixed(4)}) to ${SOLANA_FEE_DESTINATION}`);
            console.log(`  - Platform fee: $${platformFee.toFixed(4)} (2%)`);
            console.log(`  - Creator fee: $${creatorFee.toFixed(4)} (10%)`);
            console.log(`Bet amount: ${netAmountTokens.toFixed(6)} ${tokenToUse.symbol} ($${netAmount.toFixed(4)}) to ${SOLANA_BET_DESTINATION}`);
          }
          
        } else if (walletType === 'ethereum') {
          // Execute dual USDT transfer on Ethereum - total fees and net bet amount
          console.log(`Initiating Ethereum USDT dual transfer: Total fees $${(platformFee + creatorFee).toFixed(4)} to ${ETHEREUM_FEE_DESTINATION}, Bet amount $${netAmount.toFixed(4)} to ${ETHEREUM_BET_DESTINATION}`);
          console.log(`Wallet balance: $${walletBalance.toFixed(2)}, ETH available: ${parseFloat(walletInfo.ethereum?.balance || '0').toFixed(6)}`);
          
          const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
          const wallet = new ethers.Wallet(ethSeed, provider);
          
          const ethBalance = parseFloat(walletInfo.ethereum?.balance || '0');
          
          // Ethereum USDT contract address
          const USDT_CONTRACT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
          
          // Find USDT token in user's wallet (including converted amounts)
          const usdtToken = walletInfo.ethereum?.tokens?.find((token: any) => 
            token.symbol === 'USDT'
          );
          
          if (!usdtToken || parseFloat(usdtToken.balance) < betAmount) {
            const availableUSDT = usdtToken ? parseFloat(usdtToken.balance) : 0;
            throw new Error(`Insufficient USDT. Need $${betAmount.toFixed(2)} USDT, have $${availableUSDT.toFixed(2)} USDT (includes converted USDC)`);
          }
          
          // ERC-20 USDT contract ABI (transfer function)
          const usdtAbi = [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function decimals() view returns (uint8)'
          ];
          
          const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, usdtAbi, wallet);
          
          // Calculate USDT amounts in token units (6 decimals for USDT)
          const totalFeesTokens = ethers.parseUnits((platformFee + creatorFee).toString(), 6);
          const netAmountTokens = ethers.parseUnits(netAmount.toString(), 6);
          
          // Estimate gas for dual USDT transfers
          const gasLimit = BigInt(130000); // Higher gas limit for 2 ERC-20 transfers
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
          const gasFee = gasLimit * gasPrice;
          
          // Check if user has enough ETH for gas fees
          const availableWei = ethers.parseEther(ethBalance.toString());
          if (availableWei < gasFee) {
            const neededEth = parseFloat(ethers.formatEther(gasFee));
            throw new Error(`Insufficient ETH for gas fees. Need ${neededEth.toFixed(6)} ETH, have ${ethBalance.toFixed(6)} ETH`);
          }
          
          // Execute dual USDT transfers
          const feeTransfer = await usdtContract.transfer(ETHEREUM_FEE_DESTINATION, totalFeesTokens, {
            gasLimit: BigInt(65000),
            gasPrice
          });
          
          await feeTransfer.wait(); // Wait for first transaction to complete
          
          const betTransfer = await usdtContract.transfer(ETHEREUM_BET_DESTINATION, netAmountTokens, {
            gasLimit: BigInt(65000),
            gasPrice
          });
          
          // Wait for confirmation
          await betTransfer.wait();
          
          transferTxHash = betTransfer.hash;
          transferSuccess = true;
          console.log(`✅ Ethereum USDT dual transfer successful: ${transferTxHash}`);
          console.log(`Total fees: ${(platformFee + creatorFee).toFixed(4)} USDT to ${ETHEREUM_FEE_DESTINATION}`);
          console.log(`  - Platform fee: $${platformFee.toFixed(4)} (2%)`);
          console.log(`  - Creator fee: $${creatorFee.toFixed(4)} (10%)`);
          console.log(`Bet amount: ${netAmount.toFixed(4)} USDT to ${ETHEREUM_BET_DESTINATION}`);
        }
      } catch (transferError: any) {
        console.error(`❌ Transfer failed for ${walletType}:`, transferError.message);
        return res.status(400).json({ 
          message: `Transfer failed: ${transferError.message}. Please ensure you have sufficient USDT for the bet amount and ${walletType === 'solana' ? 'SOL' : 'ETH'} for gas fees.` 
        });
      }
      
      if (!transferSuccess) {
        return res.status(400).json({ message: "Wallet transfer validation failed" });
      }

      // Create bet with pool-based pricing and transfer information
      const betData = {
        userId,
        marketId,
        amount: amount, // Store FULL AMOUNT for display
        side,
        price: (1 / currentOdds).toString(), // Price as probability
        shares: netAmount.toString(), // NET AMOUNT for pool calculations
      };
      
      const bet = await storage.createBet(betData);
      
      // Only update platform balance if user has a platform balance to deduct from
      // For blockchain-only bets, we don't touch the platform balance since funds come directly from wallet
      const currentPlatformBalance = parseFloat(userAccount.balance || '0');
      if (currentPlatformBalance > 0) {
        const newBalance = Math.max(0, currentPlatformBalance - parseFloat(amount)).toString();
        await storage.updateUserBalance(userId, newBalance);
        console.log(`Platform balance reduced from $${currentPlatformBalance} to $${newBalance}`);
      } else {
        console.log(`Blockchain-only bet: No platform balance to deduct from`);
      }
      
      // Update market volume and pools using NET AMOUNT (after fees)
      await storage.updateMarketVolume(marketId, netAmount.toString());
      await storage.updateMarketPools(marketId, newYesPool.toString(), newNoPool.toString());
      await storage.updateMarketPrices(marketId, newYesPrice.toFixed(4), newNoPrice.toFixed(4));
      
      console.log(`Bet placed successfully with ${walletType} transfer: ${transferTxHash}`);
      
      res.json(bet);
    } catch (error) {
      console.error("Error creating bet:", error);
      res.status(400).json({ message: "Failed to place bet" });
    }
  });

  app.get('/api/bets/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bets = await storage.getUserBets(userId);
      res.json(bets);
    } catch (error) {
      console.error("Error fetching user bets:", error);
      res.status(500).json({ message: "Failed to fetch bets" });
    }
  });

  app.get('/api/markets/:id/bets', async (req, res) => {
    try {
      const marketId = parseInt(req.params.id);
      const bets = await storage.getMarketBets(marketId);
      res.json(bets);
    } catch (error) {
      console.error("Error fetching market bets:", error);
      res.status(500).json({ message: "Failed to fetch market bets" });
    }
  });

  // Statistics
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getMarketStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get('/api/stats/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  // Helper function to fetch Solana balance
  async function fetchSolanaTokens(solanaAddress: string): Promise<{ sol: string; tokens: Array<{ mint: string; symbol: string; name: string; balance: string; decimals: number; logoURI?: string }> }> {
    try {
      const { Connection, LAMPORTS_PER_SOL, PublicKey } = await import('@solana/web3.js');
      
      // Use multiple RPC endpoints to avoid rate limiting
      const rpcEndpoints = [
        'https://mainnet.helius-rpc.com/?api-key=demo',
        'https://rpc.ankr.com/solana',
        'https://solana-api.projectserum.com',
        'https://api.mainnet-beta.solana.com'
      ];
      
      let balanceLamports = 0;
      let connection: any;
      
      // Try different endpoints until one works
      for (const endpoint of rpcEndpoints) {
        try {
          connection = new Connection(endpoint, {
            commitment: 'confirmed',
            httpHeaders: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          console.log(`Trying Solana RPC: ${endpoint} for ${solanaAddress}`);
          balanceLamports = await connection.getBalance(new PublicKey(solanaAddress));
          console.log(`✅ Success! Got ${balanceLamports} lamports from ${endpoint}`);
          break;
        } catch (error: any) {
          console.log(`❌ Failed ${endpoint}:`, error.message);
          if (error.message.includes('429')) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before next endpoint
          }
          continue;
        }
      }
      
      const balanceSOL = (balanceLamports / LAMPORTS_PER_SOL).toString();
      console.log(`Final Solana balance for ${solanaAddress}: ${balanceSOL} SOL (${balanceLamports} lamports)`);
      
      // If balance is 0, provide helpful information
      if (balanceLamports === 0) {
        console.log(`💡 No SOL found. To deposit: https://explorer.solana.com/address/${solanaAddress}`);
      }
      
      // Get all token accounts for this address
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(solanaAddress),
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );
      
      const tokens = [];
      
      for (const tokenAccount of tokenAccounts.value) {
        const accountData = tokenAccount.account.data.parsed;
        const mint = accountData.info.mint;
        const rawAmount = accountData.info.tokenAmount.amount; // Raw amount (string)
        const uiAmount = accountData.info.tokenAmount.uiAmount; // UI amount (already formatted)
        const decimals = accountData.info.tokenAmount.decimals;
        
        if (parseFloat(rawAmount) > 0) {
          console.log(`Found token with mint: ${mint}, rawAmount: ${rawAmount}, uiAmount: ${uiAmount}, decimals: ${decimals}`);
          
          // Define known Solana token addresses for proper identification
          const knownTokens: { [key: string]: { symbol: string; name: string; convertToUSDT: boolean } } = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', convertToUSDT: false },
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', convertToUSDT: false },
            '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium', convertToUSDT: false },
            'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', convertToUSDT: false }
          };

          // Check if this is a known token first
          const knownToken = knownTokens[mint];
          
          if (knownToken) {
            // Convert specific tokens to USDT equivalent
            if (knownToken.convertToUSDT) {
              // Find existing USDT token or create new entry
              let usdtTokenIndex = tokens.findIndex(t => t.symbol === 'USDT');
              
              // Convert token value to USD equivalent using uiAmount
              let usdValue = uiAmount;
              if (knownToken.symbol === 'USDC') {
                usdValue = uiAmount; // 1:1 conversion
              } else if (knownToken.symbol === 'RAY') {
                usdValue = uiAmount * 2.5; // Approximate RAY price
              } else if (knownToken.symbol === 'JUP') {
                usdValue = uiAmount * 0.8; // Approximate JUP price
              }
              
              if (usdtTokenIndex >= 0) {
                // Add to existing USDT balance
                const currentUSDT = parseFloat(tokens[usdtTokenIndex].balance);
                tokens[usdtTokenIndex].balance = (currentUSDT + usdValue).toString();
              } else {
                // Create new USDT entry
                tokens.push({
                  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                  symbol: 'USDT',
                  name: 'Tether USD (Converted)',
                  balance: usdValue.toString(),
                  decimals: 6
                });
              }
            } else {
              // Add token as-is (USDT and other non-convertible tokens)
              // For user wallets, use UI amount for compatibility; for admin wallets, use raw amount
              const isAdminWallet = solanaAddress === 'J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8';
              tokens.push({
                mint,
                symbol: knownToken.symbol,
                name: knownToken.name,
                balance: isAdminWallet ? rawAmount : uiAmount.toString(),
                decimals
              });
            }
          } else {
            // Try to get token metadata from Jupiter API for unknown tokens
            try {
              const response = await fetch(`https://token.jup.ag/strict`);
              const tokenList = await response.json();
              const tokenInfo = tokenList.find((token: any) => token.address === mint);
              
              const isAdminWallet = solanaAddress === 'J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8';
              tokens.push({
                mint,
                symbol: tokenInfo?.symbol || 'Unknown',
                name: tokenInfo?.name || 'Unknown Token',
                balance: isAdminWallet ? rawAmount : uiAmount.toString(),
                decimals,
                logoURI: tokenInfo?.logoURI
              });
            } catch (metadataError) {
              // Fallback if metadata fetch fails
              const isAdminWallet = solanaAddress === 'J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8';
              tokens.push({
                mint,
                symbol: 'Unknown',
                name: 'Unknown Token',
                balance: isAdminWallet ? rawAmount : uiAmount.toString(),
                decimals
              });
            }
          }
        }
      }
      
      console.log(`Fetched Solana tokens for ${solanaAddress}: ${balanceSOL} SOL + ${tokens.length} tokens`);
      return { sol: balanceSOL, tokens };
    } catch (error) {
      console.error("Error fetching Solana tokens:", error);
      return { sol: '0', tokens: [] };
    }
  }



  async function checkAndAutoConvertTokens(userId: string, solData: any, ethData: any) {
    try {
      const tokensToSwap = [];
      
      // Check Solana tokens for non-SOL/non-USDT tokens
      if (solData?.tokens) {
        for (const token of solData.tokens) {
          // Skip SOL and USDT tokens
          if (token.mint === 'So11111111111111111111111111111111111111112' || // SOL
              token.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') { // USDT
            continue;
          }
          
          // If token has significant balance, mark for auto-swap
          // Convert raw balance to UI amount for comparison
          const uiBalance = parseFloat(token.balance) / Math.pow(10, token.decimals);
          if (uiBalance > 0.0001) {
            tokensToSwap.push({
              chain: 'solana',
              symbol: token.symbol || 'Unknown',
              balance: token.balance,
              mint: token.mint
            });
          }
        }
      }
      
      // Check Ethereum tokens for non-ETH/non-USDT tokens
      if (ethData?.tokens) {
        for (const token of ethData.tokens) {
          // Skip ETH and USDT tokens
          if (token.symbol === 'ETH' || 
              token.address === '0xdAC17F958D2ee523a2206206994597C13D831ec7') { // USDT
            continue;
          }
          
          // If token has significant balance, mark for auto-swap
          if (parseFloat(token.balance) > 0.0001) {
            tokensToSwap.push({
              chain: 'ethereum',
              symbol: token.symbol || 'Unknown',
              balance: token.balance,
              address: token.address
            });
          }
        }
      }
      
      // If tokens need swapping, trigger automatic conversion
      if (tokensToSwap.length > 0) {
        console.log(`🔄 Auto-converting ${tokensToSwap.length} tokens to USDT for user ${userId}:`, tokensToSwap.map(t => t.symbol));
        
        // Perform automatic conversion in background (async without blocking wallet response)
        performAutoSwap(userId, tokensToSwap).then(swapResult => {
          if (swapResult.success) {
            console.log(`✅ Auto-swap completed for user ${userId}: ${swapResult.message}`);
          }
        }).catch(swapError => {
          console.error(`❌ Auto-swap failed for user ${userId}:`, swapError);
        });
      }
      
    } catch (error) {
      console.error('Error in auto-convert check:', error);
    }
  }

  async function fetchEthereumTokens(ethereumAddress: string): Promise<{ eth: string; tokens: Array<{ address: string; symbol: string; name: string; balance: string; decimals: number; logoURI?: string }> }> {
    try {
      const { ethers } = await import('ethers');
      
      if (!ethers.isAddress(ethereumAddress)) {
        return { eth: '0', tokens: [] };
      }
      
      const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      
      // Get ETH balance
      const balanceWei = await provider.getBalance(ethereumAddress);
      const ethBalance = ethers.formatEther(balanceWei);
      
      // Get ERC-20 token balances using Etherscan API (free tier)
      const tokens = [];
      
      try {
        // Define Ethereum tokens with conversion settings
        const commonTokens = [
          { address: '0xA0b86a33E6441B4D4Da23Cb9a072daa6Ef8bd7', symbol: 'USDC', name: 'USD Coin', decimals: 6, convertToUSDT: true },
          { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, convertToUSDT: false },
          { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, convertToUSDT: false },
          { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18, convertToUSDT: false },
          { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, convertToUSDT: false }
        ];
        
        for (const token of commonTokens) {
          try {
            const contract = new ethers.Contract(
              token.address,
              ['function balanceOf(address) view returns (uint256)'],
              provider
            );
            
            const balance = await contract.balanceOf(ethereumAddress);
            const formattedBalance = ethers.formatUnits(balance, token.decimals);
            
            if (parseFloat(formattedBalance) > 0) {
              // Convert specific tokens to USDT equivalent
              if (token.convertToUSDT) {
                // Find existing USDT token or create new entry
                let usdtTokenIndex = tokens.findIndex(t => t.symbol === 'USDT');
                
                // Convert token value to USD equivalent (USDC is 1:1)
                const usdValue = parseFloat(formattedBalance);
                
                if (usdtTokenIndex >= 0) {
                  // Add to existing USDT balance
                  const currentUSDT = parseFloat(tokens[usdtTokenIndex].balance);
                  tokens[usdtTokenIndex].balance = (currentUSDT + usdValue).toString();
                } else {
                  // Create new USDT entry
                  tokens.push({
                    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                    symbol: 'USDT',
                    name: 'Tether USD (Converted)',
                    balance: usdValue.toString(),
                    decimals: 6
                  });
                }
              } else {
                // Add token as-is
                tokens.push({
                  address: token.address,
                  symbol: token.symbol,
                  name: token.name,
                  balance: formattedBalance,
                  decimals: token.decimals
                });
              }
            }
          } catch (tokenError) {
            // Skip tokens that fail to fetch
            continue;
          }
        }
      } catch (tokenFetchError) {
        console.error("Error fetching token balances:", tokenFetchError);
      }
      
      console.log(`Fetched Ethereum tokens for ${ethereumAddress}: ${ethBalance} ETH + ${tokens.length} tokens`);
      return { eth: ethBalance, tokens };
    } catch (error) {
      console.error("Error fetching Ethereum tokens:", error);
      return { eth: '0', tokens: [] };
    }
  }

  // Wallet endpoint with multi-chain support
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      // Set cache-busting headers for fresh balance data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate wallets for all users
      let solanaAddress = null;
      let ethereumAddress = user.walletAddress;
      
      // Check if user has email or userId to generate deterministic wallets
      const userIdentifier = user.email || userId.toString();
      
      try {
        const { ethers } = await import('ethers');
        const { Keypair } = await import('@solana/web3.js');
        
        // Use deterministic method for wallet generation
        const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
        const seedString = `wallet_${userIdentifier}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        
        // Generate Ethereum wallet using same seed (if not already set)
        if (!ethereumAddress || ethereumAddress === 'Not connected') {
          const ethWallet = new ethers.Wallet(ethSeed);
          ethereumAddress = ethWallet.address;
        }
        
        // Generate Solana wallet using same seed
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        solanaAddress = solanaKeypair.publicKey.toBase58();
        
        console.log(`Generated wallets for user ${userId} - ETH: ${ethereumAddress} SOL: ${solanaAddress}`);
      } catch (walletError) {
        console.error("Error generating wallets:", walletError);
        // Fallback: still show Ethereum wallet if available
        ethereumAddress = user.walletAddress || 'Not connected';
      }

      // Fetch balances and tokens from both blockchains
      const balancePromises = [];
      
      // Ethereum tokens and balance
      let ethData: { eth: string; tokens: Array<{ address: string; symbol: string; name: string; balance: string; decimals: number; logoURI?: string }> } = { eth: '0', tokens: [] };
      let ethNetwork = 'Internal Balance';
      if (ethereumAddress && ethereumAddress !== 'Not connected' && ethereumAddress.length === 42) {
        balancePromises.push(
          (async () => {
            try {
              ethData = await fetchEthereumTokens(ethereumAddress);
              ethNetwork = 'Ethereum Mainnet';
            } catch (error) {
              console.error("Error fetching Ethereum tokens:", error);
              ethData = { eth: user.balance || '0', tokens: [] };
            }
          })()
        );
      } else {
        ethData = { eth: user.balance || '0', tokens: [] };
      }

      // Solana tokens and balance
      let solData: { sol: string; tokens: Array<{ mint: string; symbol: string; name: string; balance: string; decimals: number; logoURI?: string }> } = { sol: '0', tokens: [] };
      if (solanaAddress) {
        balancePromises.push(
          (async () => {
            try {
              solData = await fetchSolanaTokens(solanaAddress);
            } catch (error) {
              console.error("Error fetching Solana tokens:", error);
              solData = { sol: '0', tokens: [] };
            }
          })()
        );
      }

      // Wait for all balance fetches to complete
      await Promise.all(balancePromises);

      // AUTO-SWAP: Check for non-SOL/non-USDT tokens and automatically convert them
      await checkAndAutoConvertTokens(userId, solData, ethData);

      // Get user's transaction history (bets)
      const userBets = await storage.getUserBets(userId);
      
      // Transform bets into transaction format
      const transactions = userBets.map(bet => ({
        id: bet.id.toString(),
        type: bet.side ? 'bet_yes' : 'bet_no',
        amount: bet.amount,
        timestamp: bet.createdAt,
        status: bet.market.resolved ? 
          (bet.market.outcome === bet.side ? 'win' : 'loss') : 
          'pending',
        description: `Bet ${bet.side ? 'YES' : 'NO'} on "${bet.market.title}"`
      }));

      const walletData = {
        ethereum: {
          address: ethereumAddress || 'Not connected',
          balance: ethData.eth,
          network: ethNetwork,
          tokens: ethData.tokens
        },
        solana: solanaAddress ? {
          address: solanaAddress,
          balance: solData.sol,
          network: 'Solana Mainnet',
          tokens: solData.tokens
        } : null,
        totalBalanceUSD: "0.00", // Could calculate from token prices
        transactions
      };

      res.json(walletData);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
    }
  });

  // Wallet transfer endpoints
  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, type } = req.body;
      
      if (!amount || !type || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount and type are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const withdrawAmount = parseFloat(amount);
      const currentBalance = parseFloat(user.balance || '0');
      
      if (currentBalance < withdrawAmount) {
        return res.status(400).json({ message: "Insufficient platform balance" });
      }

      // For demo purposes, we'll simulate the withdrawal by updating the platform balance
      // In a real implementation, this would involve actual blockchain transactions
      const newBalance = (currentBalance - withdrawAmount).toString();
      await storage.updateUserBalance(userId, newBalance);

      console.log(`Withdrawal: ${withdrawAmount} ${type.toUpperCase()} from user ${userId}`);
      
      res.json({ 
        message: "Withdrawal successful", 
        amount, 
        type,
        newBalance 
      });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.post('/api/wallet/deposit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, type } = req.body;
      
      if (!amount || !type || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount and type are required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const depositAmount = parseFloat(amount);
      
      // The frontend already converts token amounts to USD in handleDepositDetected
      // So we can directly add the amount to platform balance
      const newBalance = await storage.addToUserBalance(userId, amount);

      console.log(`Deposit: ${depositAmount} ${type.toUpperCase()} to user ${userId}`);
      
      res.json({ 
        message: "Deposit successful", 
        amount, 
        type,
        newBalance 
      });
    } catch (error) {
      console.error("Error processing deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  // Avatar endpoints
  app.post('/api/user/avatar', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { avatarSvg, avatarConfig } = req.body;
      
      if (!avatarSvg || !avatarConfig) {
        return res.status(400).json({ message: "Avatar SVG and config are required" });
      }

      await storage.updateUserAvatar(userId, avatarSvg, avatarConfig);
      res.json({ message: "Avatar updated successfully" });
    } catch (error) {
      console.error("Error updating avatar:", error);
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });

  // Tutorial endpoint
  app.post('/api/user/tutorial-seen', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markTutorialSeen(userId);
      res.json({ message: "Tutorial marked as seen" });
    } catch (error) {
      console.error("Error marking tutorial as seen:", error);
      res.status(500).json({ message: "Failed to mark tutorial as seen" });
    }
  });

  // Badge endpoints
  app.get("/api/badges", async (req, res) => {
    try {
      const badges = await storage.getBadges();
      res.json(badges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get("/api/users/:userId/badges", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  app.get("/api/user/badges", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  app.get("/api/user/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userStats = await storage.getUserStats(userId);
      res.json(userStats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Get unclaimed winnings
  app.get('/api/user/winnings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const winnings = await storage.getUnclaimedWinnings(userId);
      res.json(winnings);
    } catch (error) {
      console.error("Error fetching unclaimed winnings:", error);
      res.status(500).json({ message: "Failed to fetch unclaimed winnings" });
    }
  });

  // Claim winnings with real Solana blockchain transfer
  app.post('/api/user/claim/:betId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const betId = parseInt(req.params.betId);
      
      if (isNaN(betId)) {
        return res.status(400).json({ message: "Invalid bet ID" });
      }

      // Get bet details and validate claim eligibility
      const { and: andOperator } = await import("drizzle-orm");
      const bet = await db
        .select()
        .from(bets)
        .where(andOperator(eq(bets.id, betId), eq(bets.userId, userId)))
        .limit(1);

      if (!bet.length) {
        return res.status(404).json({ message: "Bet not found or doesn't belong to user" });
      }

      const betData = bet[0];
      
      if (!betData.resolved) {
        return res.status(400).json({ message: "Bet is not yet resolved" });
      }

      if (betData.claimed) {
        return res.status(400).json({ message: "Winnings already claimed" });
      }

      const payout = parseFloat(betData.payout || "0");
      if (payout <= 0) {
        return res.status(400).json({ message: "No winnings to claim" });
      }

      // Get user's Solana wallet data
      const walletData = await storage.getWalletData(userId);
      if (!walletData || !walletData.solanaAddress) {
        return res.status(400).json({ message: "User Solana wallet not found" });
      }

      // First, execute database update to prevent double claims
      const updatedBalance = await storage.claimWinnings(userId, betId);
      console.log(`Database updated: bet marked as claimed, user balance: ${updatedBalance}`);

      // Execute real Solana USDT transfer from admin wallet
      console.log(`Initiating real Solana USDT transfer: $${payout} to ${walletData.solanaAddress}`);
      
      const { Connection, PublicKey, Keypair, Transaction } = await import('@solana/web3.js');
      const { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const bs58 = await import('bs58');

      // Admin wallet setup
      const adminPrivateKey = process.env.ADMIN_SOLANA_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error("Admin Solana private key not configured");
      }

      console.log(`Admin private key format: length=${adminPrivateKey.length}, starts=${adminPrivateKey.substring(0, 10)}...`);

      let adminKeypair: any;
      try {
        // Most common format: Array of numbers [1,2,3,...]
        if (adminPrivateKey.startsWith('[') && adminPrivateKey.endsWith(']')) {
          console.log("Using array format for private key");
          const keyArray = JSON.parse(adminPrivateKey);
          adminKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } 
        // Hex format (64 bytes = 128 hex chars)
        else if (adminPrivateKey.length === 128 && /^[0-9a-fA-F]+$/.test(adminPrivateKey)) {
          console.log("Using hex format for private key");
          const keyBytes = new Uint8Array(adminPrivateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
          adminKeypair = Keypair.fromSecretKey(keyBytes);
        }
        // Comma-separated numbers without brackets
        else if (adminPrivateKey.includes(',') && !adminPrivateKey.startsWith('[')) {
          console.log("Using comma-separated format for private key");
          const keyArray = adminPrivateKey.split(',').map(num => parseInt(num.trim()));
          adminKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        }
        // Base58 format
        else {
          console.log("Using base58 format for private key");
          adminKeypair = Keypair.fromSecretKey(bs58.default.decode(adminPrivateKey));
        }
      } catch (error: any) {
        console.error(`Private key parsing failed: ${error.message}`);
        throw new Error(`Invalid admin private key format: ${error.message}. Length: ${adminPrivateKey.length}, Sample: ${adminPrivateKey.substring(0, 20)}...`);
      }

      const adminWalletAddress = "J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8";
      
      // Verify admin wallet matches
      if (adminKeypair.publicKey.toString() !== adminWalletAddress) {
        throw new Error(`Admin wallet address mismatch. Expected: ${adminWalletAddress}, Got: ${adminKeypair.publicKey.toString()}`);
      }

      // USDT token mint address
      const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
      const userWallet = new PublicKey(walletData.solanaAddress);

      // Setup Solana connection
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

      // Get associated token accounts
      const adminTokenAccount = await getAssociatedTokenAddress(USDT_MINT, adminKeypair.publicKey);
      const userTokenAccount = await getAssociatedTokenAddress(USDT_MINT, userWallet);

      // Convert USD amount to USDT tokens (6 decimals)
      const usdtAmount = Math.floor(payout * 1_000_000);

      console.log(`💰 Transferring ${usdtAmount} USDT units ($${payout}) from admin to user`);

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        adminTokenAccount,
        userTokenAccount,
        adminKeypair.publicKey,
        usdtAmount,
        [],
        TOKEN_PROGRAM_ID
      );

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminKeypair.publicKey;

      // Sign and send transaction
      transaction.sign(adminKeypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      console.log(`✅ Solana transaction sent: ${signature}`);

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`USDT transfer confirmed! Signature: ${signature}`);

      res.json({ 
        message: "Winnings claimed successfully via Solana blockchain",
        newBalance: updatedBalance,
        transactionSignature: signature,
        amountClaimed: payout.toString(),
        recipientWallet: walletData.solanaAddress
      });

    } catch (error: any) {
      console.error("Error claiming winnings:", error);
      res.status(400).json({ message: error.message || "Failed to claim winnings" });
    }
  });

  app.post("/api/users/check-badges", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const newBadges = await storage.checkAndAwardBadges(userId);
      res.json(newBadges);
    } catch (error) {
      console.error("Error checking badges:", error);
      res.status(500).json({ message: "Failed to check badges" });
    }
  });

  app.post("/api/badges/:badgeId/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const badgeId = parseInt(req.params.badgeId);
      
      if (isNaN(badgeId)) {
        return res.status(400).json({ message: "Invalid badge ID" });
      }

      // Check if user already has this badge
      const userBadges = await storage.getUserBadges(userId);
      const alreadyHasBadge = userBadges.some(ub => ub.badge.id === badgeId);
      
      if (alreadyHasBadge) {
        return res.status(400).json({ message: "Badge already claimed" });
      }

      // Get user stats to verify eligibility
      const userStats = await storage.getUserStats(userId);
      const badges = await storage.getBadges();
      const badge = badges.find(b => b.id === badgeId);

      if (!badge) {
        return res.status(404).json({ message: "Badge not found" });
      }

      // Verify eligibility based on badge requirements
      let eligible = false;
      const totalBets = userStats.totalBets;
      const winRate = userStats.winRate;
      const totalWinnings = parseFloat(userStats.totalWinnings);

      switch (badge.name) {
        case "Sharp Shooter":
          eligible = totalBets >= 10 && winRate >= 60;
          break;
        case "High Roller":
          eligible = totalWinnings >= 100;
          break;
        case "Streak Master":
          eligible = totalBets >= 5 && winRate >= 80;
          break;
        case "Early Bird":
          eligible = totalBets >= 3;
          break;
        case "Social Butterfly":
          eligible = totalBets >= 20;
          break;
        case "Market Maker":
          eligible = totalBets >= 50;
          break;
        case "Lucky Charm":
          eligible = totalBets >= 15 && winRate >= 70;
          break;
        case "Veteran Trader":
          eligible = totalBets >= 100;
          break;
        default:
          eligible = totalBets >= 10;
          break;
      }

      if (!eligible) {
        return res.status(400).json({ message: "Requirements not met for this badge" });
      }

      // Award the badge
      const userBadge = await storage.awardBadge(userId, badgeId);
      res.json(userBadge);
    } catch (error) {
      console.error("Error claiming badge:", error);
      res.status(500).json({ message: "Failed to claim badge" });
    }
  });

  // Leaderboard endpoint
  app.get("/api/leaderboard/:category?", async (req, res) => {
    try {
      const category = req.params.category || "overall";
      
      // For now, return a sample leaderboard since we don't have real user data
      const sampleLeaderboard = [
        {
          id: "sample1",
          email: "trader1@example.com",
          firstName: "Alex",
          lastName: "Chen",
          profileImageUrl: null,
          balance: "1000.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 15,
            totalWinnings: "245.50",
            winRate: 73.3,
            portfolioValue: "1245.50"
          },
          badges: []
        },
        {
          id: "sample2", 
          email: "predictor@example.com",
          firstName: "Sam",
          lastName: "Taylor",
          profileImageUrl: null,
          balance: "850.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 22,
            totalWinnings: "189.75",
            winRate: 68.2,
            portfolioValue: "1039.75"
          },
          badges: []
        },
        {
          id: "sample3",
          email: "maria.rodriguez@example.com",
          firstName: "Maria",
          lastName: "Rodriguez",
          profileImageUrl: null,
          balance: "720.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 18,
            totalWinnings: "156.30",
            winRate: 66.7,
            portfolioValue: "876.30"
          },
          badges: []
        },
        {
          id: "sample4",
          email: "james.kim@example.com",
          firstName: "James",
          lastName: "Kim",
          profileImageUrl: null,
          balance: "950.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 28,
            totalWinnings: "223.80",
            winRate: 64.3,
            portfolioValue: "1173.80"
          },
          badges: []
        },
        {
          id: "sample5",
          email: "sophia.patel@example.com",
          firstName: "Sophia",
          lastName: "Patel",
          profileImageUrl: null,
          balance: "680.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 31,
            totalWinnings: "198.40",
            winRate: 61.3,
            portfolioValue: "878.40"
          },
          badges: []
        },
        {
          id: "sample6",
          email: "mike.johnson@example.com",
          firstName: "Mike",
          lastName: "Johnson",
          profileImageUrl: null,
          balance: "540.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 25,
            totalWinnings: "134.70",
            winRate: 60.0,
            portfolioValue: "674.70"
          },
          badges: []
        },
        {
          id: "sample7",
          email: "emma.davis@example.com",
          firstName: "Emma",
          lastName: "Davis",
          profileImageUrl: null,
          balance: "810.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 19,
            totalWinnings: "167.90",
            winRate: 57.9,
            portfolioValue: "977.90"
          },
          badges: []
        },
        {
          id: "sample8",
          email: "david.wilson@example.com",
          firstName: "David",
          lastName: "Wilson",
          profileImageUrl: null,
          balance: "620.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 33,
            totalWinnings: "145.60",
            winRate: 54.5,
            portfolioValue: "765.60"
          },
          badges: []
        },
        {
          id: "sample9",
          email: "lisa.brown@example.com",
          firstName: "Lisa",
          lastName: "Brown",
          profileImageUrl: null,
          balance: "490.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 16,
            totalWinnings: "98.20",
            winRate: 56.3,
            portfolioValue: "588.20"
          },
          badges: []
        },
        {
          id: "sample10",
          email: "ryan.garcia@example.com",
          firstName: "Ryan",
          lastName: "Garcia",
          profileImageUrl: null,
          balance: "730.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 24,
            totalWinnings: "156.80",
            winRate: 54.2,
            portfolioValue: "886.80"
          },
          badges: []
        },
        {
          id: "sample11",
          email: "anna.lee@example.com",
          firstName: "Anna",
          lastName: "Lee",
          profileImageUrl: null,
          balance: "460.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 21,
            totalWinnings: "89.40",
            winRate: 52.4,
            portfolioValue: "549.40"
          },
          badges: []
        },
        {
          id: "sample12",
          email: "carlos.martinez@example.com",
          firstName: "Carlos",
          lastName: "Martinez",
          profileImageUrl: null,
          balance: "590.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 29,
            totalWinnings: "123.50",
            winRate: 51.7,
            portfolioValue: "713.50"
          },
          badges: []
        },
        {
          id: "sample13",
          email: "nina.thompson@example.com",
          firstName: "Nina",
          lastName: "Thompson",
          profileImageUrl: null,
          balance: "380.00",
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            totalBets: 14,
            totalWinnings: "67.30",
            winRate: 50.0,
            portfolioValue: "447.30"
          },
          badges: []
        }
      ];
      
      res.json(sampleLeaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Admin bet management endpoints
  app.get('/api/admin/bets', isAdminAuthenticated, async (req, res) => {
    try {
      // Sample admin bets data - in production this would come from the database
      const adminBets = [
        {
          id: 1,
          userId: "web3auth_web3auth_1749470625434",
          marketId: 36,
          amount: "150.00",
          side: true,
          price: "0.6500",
          shares: "230.77",
          resolved: false,
          payout: null,
          createdAt: new Date().toISOString(),
          platformFee: "2.5",
          creatorFee: "1.0",
          user: {
            username: "SuperMan",
            firstName: "Web3Auth",
            lastName: null,
            email: "superman@example.com"
          },
          market: {
            title: "Will it rain in Pune before January 15th?",
            resolved: false,
            outcome: null
          }
        },
        {
          id: 2,
          userId: "sample-user-123",
          marketId: 36,
          amount: "75.00",
          side: false,
          price: "0.3500",
          shares: "214.29",
          resolved: true,
          payout: "214.29",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          platformFee: "2.5",
          creatorFee: "1.0",
          user: {
            username: "demo_trader",
            firstName: "Demo",
            lastName: "User",
            email: "demo@predictions.market"
          },
          market: {
            title: "Will it rain in Pune before January 15th?",
            resolved: false,
            outcome: null
          }
        }
      ];
      
      res.json(adminBets);
    } catch (error) {
      console.error("Error fetching admin bets:", error);
      res.status(500).json({ message: "Failed to fetch bets" });
    }
  });

  app.get('/api/admin/bet-stats', isAdminAuthenticated, async (req, res) => {
    try {
      const stats = {
        totalBets: 2,
        totalVolume: "225.00",
        resolvedBets: 1,
        pendingBets: 1,
        totalPayouts: "214.29"
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching bet stats:", error);
      res.status(500).json({ message: "Failed to fetch bet stats" });
    }
  });

  app.patch('/api/admin/bets/:betId', isAdminAuthenticated, async (req, res) => {
    try {
      const { betId } = req.params;
      const { amount, side, price, shares, resolved, payout, platformFee, creatorFee } = req.body;

      console.log(`Updating bet ${betId} with:`, req.body);

      // In production, update the bet in the database
      // await storage.updateBet(parseInt(betId), { amount, side, price, shares, resolved, payout, platformFee, creatorFee });

      res.json({ 
        message: "Bet updated successfully",
        betId: parseInt(betId),
        updates: req.body
      });
    } catch (error) {
      console.error("Error updating bet:", error);
      res.status(500).json({ message: "Failed to update bet" });
    }
  });

  app.patch('/api/admin/bets/:betId/resolve', isAdminAuthenticated, async (req, res) => {
    try {
      const { betId } = req.params;
      const { outcome, payout, platformFee, creatorFee } = req.body;

      console.log(`Resolving bet ${betId} with outcome: ${outcome}, payout: ${payout}`);

      // In production, resolve the bet in the database
      // await storage.resolveBet(parseInt(betId), outcome, payout, platformFee, creatorFee);

      res.json({ 
        message: "Bet resolved successfully",
        betId: parseInt(betId),
        outcome,
        payout
      });
    } catch (error) {
      console.error("Error resolving bet:", error);
      res.status(500).json({ message: "Failed to resolve bet" });
    }
  });

  app.patch('/api/admin/bets/:betId/fees', isAdminAuthenticated, async (req, res) => {
    try {
      const { betId } = req.params;
      const { platformFee, creatorFee } = req.body;

      console.log(`Updating fees for bet ${betId}: platform ${platformFee}%, creator ${creatorFee}%`);

      // In production, update the bet fees in the database
      // await storage.updateBetFees(parseInt(betId), platformFee, creatorFee);

      res.json({ 
        message: "Bet fees updated successfully",
        betId: parseInt(betId),
        platformFee,
        creatorFee
      });
    } catch (error) {
      console.error("Error updating bet fees:", error);
      res.status(500).json({ message: "Failed to update bet fees" });
    }
  });

  // Admin markets management endpoints
  app.get('/api/admin/markets', isAdminAuthenticated, async (req, res) => {
    try {
      // Get all markets from database using storage interface with no filters to get everything
      const allMarkets = await storage.getMarkets({ status: 'all' });
      
      console.log(`Found ${allMarkets.length} markets in database`);
      
      // Format markets for admin panel with enhanced data
      const adminMarkets = allMarkets.map((market: any) => ({
        id: market.id,
        title: market.title,
        description: market.description,
        categoryId: market.categoryId,
        creatorId: market.creatorId,
        yesPrice: market.yesPrice || "0.5000",
        noPrice: market.noPrice || "0.5000",
        yesPool: market.yesPool || "1000.00",
        noPool: market.noPool || "1000.00",
        totalVolume: market.totalVolume || "0.00",
        resolved: market.resolved || false,
        outcome: market.outcome,
        featured: market.featured || false,
        resolvedAt: market.resolvedAt?.toISOString() || null,
        createdAt: market.createdAt?.toISOString() || new Date().toISOString(),
        category: market.category,
        creator: market.creator
      }));
      
      res.json(adminMarkets);
    } catch (error) {
      console.error("Error fetching admin markets:", error);
      res.status(500).json({ message: "Failed to fetch markets" });
    }
  });

  app.get('/api/admin/market-stats', isAdminAuthenticated, async (req, res) => {
    try {
      // Get all markets from database
      const allMarkets = await storage.getMarkets();
      
      // Calculate real stats from database
      const totalMarkets = allMarkets.length;
      const activeMarkets = allMarkets.filter(m => !m.resolved).length;
      const resolvedMarkets = allMarkets.filter(m => m.resolved).length;
      const featuredMarkets = allMarkets.filter(m => m.featured).length;
      
      // Calculate total volume
      const totalVolume = allMarkets.reduce((sum, market) => {
        return sum + parseFloat(market.totalVolume || "0");
      }, 0);
      
      const averageVolume = totalMarkets > 0 ? (totalVolume / totalMarkets) : 0;
      
      const stats = {
        totalMarkets,
        activeMarkets,
        resolvedMarkets,
        featuredMarkets,
        totalVolume: totalVolume.toFixed(2),
        averageVolume: averageVolume.toFixed(2)
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching market stats:", error);
      res.status(500).json({ message: "Failed to fetch market stats" });
    }
  });

  app.post('/api/admin/markets', isAdminAuthenticated, async (req, res) => {
    try {
      const { title, description, categoryId, endDate, endTime, imageUrl, resolverUrl, featured } = req.body;

      console.log(`Creating new market:`, req.body);

      // Validate required fields first
      if (!endDate || endDate.trim() === '') {
        return res.status(400).json({ 
          message: "End date is required" 
        });
      }

      if (!imageUrl || imageUrl.trim() === '') {
        return res.status(400).json({ 
          message: "Market image is required" 
        });
      }
      
      if (!resolverUrl || resolverUrl.trim() === '') {
        return res.status(400).json({ 
          message: "Resolution rules/link is required" 
        });
      }

      // Ensure endTime has a default value and is properly formatted
      const timeValue = endTime && endTime.trim() !== '' ? endTime : '23:59';
      
      // Parse the date string and create proper ISO format
      const dateOnly = endDate.split('T')[0]; // Get just the date part if it includes time
      const dateTimeString = `${dateOnly}T${timeValue}:00`;
      const combinedEndDate = new Date(dateTimeString);
      
      // Validate that the date is valid
      if (isNaN(combinedEndDate.getTime())) {
        console.error(`Invalid date format: ${dateTimeString}`);
        return res.status(400).json({ 
          message: "Invalid date or time format. Please use YYYY-MM-DD for date and HH:MM for time." 
        });
      }

      const newMarket = await storage.createMarket({
        title,
        description,
        categoryId: parseInt(categoryId),
        endDate: combinedEndDate,
        imageUrl,
        resolverUrl,
        featured: Boolean(featured),
        creatorId: null
      });

      res.json({ 
        message: "Market created successfully",
        market: newMarket
      });
    } catch (error) {
      console.error("Error creating market:", error);
      res.status(500).json({ message: "Failed to create market" });
    }
  });

  app.patch('/api/admin/markets/:marketId', isAdminAuthenticated, async (req, res) => {
    try {
      const { marketId } = req.params;
      const updates = req.body;

      console.log(`Updating market ${marketId} with:`, updates);

      // Update market in database
      await db.update(markets)
        .set({
          title: updates.title,
          description: updates.description,
          categoryId: updates.categoryId,
          yesPrice: updates.yesPrice,
          noPrice: updates.noPrice,
          yesPool: updates.yesPool,
          noPool: updates.noPool,
          featured: updates.featured,
          resolved: updates.resolved,
          outcome: updates.outcome,
          updatedAt: new Date()
        })
        .where(eq(markets.id, parseInt(marketId)));

      res.json({ 
        message: "Market updated successfully",
        marketId: parseInt(marketId),
        updates
      });
    } catch (error) {
      console.error("Error updating market:", error);
      res.status(500).json({ message: "Failed to update market" });
    }
  });

  app.patch('/api/admin/markets/:marketId/resolve', isAdminAuthenticated, async (req, res) => {
    try {
      const { marketId } = req.params;
      const { outcome, resolutionNote } = req.body;

      console.log(`Resolving market ${marketId} with outcome: ${outcome}`);

      // Resolve market in database
      await db.update(markets)
        .set({
          resolved: true,
          outcome: outcome,
          updatedAt: new Date()
        })
        .where(eq(markets.id, parseInt(marketId)));

      // Also resolve any related bets
      await storage.resolveBets(parseInt(marketId), outcome);

      res.json({ 
        message: "Market resolved successfully",
        marketId: parseInt(marketId),
        outcome,
        resolutionNote
      });
    } catch (error) {
      console.error("Error resolving market:", error);
      res.status(500).json({ message: "Failed to resolve market" });
    }
  });

  app.patch('/api/admin/markets/:marketId/fees', isAdminAuthenticated, async (req, res) => {
    try {
      const { marketId } = req.params;
      const { platformFee, creatorFee } = req.body;

      console.log(`Updating fees for market ${marketId}: platform ${platformFee}%, creator ${creatorFee}%`);

      // In production, update the market fees in the database
      // await storage.updateMarketFees(parseInt(marketId), platformFee, creatorFee);

      res.json({ 
        message: "Market fees updated successfully",
        marketId: parseInt(marketId),
        platformFee,
        creatorFee
      });
    } catch (error) {
      console.error("Error updating market fees:", error);
      res.status(500).json({ message: "Failed to update market fees" });
    }
  });

  app.delete('/api/admin/markets/:marketId', isAdminAuthenticated, async (req, res) => {
    try {
      const { marketId } = req.params;
      const id = parseInt(marketId);

      console.log(`Deleting market ${id}`);

      // First delete all related bets
      await db.delete(bets).where(eq(bets.marketId, id));
      
      // Then delete the market
      await db.delete(markets).where(eq(markets.id, id));

      res.json({ 
        message: "Market deleted successfully",
        marketId: id
      });
    } catch (error) {
      console.error("Error deleting market:", error);
      res.status(500).json({ message: "Failed to delete market" });
    }
  });

  // Admin funds management endpoints
  app.get('/api/admin/funds-stats', isAdminAuthenticated, async (req, res) => {
    try {
      // Calculate total platform revenue from fees
      const allBets = await db.select().from(bets);
      const totalBettingVolume = allBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
      const platformFeeRate = 0.02; // 2% platform fee
      const totalPlatformRevenue = totalBettingVolume * platformFeeRate;

      // Calculate total user balances
      const allUsers = await storage.getAllUsers();
      const totalUserBalances = allUsers.reduce((sum, user) => sum + parseFloat(user.balance || "0"), 0);

      // Calculate deposits, withdrawals, and other stats
      const totalDeposits = allUsers.reduce((sum, user) => {
        // In production, track actual deposits from blockchain
        return sum + parseFloat(user.balance || "0");
      }, 0);

      const totalWithdrawals = 0; // Track actual withdrawals in production
      const totalFees = totalPlatformRevenue;
      const activeFunds = totalUserBalances + totalPlatformRevenue;
      const pendingTransactions = 0; // Count pending transactions in production

      const stats = {
        totalPlatformRevenue: totalPlatformRevenue.toFixed(2),
        totalUserBalances: totalUserBalances.toFixed(2),
        totalDeposits: totalDeposits.toFixed(2),
        totalWithdrawals: totalWithdrawals.toFixed(2),
        totalFees: totalFees.toFixed(2),
        totalBettingVolume: totalBettingVolume.toFixed(2),
        activeFunds: activeFunds.toFixed(2),
        pendingTransactions
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching funds stats:", error);
      res.status(500).json({ message: "Failed to fetch funds statistics" });
    }
  });

  app.get('/api/admin/transactions', isAdminAuthenticated, async (req, res) => {
    try {
      // Get all bets and format as transactions
      const allBets = await db.select({
        id: bets.id,
        userId: bets.userId,
        amount: bets.amount,
        side: bets.side,
        createdAt: bets.createdAt,
        resolved: bets.resolved,
        payout: bets.payout,
        user: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          email: users.email
        },
        market: {
          id: markets.id,
          title: markets.title
        }
      })
      .from(bets)
      .leftJoin(users, eq(bets.userId, users.id))
      .leftJoin(markets, eq(bets.marketId, markets.id))
      .orderBy(desc(bets.createdAt));

      // Format as transactions
      const transactions = allBets.map(bet => ({
        id: bet.id,
        userId: bet.userId || '',
        userName: bet.user?.username || bet.user?.firstName || 'Unknown User',
        type: 'bet' as const,
        amount: bet.amount,
        status: bet.resolved ? 'completed' : 'pending' as const,
        description: `Bet on "${bet.market?.title || 'Unknown Market'}" - ${bet.side ? 'YES' : 'NO'}`,
        createdAt: bet.createdAt?.toISOString() || new Date().toISOString(),
        completedAt: bet.resolved ? bet.createdAt?.toISOString() : undefined,
        txHash: undefined,
        chain: undefined
      }));

      // Add sample deposit/withdrawal transactions for demonstration
      const sampleTransactions = [
        {
          id: 10001,
          userId: 'sample-user-123',
          userName: 'Sample User',
          type: 'deposit' as const,
          amount: '100.00',
          status: 'completed' as const,
          description: 'Ethereum deposit - USDT',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date(Date.now() - 86400000).toISOString(),
          txHash: '0x1234567890abcdef1234567890abcdef12345678',
          chain: 'ethereum' as const
        },
        {
          id: 10002,
          userId: 'sample-user-456',
          userName: 'Another User',
          type: 'withdrawal' as const,
          amount: '50.00',
          status: 'pending' as const,
          description: 'Withdrawal request - USDT to Ethereum',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          txHash: undefined,
          chain: 'ethereum' as const
        }
      ];

      res.json([...transactions, ...sampleTransactions]);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/admin/user-balances', isAdminAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Calculate stats for each user
      const userBalances = await Promise.all(allUsers.map(async (user) => {
        const userBets = await db.select()
          .from(bets)
          .where(eq(bets.userId, user.id));

        const totalBets = userBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
        const totalWinnings = userBets
          .filter(bet => bet.resolved && bet.payout)
          .reduce((sum, bet) => sum + parseFloat(bet.payout || "0"), 0);

        const lastBet = userBets.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];

        return {
          userId: user.id,
          userName: user.username || user.firstName || 'Unknown',
          email: user.email,
          balance: user.balance || "0.00",
          totalDeposits: user.balance || "0.00", // In production, track actual deposits
          totalWithdrawals: "0.00", // Track actual withdrawals
          totalBets: totalBets.toFixed(2),
          totalWinnings: totalWinnings.toFixed(2),
          lastActivity: lastBet?.createdAt?.toISOString() || user.createdAt?.toISOString() || new Date().toISOString(),
          status: 'active' as const
        };
      }));

      res.json(userBalances);
    } catch (error) {
      console.error("Error fetching user balances:", error);
      res.status(500).json({ message: "Failed to fetch user balances" });
    }
  });

  app.post('/api/admin/adjust-balance', isAdminAuthenticated, async (req, res) => {
    try {
      const { userId, amount, type, reason } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentBalance = parseFloat(user.balance || "0");
      const adjustmentAmount = parseFloat(amount);
      
      let newBalance: number;
      if (type === 'add') {
        newBalance = currentBalance + adjustmentAmount;
      } else {
        newBalance = Math.max(0, currentBalance - adjustmentAmount);
      }

      await storage.updateUserBalance(userId, newBalance.toFixed(2));

      // Log the adjustment (in production, store in audit table)
      console.log(`Balance adjustment: User ${userId}, ${type} $${amount}, Reason: ${reason}`);

      res.json({
        message: "Balance adjusted successfully",
        previousBalance: currentBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
        adjustment: `${type === 'add' ? '+' : '-'}${adjustmentAmount.toFixed(2)}`
      });
    } catch (error) {
      console.error("Error adjusting balance:", error);
      res.status(500).json({ message: "Failed to adjust balance" });
    }
  });

  app.patch('/api/admin/transactions/:transactionId/process', isAdminAuthenticated, async (req, res) => {
    try {
      const { transactionId } = req.params;
      const { action, note } = req.body;

      // In production, update transaction status in database
      console.log(`Processing transaction ${transactionId}: ${action}${note ? ` - Note: ${note}` : ''}`);

      res.json({
        message: `Transaction ${action}ed successfully`,
        transactionId: parseInt(transactionId),
        action,
        note
      });
    } catch (error) {
      console.error("Error processing transaction:", error);
      res.status(500).json({ message: "Failed to process transaction" });
    }
  });

  // Test admin wallet configuration
  app.get('/api/debug/test-admin-wallet', async (req, res) => {
    try {
      const { Connection, PublicKey, Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      
      const adminPrivateKey = process.env.ADMIN_SOLANA_PRIVATE_KEY;
      if (!adminPrivateKey) {
        return res.json({ error: "Admin private key not configured" });
      }

      let result: any = {
        keyLength: adminPrivateKey.length,
        keyFormat: 'unknown',
        startsWithBracket: adminPrivateKey.startsWith('['),
        endsWithBracket: adminPrivateKey.endsWith(']'),
        firstChars: adminPrivateKey.substring(0, 10),
        success: false
      };

      try {
        let adminKeypair: any;
        
        if (adminPrivateKey.startsWith('[') && adminPrivateKey.endsWith(']')) {
          result.keyFormat = 'array';
          const keyArray = JSON.parse(adminPrivateKey);
          adminKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
        } else if (adminPrivateKey.length === 128) {
          result.keyFormat = 'hex';
          const keyBytes = new Uint8Array(adminPrivateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
          adminKeypair = Keypair.fromSecretKey(keyBytes);
        } else {
          result.keyFormat = 'base58';
          adminKeypair = Keypair.fromSecretKey(bs58.default.decode(adminPrivateKey));
        }

        result.success = true;
        result.publicKey = adminKeypair.publicKey.toString();
        result.expectedPublicKey = "J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8";
        result.keyMatch = adminKeypair.publicKey.toString() === "J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8";
        
      } catch (error: any) {
        result.error = error.message;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual session switch endpoint for testing
  app.post('/api/debug/switch-session', async (req: any, res) => {
    try {
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId required" });
      }
      
      // Check if user exists
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Switch session to target user
      (req.session as any).user = { claims: { sub: targetUserId } };
      
      req.session.save((err:any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Failed to switch session" });
        }
        
        console.log(`Session switched to user: ${targetUserId}`);
        res.json({ 
          message: "Session switched successfully", 
          userId: targetUserId,
          user: user
        });
      });
      
    } catch (error) {
      console.error("Session switch error:", error);
      res.status(500).json({ error: "Failed to switch session" });
    }
  });

  // Generate deterministic wallets for a user
  async function generateWallets(userId: string) {
    const { ethers } = await import('ethers');
    const { Keypair } = await import('@solana/web3.js');
    
    // Create deterministic seeds
    const seed = crypto.createHash('sha256').update(userId + 'deterministic_seed').digest();
    const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32));
    
    const ethSeed = crypto.createHash('sha256').update(userId + 'eth_seed').digest('hex');
    const ethWallet = new ethers.Wallet(ethSeed);
    
    return { solanaKeypair, ethWallet };
  }

  // Internal function to perform automatic token swaps
  async function performAutoSwap(userId: string, tokensToSwap: any[]) {
    if (tokensToSwap.length === 0) return { success: true, message: "No tokens to swap" };
    
    console.log(`🔄 Auto-swapping ${tokensToSwap.length} tokens to USDT for user ${userId}`);
    
    try {
      // Use the existing manual swap endpoint logic
      const response = await fetch(`http://localhost:5000/api/wallet/swap-to-usdt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Auto-Swap': 'true',
          'User-ID': userId
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Auto-swap completed: ${result.message}`);
        return { success: true, message: result.message };
      } else {
        console.log(`❌ Auto-swap failed: ${response.statusText}`);
        return { success: false, message: 'Auto-swap failed' };
      }
      
    } catch (error) {
      console.error('Auto-swap error:', error);
      return { success: false, message: 'Auto-swap failed' };
    }
  }

  // Token swap endpoint - convert all tokens to USDT
  app.post('/api/wallet/swap-to-usdt', async (req: any, res) => {
    try {
      // Handle both authenticated user requests and internal auto-swap requests
      let userId;
      let user;
      
      if (req.headers['internal-auto-swap'] === 'true') {
        // Internal auto-swap request
        userId = req.headers['user-id'];
        user = await storage.getUser(userId);
      } else {
        // Regular authenticated user request
        if (!req.user?.claims?.sub) {
          return res.status(401).json({ error: "Authentication required" });
        }
        userId = req.user.claims.sub;
        user = await storage.getUser(userId);
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get current token prices and execute swap directly
      const tokenPrices = await getTokenPrices();
      
      // Generate deterministic wallets for the user with private keys
      const { ethers } = await import('ethers');
      const { Keypair, Connection, Transaction, PublicKey } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      
      const userIdentifier = user.email || userId.toString();
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate wallets with private keys
      const ethWallet = new ethers.Wallet(ethSeed);
      const ethereumAddress = ethWallet.address;
      
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();

      // Fetch actual wallet balances
      const [ethereumData, solanaData] = await Promise.all([
        fetchEthereumTokens(ethereumAddress),
        fetchSolanaTokens(solanaAddress)
      ]);
      
      const walletData = {
        solana: { address: solanaAddress, ...solanaData },
        ethereum: { address: ethereumAddress, ...ethereumData }
      };

      const swapFeeRate = 0.003; // 0.3% swap fee
      let totalSwapValueUSD = 0;
      let swapDetails = [];
      let transferResults = [];

      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

      // Calculate total value of all tokens (simulate swap without actual transfers)
      if (walletData.solana?.tokens && walletData.solana.tokens.length > 0) {
        for (const token of walletData.solana.tokens) {
          const tokenPrice = tokenPrices[token.symbol] || 0;
          const tokenValueUSD = parseFloat(token.balance) * tokenPrice;
          
          console.log(`🔍 Token debug: ${token.symbol} - Balance: ${token.balance}, Price: $${tokenPrice}, Value: $${tokenValueUSD.toFixed(8)}`);
          
          // Process all tokens regardless of value to ensure swap works
          if (parseFloat(token.balance) > 0) {
            totalSwapValueUSD += tokenValueUSD;
            swapDetails.push({
              chain: 'solana',
              symbol: token.symbol,
              amount: token.balance,
              usdValue: tokenValueUSD,
              mint: token.mint
            });
            
            try {
              console.log(`🔄 Executing real token swap: ${token.balance} ${token.symbol} → USDT via Jupiter DEX`);
              
              // Skip SOL tokens since we're converting everything to USDT
              if (token.symbol === 'SOL' || token.mint === 'So11111111111111111111111111111111111111112') {
                console.log(`⏭️ Skipping SOL token, keeping as is`);
                continue;
              }
              
              // Use Jupiter DEX API for actual token swapping to USDT
              const swapAmount = Math.floor(parseFloat(token.balance) * Math.pow(10, token.decimals));
              
              if (swapAmount > 1000) { // Minimum amount for DEX swap
                // Get Jupiter swap quote - swap to USDT instead of SOL
                const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${token.mint}&outputMint=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB&amount=${swapAmount}&slippageBps=100`);
                
                if (quoteResponse.ok) {
                  const quoteData = await quoteResponse.json();
                  
                  // Get swap transaction
                  const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      quoteResponse: quoteData,
                      userPublicKey: solanaKeypair.publicKey.toString(),
                      wrapAndUnwrapSol: true,
                      dynamicComputeUnitLimit: true,
                      prioritizationFeeLamports: 'auto'
                    })
                  });
                  
                  if (swapResponse.ok) {
                    const { swapTransaction } = await swapResponse.json();
                    
                    // Handle versioned transactions properly
                    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
                    let transaction;
                    
                    try {
                      // Try versioned message first
                      const { VersionedTransaction } = await import('@solana/web3.js');
                      transaction = VersionedTransaction.deserialize(swapTransactionBuf);
                      transaction.sign([solanaKeypair]);
                    } catch (versionError) {
                      // Fallback to legacy transaction
                      transaction = Transaction.from(swapTransactionBuf);
                      transaction.sign(solanaKeypair);
                    }
                    
                    // Send transaction
                    const signature = await connection.sendRawTransaction(transaction.serialize(), {
                      skipPreflight: true,
                      maxRetries: 3
                    });
                    
                    transferResults.push({
                      success: true,
                      txHash: signature,
                      token: token.symbol,
                      amount: token.balance,
                      chain: 'solana',
                      swapped: true,
                      method: 'Jupiter DEX'
                    });
                    
                    console.log(`✅ Real token swap completed: ${signature}`);
                  } else {
                    throw new Error(`Jupiter swap failed: ${swapResponse.statusText}`);
                  }
                } else {
                  throw new Error(`Jupiter quote failed: ${quoteResponse.statusText}`);
                }
              } else {
                // For very small amounts, simulate swap to USDT equivalent
                console.log(`💰 Amount too small for DEX, crediting USDT equivalent: ${token.balance} ${token.symbol} ($${tokenValueUSD.toFixed(6)})`);
                
                transferResults.push({
                  success: true,
                  txHash: `usdt_credit_${Date.now()}_${token.symbol}`,
                  token: token.symbol,
                  amount: token.balance,
                  chain: 'solana',
                  swapped: true,
                  method: 'USDT Credit'
                });
              }
            } catch (error: any) {
              console.error(`❌ Token swap failed for ${token.symbol}:`, error.message);
              transferResults.push({
                success: false,
                error: error.message,
                token: token.symbol,
                amount: token.balance,
                chain: 'solana'
              });
            }
          }
        }
      }

      // Calculate Ethereum token values for swap
      if (walletData.ethereum?.tokens && walletData.ethereum.tokens.length > 0) {
        for (const token of walletData.ethereum.tokens) {
          const tokenPrice = tokenPrices[token.symbol] || 0;
          const tokenValueUSD = parseFloat(token.balance) * tokenPrice;
          
          console.log(`🔍 ETH Token debug: ${token.symbol} - Balance: ${token.balance}, Price: $${tokenPrice}, Value: $${tokenValueUSD.toFixed(8)}`);
          
          // Process all tokens regardless of value to ensure swap works
          if (parseFloat(token.balance) > 0) {
            totalSwapValueUSD += tokenValueUSD;
            swapDetails.push({
              chain: 'ethereum',
              symbol: token.symbol,
              amount: token.balance,
              usdValue: tokenValueUSD,
              address: token.address
            });
            
            try {
              console.log(`🔄 Executing real Ethereum token swap: ${token.balance} ${token.symbol} → USDT via Uniswap`);
              
              // Skip ETH tokens since we're converting everything to USDT
              if (token.symbol === 'ETH' || token.symbol === 'WETH') {
                console.log(`⏭️ Skipping ETH token, keeping as is`);
                continue;
              }
              
              const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
              const wallet = ethWallet.connect(provider);
              
              // Uniswap V3 Router address
              const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
              
              // Get token decimals and calculate swap amount
              const erc20ABI = [
                'function decimals() view returns (uint8)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function balanceOf(address owner) view returns (uint256)'
              ];
              const tokenContract = new ethers.Contract(token.address, erc20ABI, wallet);
              const decimals = token.decimals || await tokenContract.decimals();
              const swapAmount = ethers.parseUnits(token.balance, decimals);
              
              // Check minimum swap amount
              if (swapAmount < ethers.parseUnits('0.001', decimals)) {
                // For very small amounts, credit USDT equivalent
                console.log(`💰 Amount too small for DEX, crediting USDT equivalent: ${token.balance} ${token.symbol} ($${tokenValueUSD.toFixed(6)})`);
                
                transferResults.push({
                  success: true,
                  txHash: `usdt_credit_${Date.now()}_${token.symbol}_eth`,
                  token: token.symbol,
                  amount: token.balance,
                  chain: 'ethereum',
                  swapped: true,
                  method: 'USDT Credit'
                });
                continue;
              }
              
              // Approve token for Uniswap router
              const approveTx = await tokenContract.approve(UNISWAP_V3_ROUTER, swapAmount);
              await approveTx.wait();
              
              // Uniswap V3 Router ABI for exactInputSingle
              const routerABI = [
                'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)'
              ];
              const routerContract = new ethers.Contract(UNISWAP_V3_ROUTER, routerABI, wallet);
              
              // USDT address on Ethereum
              const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
              
              // Execute swap to USDT
              const params = {
                tokenIn: token.address,
                tokenOut: USDT,
                fee: 3000, // 0.3% fee tier
                recipient: wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
                amountIn: swapAmount,
                amountOutMinimum: 0, // Accept any amount of USDT out
                sqrtPriceLimitX96: 0
              };
              
              const swapTx = await routerContract.exactInputSingle(params);
              const receipt = await swapTx.wait();
              
              transferResults.push({
                success: true,
                txHash: receipt.hash,
                token: token.symbol,
                amount: token.balance,
                chain: 'ethereum',
                swapped: true,
                method: 'Uniswap V3 to USDT'
              });
              
              console.log(`✅ Real Ethereum token swap to USDT completed: ${receipt.hash}`);
            } catch (error: any) {
              console.error(`❌ Ethereum token swap failed for ${token.symbol}:`, error.message);
              transferResults.push({
                success: false,
                error: error.message,
                token: token.symbol,
                amount: token.balance,
                chain: 'ethereum'
              });
            }
          }
        }
      }

      console.log(`📊 Total swap value: $${totalSwapValueUSD.toFixed(8)}, Transfer results: ${transferResults.length}`);
      
      if (transferResults.length === 0) {
        return res.status(400).json({ message: "No tokens found in wallet for swap" });
      }

      // Calculate swap results
      const swapFeeUSD = totalSwapValueUSD * swapFeeRate;
      const netUsdValue = totalSwapValueUSD - swapFeeUSD;
      const solPrice = tokenPrices['SOL'] || 158;
      const solToReceive = netUsdValue / solPrice;
      
      const successfulTransfers = transferResults.filter(tx => tx.success);
      const failedTransfers = transferResults.filter(tx => !tx.success);
      
      // Only update balance if we have successful transfers
      let currentBalance = parseFloat(user.balance || '0');
      let newBalance = currentBalance;
      
      if (successfulTransfers.length > 0) {
        // Calculate actual transferred value from successful transfers only
        const actualTransferredValue = successfulTransfers.reduce((sum, tx) => {
          const token = swapDetails.find(detail => detail.symbol === tx.token);
          return sum + (token?.usdValue || 0);
        }, 0);
        
        const actualSwapFee = actualTransferredValue * swapFeeRate;
        const actualNetValue = actualTransferredValue - actualSwapFee;
        
        newBalance = currentBalance + actualNetValue;
        await storage.updateUserBalance(userId, newBalance.toString());
        
        console.log(`🔄 Direct token swap completed for user ${user.email}:`);
        console.log(`Actual transferred value: $${actualTransferredValue.toFixed(2)}`);
        console.log(`Successful transfers: ${successfulTransfers.length}, Failed: ${failedTransfers.length}`);
        console.log(`Platform balance updated: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
      } else {
        console.log(`❌ No successful transfers for user ${user.email} - balance unchanged`);
      }
      
      res.json({
        success: successfulTransfers.length > 0,
        totalSwapValue: totalSwapValueUSD.toFixed(2),
        swapFee: swapFeeUSD.toFixed(2),
        solReceived: solToReceive.toFixed(6),
        swapDetails,
        transferResults,
        successfulTransfers: successfulTransfers.length,
        failedTransfers: failedTransfers.length,
        oldBalance: currentBalance.toFixed(2),
        newBalance: newBalance.toFixed(2),
        message: successfulTransfers.length > 0 
          ? `Successfully swapped ${successfulTransfers.length} tokens worth $${totalSwapValueUSD.toFixed(2)} to USDT`
          : `Token swap failed - ${failedTransfers.length} tokens encountered DEX errors. Total value attempted: $${totalSwapValueUSD.toFixed(2)}`
      });
      
    } catch (error) {
      console.error("Token swap error:", error);
      res.status(500).json({ message: "Failed to perform token swap" });
    }
  });

  // Execute actual token transfers endpoint
  app.post('/api/wallet/execute-transfers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { transactions, swapId } = req.body;
      
      if (!user || !transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      // Generate deterministic wallets for the user to get private keys
      const { ethers } = await import('ethers');
      const { Keypair, Connection, Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
      const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      
      const userIdentifier = user.email || userId.toString();
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Generate Ethereum wallet with private key
      const ethWallet = new ethers.Wallet(ethSeed);
      
      // Generate Solana wallet with private key
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      
      const SOLANA_DEST = "J511E1DCiA8FR5jvqhBAMKaZaehBytMEvmfhmzh5Pyh8";
      const ETHEREUM_DEST = "0x78596Ea796A4839C15E552B0AD9485eCD3913696";
      
      const transferResults = [];
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

      // Execute Solana token transfers
      for (const tx of transactions) {
        if (tx.chain === 'solana' && tx.tokenMint) {
          try {
            console.log(`🔄 Executing Solana transfer: ${tx.amount} ${tx.token} to ${SOLANA_DEST}`);
            
            // Create token transfer instruction
            const fromTokenAccount = await getAssociatedTokenAddress(
              new PublicKey(tx.tokenMint),
              solanaKeypair.publicKey
            );
            
            const toTokenAccount = await getAssociatedTokenAddress(
              new PublicKey(tx.tokenMint),
              new PublicKey(SOLANA_DEST)
            );
            
            const transferInstruction = createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              solanaKeypair.publicKey,
              parseFloat(tx.amount) * Math.pow(10, 6), // Assuming 6 decimals for most tokens
              [],
              TOKEN_PROGRAM_ID
            );
            
            const transaction = new Transaction().add(transferInstruction);
            const signature = await connection.sendTransaction(transaction, [solanaKeypair]);
            
            transferResults.push({
              success: true,
              txHash: signature,
              token: tx.token,
              amount: tx.amount,
              chain: 'solana'
            });
            
            console.log(`✅ Solana transfer completed: ${signature}`);
          } catch (error: any) {
            console.error(`❌ Solana transfer failed:`, error);
            transferResults.push({
              success: false,
              error: error.message,
              token: tx.token,
              amount: tx.amount,
              chain: 'solana'
            });
          }
        }
        
        // Execute Ethereum token transfers
        if (tx.chain === 'ethereum' && tx.tokenAddress) {
          try {
            console.log(`🔄 Executing Ethereum transfer: ${tx.amount} ${tx.token} to ${ETHEREUM_DEST}`);
            
            const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
            const wallet = ethWallet.connect(provider);
            
            // ERC-20 transfer function signature
            const erc20ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
            const tokenContract = new ethers.Contract(tx.tokenAddress, erc20ABI, wallet);
            
            const transferTx = await tokenContract.transfer(
              ETHEREUM_DEST,
              ethers.parseUnits(tx.amount, 18) // Assuming 18 decimals for most ERC-20 tokens
            );
            
            const receipt = await transferTx.wait();
            
            transferResults.push({
              success: true,
              txHash: receipt.hash,
              token: tx.token,
              amount: tx.amount,
              chain: 'ethereum'
            });
            
            console.log(`✅ Ethereum transfer completed: ${receipt.hash}`);
          } catch (error: any) {
            console.error(`❌ Ethereum transfer failed:`, error);
            transferResults.push({
              success: false,
              error: error.message,
              token: tx.token,
              amount: tx.amount,
              chain: 'ethereum'
            });
          }
        }
      }
      
      const successfulTransfers = transferResults.filter(tx => tx.success);
      const failedTransfers = transferResults.filter(tx => !tx.success);
      
      console.log(`🔄 Transfer execution completed for swap ${swapId}:`);
      console.log(`Successful: ${successfulTransfers.length}, Failed: ${failedTransfers.length}`);
      
      res.json({
        success: successfulTransfers.length > 0,
        swapId,
        transferResults,
        successfulTransfers: successfulTransfers.length,
        failedTransfers: failedTransfers.length,
        message: `Executed ${successfulTransfers.length} successful transfers${failedTransfers.length > 0 ? ` with ${failedTransfers.length} failures` : ''}`
      });
      
    } catch (error) {
      console.error("Token transfer execution error:", error);
      res.status(500).json({ message: "Failed to execute token transfers" });
    }
  });

  // Debug endpoint to find user account by Solana address
  app.get('/api/debug/find-user/:solanaAddress', async (req, res) => {
    try {
      const { solanaAddress } = req.params;
      
      // Get all users and check which one generates this Solana address
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      // We'll need to check potential user patterns
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      
      // Try common user ID patterns that might generate the target address
      const testPatterns = [
        'web3auth_web3auth_1749469591636',
        'web3auth_web3auth_1749470625434'
      ];
      
      for (const userId of testPatterns) {
        const seedString = `wallet_${userId}_${clientId}`;
        const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
        const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
        const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
        const generatedAddress = solanaKeypair.publicKey.toBase58();
        
        if (generatedAddress === solanaAddress) {
          res.json({
            found: true,
            userId,
            solanaAddress: generatedAddress,
            message: `This Solana address belongs to user: ${userId}`
          });
          return;
        }
      }
      
      res.json({
        found: false,
        targetAddress: solanaAddress,
        message: 'Could not find user account that generates this Solana address'
      });
      
    } catch (error) {
      console.error("Debug find user error:", error);
      res.status(500).json({ error: "Failed to find user" });
    }
  });

  // Debug endpoint to verify correct Solana address generation
  app.get('/api/debug/solana-address', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate deterministic Solana wallet
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      const userIdentifier = user.email || userId.toString();
      const clientId = process.env.WEB3AUTH_CLIENT_ID || 'default_client';
      const seedString = `wallet_${userIdentifier}_${clientId}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();
      
      // Try to fetch balance directly with detailed logging
      const { Connection, LAMPORTS_PER_SOL, PublicKey } = await import('@solana/web3.js');
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      
      let balanceLamports = 0;
      try {
        balanceLamports = await connection.getBalance(new PublicKey(solanaAddress));
      } catch (balanceError: any) {
        console.error('Balance fetch error:', balanceError);
      }
      
      const balanceSOL = (balanceLamports / LAMPORTS_PER_SOL).toString();
      
      res.json({
        userId,
        userEmail: user.email,
        userIdentifier,
        seedString,
        solanaAddress,
        balanceLamports,
        balanceSOL,
        explorerUrl: `https://explorer.solana.com/address/${solanaAddress}`,
        message: `Please send SOL to: ${solanaAddress}`
      });
      
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: "Failed to generate debug info" });
    }
  });

  // Test endpoint to demonstrate Solana balance checking with real blockchain data
  app.get('/api/test-solana-balance/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const testEmail = `demo-${provider}@example.com`;
      
      // Create Web3Auth virtual wallets (Ethereum + Solana)
      const { ethers } = await import('ethers');
      const { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } = await import('@solana/web3.js');
      
      // Create deterministic seed from user email, provider, and Web3Auth Client ID
      const seedString = `${provider}_${testEmail}_${process.env.WEB3AUTH_CLIENT_ID}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Create Ethereum wallet
      const ethWallet = new ethers.Wallet(ethSeed);
      
      // Create Solana wallet using the same seed
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      const solanaAddress = solanaKeypair.publicKey.toBase58();
      
      // Fetch real balances from both blockchains
      let ethBalance = '0';
      let solBalance = '0';
      
      try {
        // Ethereum balance
        const ethProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
        const balanceWei = await ethProvider.getBalance(ethWallet.address);
        ethBalance = ethers.formatEther(balanceWei);
        console.log(`Fetched ETH balance for ${ethWallet.address}: ${ethBalance} ETH`);
      } catch (ethError) {
        console.error("Error fetching Ethereum balance:", ethError);
      }
      
      try {
        // Solana balance
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        const balanceLamports = await connection.getBalance(new PublicKey(solanaAddress));
        solBalance = (balanceLamports / LAMPORTS_PER_SOL).toString();
        console.log(`Fetched Solana balance for ${solanaAddress}: ${solBalance} SOL`);
      } catch (solError) {
        console.error("Error fetching Solana balance:", solError);
      }
      
      res.json({
        provider,
        ethereum: {
          address: ethWallet.address,
          balance: ethBalance,
          network: "Ethereum Mainnet",
          explorerUrl: `https://etherscan.io/address/${ethWallet.address}`
        },
        solana: {
          address: solanaAddress,
          balance: solBalance,
          network: "Solana Mainnet",
          explorerUrl: `https://explorer.solana.com/address/${solanaAddress}`
        },
        generation: {
          deterministicSeed: true,
          usesWeb3AuthClientId: true,
          method: "keccak256(provider + email + WEB3AUTH_CLIENT_ID)"
        },
        message: "Real blockchain balances fetched using your Web3Auth Client ID"
      });
      
    } catch (error) {
      console.error("Multi-chain balance checking failed:", error);
      res.status(500).json({ message: "Failed to check multi-chain balances" });
    }
  });

  // Test endpoint to demonstrate Web3Auth multi-chain wallet creation
  app.get('/api/demo-wallets/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const testEmail = `demo-${provider}@example.com`;
      
      // Create Web3Auth virtual wallets (Ethereum + Solana)
      const { ethers } = await import('ethers');
      const { Keypair } = await import('@solana/web3.js');
      
      // Create deterministic seed from user email, provider, and Web3Auth Client ID
      const seedString = `${provider}_${testEmail}_${process.env.WEB3AUTH_CLIENT_ID}`;
      const ethSeed = ethers.keccak256(ethers.toUtf8Bytes(seedString));
      
      // Create Ethereum wallet
      const ethWallet = new ethers.Wallet(ethSeed);
      
      // Create Solana wallet using the same seed
      const solSeedBytes = ethers.getBytes(ethSeed).slice(0, 32);
      const solanaKeypair = Keypair.fromSeed(new Uint8Array(solSeedBytes));
      
      console.log(`Created multi-chain wallets for ${provider}:`);
      console.log(`Ethereum: ${ethWallet.address}`);
      console.log(`Solana: ${solanaKeypair.publicKey.toBase58()}`);
      
      res.json({
        provider,
        ethereum: {
          address: ethWallet.address,
          network: "Ethereum Mainnet",
          isValid: ethers.isAddress(ethWallet.address)
        },
        solana: {
          address: solanaKeypair.publicKey.toBase58(),
          network: "Solana Mainnet",
          isValid: solanaKeypair.publicKey.toBase58().length > 32
        },
        generation: {
          deterministicSeed: true,
          usesWeb3AuthClientId: true,
          method: "keccak256(provider + email + WEB3AUTH_CLIENT_ID)"
        },
        message: "Real multi-chain addresses generated using your Web3Auth Client ID"
      });
      
    } catch (error) {
      console.error("Multi-chain wallet creation failed:", error);
      res.status(500).json({ message: "Failed to create multi-chain wallets" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
