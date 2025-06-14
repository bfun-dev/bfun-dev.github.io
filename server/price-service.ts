import memoize from 'memoizee';

interface TokenPrice {
  symbol: string;
  price: number;
  lastUpdated: number;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
  };
}

// Memoized price fetching function (cache for 5 minutes)
const fetchTokenPrices = memoize(
  async (): Promise<{ [symbol: string]: number }> => {
    try {
      // Use CoinGecko API for real-time prices
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,tether,usd-coin,raydium,jupiter-exchange-solana&vs_currencies=usd',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BetsFun/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: CoinGeckoResponse = await response.json();
      
      console.log('✅ Fetched current crypto prices from CoinGecko');
      
      return {
        'ETH': data['ethereum']?.usd || 3500,
        'SOL': data['solana']?.usd || 140,
        'USDT': data['tether']?.usd || 1,
        'USDC': data['usd-coin']?.usd || 1,
        'RAY': data['raydium']?.usd || 2.37,
        'JUP': data['jupiter-exchange-solana']?.usd || 0.47
      };
    } catch (error) {
      console.error('❌ Failed to fetch crypto prices:', error);
      
      // Fallback to recent approximate prices if API fails
      console.log('Using fallback prices...');
      return {
        'ETH': 3500,
        'SOL': 140,
        'USDT': 1,
        'USDC': 1,
        'RAY': 2.37,
        'JUP': 0.47
      };
    }
  },
  { maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
);

// Export function to get current token prices
export async function getTokenPrices(): Promise<{ [symbol: string]: number }> {
  return await fetchTokenPrices();
}

// Get price for a specific token
export async function getTokenPrice(symbol: string): Promise<number> {
  const prices = await getTokenPrices();
  return prices[symbol.toUpperCase()] || 0;
}

// Calculate USD value for a token amount
export async function calculateTokenUSDValue(symbol: string, amount: number): Promise<number> {
  const price = await getTokenPrice(symbol);
  return amount * price;
}