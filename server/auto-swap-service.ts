import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { storage } from './storage';
import { getTokenPrices } from './price-service';

interface WalletState {
  userId: string;
  solanaTokens: { [mint: string]: string }; // mint -> balance
  ethereumTokens: { [address: string]: string }; // address -> balance
}

class AutoSwapService {
  private walletStates = new Map<string, WalletState>();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  // Tokens to ignore (won't be swapped)
  private readonly SOLANA_WHITELIST = new Set([
    'So11111111111111111111111111111111111111112', // SOL
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC (will be swapped to USDT)
  ]);
  
  private readonly ETHEREUM_WHITELIST = new Set([
    'ETH', // Native ETH
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0xA0b86a33E6441c5e65d74bb0C43F5B6f29ab0C51', // USDC (will be swapped to USDT)
  ]);

  async start() {
    if (this.isRunning) return;
    
    console.log('🔄 Starting Auto-Swap Service for token monitoring...');
    this.isRunning = true;
    
    // Initial scan of all users
    await this.scanAllUsers();
    
    // Set up periodic monitoring every 30 seconds
    this.intervalId = setInterval(() => {
      this.scanAllUsers().catch(console.error);
    }, 30000);
  }

  stop() {
    if (!this.isRunning) return;
    
    console.log('⏹️ Stopping Auto-Swap Service...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async scanAllUsers() {
    try {
      // Get all users from database
      const users = await this.getAllUsers();
      
      for (const user of users) {
        if (user.id.startsWith('web3auth_')) {
          await this.monitorUserWallet(user.id);
        }
      }
    } catch (error) {
      console.error('❌ Error scanning users:', error);
    }
  }

  private async getAllUsers() {
    // Get users who have made wallet requests recently (stored in memory)
    const recentUsers = Array.from(this.walletStates.keys());
    return recentUsers.map(id => ({ id }));
  }

  private async monitorUserWallet(userId: string) {
    try {
      const currentState = await this.getWalletState(userId);
      const previousState = this.walletStates.get(userId);
      
      if (!previousState) {
        // First time seeing this user, just store the state
        this.walletStates.set(userId, currentState);
        return;
      }
      
      // Check for new token deposits
      const newDeposits = this.detectNewDeposits(previousState, currentState);
      
      if (newDeposits.length > 0) {
        console.log(`💰 Detected new token deposits for user ${userId}:`, newDeposits);
        await this.executeAutoSwaps(userId, newDeposits);
      }
      
      // Update stored state
      this.walletStates.set(userId, currentState);
      
    } catch (error) {
      console.error(`❌ Error monitoring wallet for user ${userId}:`, error);
    }
  }

  private async getWalletState(userId: string): Promise<WalletState> {
    // Get user's deterministic wallets
    const { solanaKeypair, ethWallet } = this.generateWallets(userId);
    
    const state: WalletState = {
      userId,
      solanaTokens: {},
      ethereumTokens: {}
    };
    
    // Fetch Solana tokens
    try {
      const solanaTokens = await this.fetchSolanaTokens(solanaKeypair.publicKey.toString());
      for (const token of solanaTokens.tokens) {
        if (parseFloat(token.balance) > 0) {
          state.solanaTokens[token.mint] = token.balance;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch Solana tokens for ${userId}:`, error);
    }
    
    // Fetch Ethereum tokens
    try {
      const ethTokens = await this.fetchEthereumTokens(ethWallet.address);
      for (const token of ethTokens.tokens) {
        if (parseFloat(token.balance) > 0) {
          state.ethereumTokens[token.address] = token.balance;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch Ethereum tokens for ${userId}:`, error);
    }
    
    return state;
  }

  private detectNewDeposits(previous: WalletState, current: WalletState) {
    const newDeposits = [];
    
    // Check Solana tokens
    for (const [mint, balance] of Object.entries(current.solanaTokens)) {
      const prevBalance = parseFloat(previous.solanaTokens[mint] || '0');
      const currBalance = parseFloat(balance);
      
      // Skip whitelisted tokens
      if (this.SOLANA_WHITELIST.has(mint)) continue;
      
      if (currBalance > prevBalance) {
        newDeposits.push({
          chain: 'solana',
          mint,
          newAmount: (currBalance - prevBalance).toString(),
          totalAmount: balance
        });
      }
    }
    
    // Check Ethereum tokens
    for (const [address, balance] of Object.entries(current.ethereumTokens)) {
      const prevBalance = parseFloat(previous.ethereumTokens[address] || '0');
      const currBalance = parseFloat(balance);
      
      // Skip whitelisted tokens
      if (this.ETHEREUM_WHITELIST.has(address)) continue;
      
      if (currBalance > prevBalance) {
        newDeposits.push({
          chain: 'ethereum',
          address,
          newAmount: (currBalance - prevBalance).toString(),
          totalAmount: balance
        });
      }
    }
    
    return newDeposits;
  }

  private async executeAutoSwaps(userId: string, deposits: any[]) {
    try {
      console.log(`🔄 Auto-swapping ${deposits.length} new deposits for user ${userId}`);
      
      // Use the existing swap endpoint logic
      const response = await fetch(`http://localhost:5000/api/wallet/swap-to-usdt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // We'd need to simulate authentication for auto-swaps
          'User-Id': userId
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Auto-swap completed for user ${userId}:`, result.message);
      } else {
        console.error(`❌ Auto-swap failed for user ${userId}:`, response.statusText);
      }
      
    } catch (error) {
      console.error(`❌ Error executing auto-swap for user ${userId}:`, error);
    }
  }

  private generateWallets(userId: string) {
    // Same wallet generation logic as in routes.ts
    const crypto = require('crypto');
    const { Keypair } = require('@solana/web3.js');
    
    const seed = crypto.createHash('sha256').update(userId + 'deterministic_seed').digest();
    const solanaKeypair = Keypair.fromSeed(seed.slice(0, 32));
    
    const ethSeed = crypto.createHash('sha256').update(userId + 'eth_seed').digest('hex');
    const ethWallet = new ethers.Wallet(ethSeed);
    
    return { solanaKeypair, ethWallet };
  }

  private async fetchSolanaTokens(address: string) {
    // Simplified version of the token fetching logic
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const publicKey = new PublicKey(address);
    
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });
      
      const tokens = [];
      for (const account of tokenAccounts.value) {
        const tokenInfo = account.account.data.parsed.info;
        const balance = tokenInfo.tokenAmount.uiAmount || 0;
        
        if (balance > 0) {
          tokens.push({
            mint: tokenInfo.mint,
            balance: balance.toString(),
            decimals: tokenInfo.tokenAmount.decimals
          });
        }
      }
      
      return { tokens };
    } catch (error) {
      console.error('Error fetching Solana tokens:', error);
      return { tokens: [] };
    }
  }

  private async fetchEthereumTokens(address: string) {
    // Simplified Ethereum token fetching
    try {
      const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
      // This would need proper token detection logic
      return { tokens: [] };
    } catch (error) {
      console.error('Error fetching Ethereum tokens:', error);
      return { tokens: [] };
    }
  }
}

export const autoSwapService = new AutoSwapService();