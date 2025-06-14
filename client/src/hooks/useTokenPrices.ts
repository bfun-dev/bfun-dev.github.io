import { useQuery } from "@tanstack/react-query";

interface TokenPrices {
  ETH: number;
  SOL: number;
  USDT: number;
  USDC: number;
  RAY: number;
  JUP: number;
}

export function useTokenPrices() {
  return useQuery<TokenPrices>({
    queryKey: ['/api/token-prices'],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

export function calculateTokenUSDValue(
  symbol: string, 
  amount: number, 
  prices: TokenPrices | undefined
): number {
  if (!prices) return 0;
  
  const price = prices[symbol as keyof TokenPrices];
  if (!price || price <= 0) return 0;
  
  return amount * price;
}