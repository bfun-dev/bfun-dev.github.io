import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Wallet, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ModalConfetti } from "@/components/confetti";
import type { MarketWithCategory } from "@shared/schema";
import { useTokenPrices, calculateTokenUSDValue } from "@/hooks/useTokenPrices";

interface BettingModalProps {
  open: boolean;
  onClose: () => void;
  market: MarketWithCategory;
  side: boolean; // true for YES, false for NO
}

export default function BettingModal({ open, onClose, market, side }: BettingModalProps) {
  const [amount, setAmount] = useState("10");
  const [selectedWallet, setSelectedWallet] = useState<"ethereum" | "solana" | null>(null);  
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: tokenPrices } = useTokenPrices();

  // Fetch wallet info to calculate total balance
  const { data: walletInfo } = useQuery<{
    ethereum?: {
      address: string;
      balance: string;
      tokens?: Array<{
        symbol: string;
        balance: string;
        name: string;
        decimals: number;
        logoURI?: string;
      }>;
    };
    solana?: {
      address: string;
      balance: string;
      tokens?: Array<{
        symbol: string;
        balance: string;
        name: string;
        decimals: number;
        logoURI?: string;
      }>;
    };
  }>({
    queryKey: ['/api/wallet'],
    enabled: !!user && open,
  });

  const calculateTotalBalance = () => {
    if (!walletInfo) return 0;
    
    let total = 0;
    
    // Ethereum balance
    if (walletInfo.ethereum?.balance) {
      total += parseFloat(walletInfo.ethereum.balance) * 3500; // ETH to USD
    }
    
    // Ethereum tokens
    if (walletInfo.ethereum?.tokens) {
      walletInfo.ethereum.tokens.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        if (token.symbol === 'USDT' || token.symbol === 'USDC') {
          total += balance; // 1:1 USD
        }
      });
    }
    
    // Solana balance
    if (walletInfo.solana?.balance) {
      total += parseFloat(walletInfo.solana.balance) * 140; // SOL to USD
    }
    
    // Solana tokens
    if (walletInfo.solana?.tokens) {
      walletInfo.solana.tokens.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        // Only include known tokens with established USD values
        if (token.symbol === 'USDT' || token.symbol === 'USDC') {
          total += balance; // 1:1 USD
        } else if (token.symbol === 'RAY') {
          total += balance * 2.50; // RAY to USD
        } else if (token.symbol === 'JUP') {
          total += balance * 0.85; // JUP to USD
        }
        // Skip unknown tokens (symbol === 'Unknown' or unrecognized tokens)
      });
    }
    
    return total;
  };

  const calculateWalletBalance = (walletType: "ethereum" | "solana") => {
    if (!walletInfo || !tokenPrices) return 0;
    
    let total = 0;
    
    if (walletType === "ethereum" && walletInfo.ethereum) {
      // Ethereum balance using real-time prices
      if (walletInfo.ethereum.balance) {
        total += calculateTokenUSDValue('ETH', parseFloat(walletInfo.ethereum.balance), tokenPrices);
      }
      
      // Ethereum tokens using real-time prices
      if (walletInfo.ethereum.tokens) {
        walletInfo.ethereum.tokens.forEach((token: any) => {
          const balance = parseFloat(token.balance || '0');
          const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
          if (usdValue > 0) {
            total += usdValue;
          }
        });
      }
    } else if (walletType === "solana" && walletInfo.solana) {
      // Solana balance using real-time prices
      if (walletInfo.solana.balance) {
        total += calculateTokenUSDValue('SOL', parseFloat(walletInfo.solana.balance), tokenPrices);
      }
      
      // Solana tokens using real-time prices
      if (walletInfo.solana.tokens) {
        walletInfo.solana.tokens.forEach((token: any) => {
          const balance = parseFloat(token.balance || '0');
          const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
          if (usdValue > 0) {
            total += usdValue;
          }
        });
      }
    }
    
    return total;
  };

  const getTokenUSDValue = (symbol: string, balance: number) => {
    if (!tokenPrices) return 0;
    return calculateTokenUSDValue(symbol, balance, tokenPrices);
  };

  const getAvailableTokens = () => {
    if (!selectedWallet || !walletInfo) return [];
    
    const tokens = [];
    
    if (selectedWallet === "ethereum" && walletInfo.ethereum) {
      // Add ETH if balance > 0
      if (parseFloat(walletInfo.ethereum.balance) > 0.001) { // Keep some for gas
        tokens.push({
          symbol: 'ETH',
          balance: parseFloat(walletInfo.ethereum.balance) - 0.001, // Reserve gas
          usdValue: getTokenUSDValue('ETH', parseFloat(walletInfo.ethereum.balance) - 0.001)
        });
      }
      
      // Add ERC-20 tokens
      walletInfo.ethereum.tokens?.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = getTokenUSDValue(token.symbol, balance);
        if (balance > 0 && usdValue >= 0.0001) {
          tokens.push({
            symbol: token.symbol,
            balance,
            usdValue
          });
        }
      });
    } else if (selectedWallet === "solana" && walletInfo.solana) {
      // Add SOL if balance > 0
      if (parseFloat(walletInfo.solana.balance) > 0.001) { // Keep some for gas
        tokens.push({
          symbol: 'SOL',
          balance: parseFloat(walletInfo.solana.balance) - 0.001, // Reserve gas
          usdValue: getTokenUSDValue('SOL', parseFloat(walletInfo.solana.balance) - 0.001)
        });
      }
      
      // Add SPL tokens
      walletInfo.solana.tokens?.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = getTokenUSDValue(token.symbol, balance);
        if (balance > 0 && usdValue >= 0.0001) {
          tokens.push({
            symbol: token.symbol,
            balance,
            usdValue
          });
        }
      });
    }
    
    return tokens;
  };

  const calculateSelectedTokensValue = () => {
    const availableTokens = getAvailableTokens();
    return selectedTokens.reduce((total, tokenSymbol) => {
      const token = availableTokens.find(t => t.symbol === tokenSymbol);
      return total + (token?.usdValue || 0);
    }, 0);
  };

  const toggleTokenSelection = (tokenSymbol: string) => {
    setSelectedTokens(prev => {
      if (prev.includes(tokenSymbol)) {
        return prev.filter(t => t !== tokenSymbol);
      } else {
        return [...prev, tokenSymbol];
      }
    });
  };

  const getWalletDisplayName = (walletType: "ethereum" | "solana") => {
    if (walletType === "ethereum") {
      return "Ethereum Wallet";
    }
    return "Solana Wallet";
  };

  const canAffordBet = () => {
    if (!selectedWallet || !walletInfo || selectedTokens.length === 0) return false;
    const selectedTokensValue = calculateSelectedTokensValue();
    return selectedTokensValue >= betAmount;
  };



  // Direct betting calculations without shares
  const betAmount = parseFloat(amount) || 0;
  const platformFee = betAmount * 0.02; // 2% platform fee
  const creatorFee = betAmount * 0.10; // 10% creator fee
  const totalFees = platformFee + creatorFee;
  const netStake = betAmount - totalFees; // Amount that goes into the betting pool
  
  // Calculate current probability from market prices (0.35 = 35% chance)
  const currentProbability = side ? parseFloat(market.yesPrice || "0.5") : parseFloat(market.noPrice || "0.5");
  const impliedProbability = currentProbability * 100;
  
  // Pool-based odds calculation for display
  const currentOdds = currentProbability > 0 ? 1 / currentProbability : 2;
  
  // Payout calculation based on NET STAKE (amount that goes into pool)
  const potentialWin = netStake * (currentOdds - 1); // Profit based on odds
  const totalPayout = netStake + potentialWin; // Total payout based on net stake

  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWallet) {
        throw new Error('Please select a wallet to place your bet');
      }
      
      if (!canAffordBet()) {
        throw new Error('Insufficient balance in selected wallet');
      }

      return apiRequest('POST', '/api/bets', {
        marketId: market.id,
        amount,
        side,
        walletType: selectedWallet,
        selectedTokens: selectedTokens,
      });
    },
    onSuccess: () => {
      // Trigger confetti animation
      setShowConfetti(true);
      
      toast({
        title: "Bet Placed Successfully! 🎉",
        description: `Your ${side ? 'YES' : 'NO'} bet of $${amount} has been placed successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/markets'] });
      queryClient.invalidateQueries({ queryKey: [`/api/markets/${market.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/markets/${market.id}/bets`] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bets/user'] });
      
      // Close modal after a short delay to let confetti play
      setTimeout(() => {
        onClose();
        setAmount("10");
        setSelectedWallet(null);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to place bet. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const betAmount = parseFloat(amount);
    const userBalance = calculateTotalBalance();
    
    if (betAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid bet amount.",
        variant: "destructive",
      });
      return;
    }
    
    if (betAmount > userBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough balance to place this bet. Available: $${userBalance.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    
    placeBetMutation.mutate();
  };

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAmount("10");
      setSelectedWallet(null);
      setShowConfetti(false);
    }
  }, [open]);

  const handleConfettiComplete = () => {
    setShowConfetti(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="gap-4 p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-w-[90vw] max-h-[90vh] w-[90vw] mx-4 fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 border shadow-xl z-[100] rounded-lg flex flex-col pl-[24px] pr-[24px] ml-[-1px] mr-[-1px]">
        <DialogHeader className="flex-shrink-0 p-4 pt-[0px] pb-[0px]">
          <DialogTitle className="text-lg font-semibold mt-[-5px] mb-[-5px]">
            Place Your Bet
          </DialogTitle>
        </DialogHeader>
        
        {/* Confetti Effect - inside dialog content */}
        <ModalConfetti 
          isActive={showConfetti} 
          onComplete={handleConfettiComplete} 
        />
        
        <div className={`flex-1 overflow-y-auto p-4 pt-0 space-y-3 ${isMobile ? 'space-y-2' : ''}`}>
          {/* Market Info */}
          <div>
            <h4 className="font-medium mb-1 text-sm">{market.title}</h4>
            <p className="text-xs text-neutral">
              You're betting that this will {side ? 'happen' : 'not happen'}
            </p>
          </div>

          {/* Odds Display */}
          <div className="rounded-lg p-3 border bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 pt-[8px] pb-[8px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">You're betting</div>
                <div className={`text-base font-bold ${side ? 'text-success' : 'text-error'}`}>
                  {side ? 'YES' : 'NO'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Odds</div>
                <div className="text-base font-bold">{currentOdds.toFixed(2)}x</div>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Implied probability: {impliedProbability.toFixed(1)}%
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Wallet Selection */}
            <div className="space-y-2 pt-[0px] pb-[0px] mt-[-10px] mb-[-10px]">
              <Label className="text-sm">Select Wallet to Pay From</Label>
              {!walletInfo ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Loading wallets...
                </div>
              ) : (
                <div className="grid gap-2">
                  {walletInfo.ethereum && (
                    <Button
                      type="button"
                      variant={selectedWallet === "ethereum" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedWallet("ethereum");
                        setSelectedTokens([]);
                      }}
                    >
                      <Wallet className="h-4 w-4 mr-2 text-blue-500" />
                      Ethereum Wallet
                    </Button>
                  )}
                  {walletInfo.solana && (
                    <Button
                      type="button"
                      variant={selectedWallet === "solana" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedWallet("solana");
                        setSelectedTokens([]);
                      }}
                    >
                      <Wallet className="h-4 w-4 mr-2 text-purple-500" />
                      Solana Wallet
                    </Button>
                  )}
                </div>
              )}
              
              {/* Token Selection Buttons */}
              {selectedWallet && walletInfo && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">Select tokens to use for betting:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableTokens().map((token, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant={selectedTokens.includes(token.symbol) ? "default" : "outline"}
                        size="sm"
                        className="flex flex-col h-auto p-2 text-xs"
                        onClick={() => toggleTokenSelection(token.symbol)}
                      >
                        <div className="font-medium">{token.symbol}</div>
                        <div className="text-xs opacity-75">
                          {token.balance.toFixed(token.symbol === 'SOL' || token.symbol === 'ETH' ? 6 : 4)} {token.symbol}
                        </div>
                      </Button>
                    ))}
                  </div>
                  
                  {selectedTokens.length > 0 && (
                    <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs">
                      <div className="font-medium text-green-700 dark:text-green-300">
                        Selected tokens:
                      </div>
                      <div className="text-green-600 dark:text-green-400">
                        {getAvailableTokens()
                          .filter(token => selectedTokens.includes(token.symbol))
                          .map(token => `${token.balance.toFixed(token.symbol === 'SOL' || token.symbol === 'ETH' ? 6 : 4)} ${token.symbol}`)
                          .join(', ')}
                      </div>
                      <div className="text-green-600 dark:text-green-400 mt-1">
                        Total USD value: ${calculateSelectedTokensValue().toFixed(2)}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Address: {selectedWallet === "ethereum" 
                      ? `${walletInfo.ethereum?.address.slice(0, 6)}...${walletInfo.ethereum?.address.slice(-4)}`
                      : `${walletInfo.solana?.address.slice(0, 6)}...${walletInfo.solana?.address.slice(-4)}`
                    }
                  </div>
                </div>
              )}
              
              {selectedWallet && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                    <ArrowRight className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-700 dark:text-blue-300">
                      Net bet amount (${netStake.toFixed(4)}) → Betting pool
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs">
                    <ArrowRight className="h-3 w-3 text-orange-500" />
                    <span className="text-orange-700 dark:text-orange-300">
                      Platform fees (${totalFees.toFixed(4)}) → Fee collection
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedTokens.length > 0 ? calculateSelectedTokensValue().toString() : "0"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                  disabled={!selectedWallet || selectedTokens.length === 0}
                />
              </div>
              {selectedTokens.length > 0 ? (
                <p className="text-xs text-neutral">
                  Available from selected tokens: ${calculateSelectedTokensValue().toFixed(2)}
                </p>
              ) : selectedWallet ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Please select tokens to use for betting
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Please select a wallet and tokens first
                </p>
              )}
            </div>

            {/* Betting Summary */}
            <Card className="bg-muted/50 dark:bg-muted/20">
              <CardContent className="pt-2 pb-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Stake</span>
                  <span className="font-medium">${betAmount.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Platform Fee (2%)</span>
                  <span className="font-medium text-red-400">-${platformFee.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Creator Fee (10%)</span>
                  <span className="font-medium text-red-400">-${creatorFee.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-border pt-1">
                  <span>Net Stake</span>
                  <span className="font-medium">${netStake.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Odds (after fees)</span>
                  <span className="font-medium">{currentOdds.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Potential Win</span>
                  <span className="font-medium text-success">${potentialWin.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-border">
                  <span>Total Payout</span>
                  <span className="font-medium text-success">${totalPayout.toFixed(4)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                placeBetMutation.isPending || 
                !amount || 
                parseFloat(amount) <= 0 || 
                !selectedWallet ||
                selectedTokens.length === 0 ||
                !canAffordBet()
              }
            >
              {placeBetMutation.isPending ? "Processing Transfer..." : 
               !selectedWallet ? "Select Wallet First" :
               selectedTokens.length === 0 ? "Select Tokens First" :
               !canAffordBet() ? "Insufficient Token Balance" :
               "Confirm Bet"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
