import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Eye, EyeOff, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Shield, Globe, Key, Plus, Minus, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useTokenPrices, calculateTokenUSDValue } from "@/hooks/useTokenPrices";
import TransactionApprovalModal from "@/components/transaction-approval-modal";

interface TokenInfo {
  address?: string;
  mint?: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logoURI?: string;
}

interface WalletInfo {
  ethereum: {
    address: string;
    balance: string;
    network: string;
    balanceUSD?: string;
    tokens: TokenInfo[];
  };
  solana?: {
    address: string;
    balance: string;
    network: string;
    balanceUSD?: string;
    tokens: TokenInfo[];
  } | null;
  totalBalanceUSD: string;
  transactions: Transaction[];
  web3AuthProvider?: string;
  verifier?: string;
  privateKey?: string;
  mnemonic?: string;
  isVirtualWallet?: boolean;
}

interface Transaction {
  id: string;
  type: 'bet_yes' | 'bet_no' | 'win' | 'loss';
  amount: string;
  timestamp: Date;
  status: 'pending' | 'win' | 'loss';
  description: string;
}

export default function WalletPage() {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [transferType, setTransferType] = useState<'eth' | 'sol'>('eth');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [solanaQrCodeDataUrl, setSolanaQrCodeDataUrl] = useState<string>('');
  const [isMonitoringDeposit, setIsMonitoringDeposit] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSolanaDepositModal, setShowSolanaDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [swapData, setSwapData] = useState<any>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [lastKnownBalance, setLastKnownBalance] = useState<{ 
    eth: string; 
    sol: string; 
    ethTokens: TokenInfo[];
    solTokens: TokenInfo[];
  }>({ 
    eth: '0', 
    sol: '0', 
    ethTokens: [],
    solTokens: []
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: tokenPrices } = useTokenPrices();

  const { data: walletInfo, isLoading, refetch } = useQuery<WalletInfo>({
    queryKey: ['/api/wallet'],
    enabled: !!user,
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, type }: { amount: string; type: 'eth' | 'sol' }) => {
      return await apiRequest('POST', '/api/wallet/withdraw', { amount, type });
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Successful",
        description: "Funds have been transferred to your blockchain wallet",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setWithdrawAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async ({ amount, type }: { amount: string; type: 'eth' | 'sol' }) => {
      return await apiRequest('POST', '/api/wallet/deposit', { amount, type });
    },
    onSuccess: () => {
      toast({
        title: "Deposit Successful", 
        description: "Funds have been transferred to your platform balance",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setDepositAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to process deposit",
        variant: "destructive",
      });
    },
  });

  const handleRefreshBalance = async () => {
    toast({
      title: "Refreshing Balance",
      description: "Fetching latest balance from blockchain...",
    });
    try {
      await refetch();
      toast({
        title: "Balance Updated",
        description: "Latest balance fetched successfully",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not fetch latest balance",
        variant: "destructive",
      });
    }
  };

  const swapMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallet/swap-to-usdt');
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Token Swap Completed",
          description: `Successfully converted ${data.successfulTransfers} tokens worth $${data.totalSwapValue} to USDT`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        setShowSwapModal(false);
      } else {
        toast({
          title: "Swap Failed",
          description: data.message || "No tokens available for swap",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Swap error:', error);
      toast({
        title: "Swap Failed",
        description: "Failed to execute token swaps",
        variant: "destructive",
      });
    },
  });

  const handleTransactionApproval = async () => {
    try {
      setSwapLoading(true);
      
      // Call the actual transfer endpoint to execute blockchain transactions
      const response = await apiRequest('POST', '/api/wallet/execute-transfers', {
        transactions: pendingTransactions,
        swapId: swapData?.swapId || Date.now().toString()
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Token Swap Completed",
          description: `Successfully transferred tokens and received ${swapData?.solReceived} SOL equivalent.`,
        });
        
        // Refresh wallet data to show updated balances
        queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        
        setShowTransactionModal(false);
        setSwapData(null);
        setPendingTransactions([]);
      } else {
        throw new Error(result.message || "Transfer execution failed");
      }
    } catch (error: any) {
      toast({
        title: "Transaction Failed", 
        description: error.message || "Failed to execute token transfers",
        variant: "destructive",
      });
    } finally {
      setSwapLoading(false);
    }
  };

  const handleSwapToSol = () => {
    swapMutation.mutate();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string, currency = 'ETH') => {
    const numBalance = parseFloat(balance);
    // Convert crypto amounts to approximate USD values for display
    let usdValue = 0;
    if (currency === 'ETH') {
      usdValue = numBalance * 3500; // Approximate ETH price
    } else if (currency === 'SOL') {
      usdValue = numBalance * 140; // Approximate SOL price
    } else {
      usdValue = numBalance; // Assume already in USD
    }
    return `$${usdValue.toFixed(2)}`;
  };

  const solanaTokens = [
    { symbol: 'USDT', name: 'Tether USD', icon: '💰', color: 'bg-green-500' },
    { symbol: 'USDC', name: 'USD Coin', icon: 'U', color: 'bg-blue-500' },
    { symbol: 'SOL', name: 'Solana', icon: 'S', color: 'bg-gradient-to-r from-purple-400 to-green-500' },
    { symbol: 'RAY', name: 'Raydium', icon: 'R', color: 'bg-blue-600' },
    { symbol: 'JUP', name: 'Jupiter', icon: 'J', color: 'bg-orange-500' },
  ];

  const getTokenInfo = (symbol: string) => {
    return solanaTokens.find(token => token.symbol === symbol) || solanaTokens[1]; // Default to USDC
  };

  const calculateTotalPlatformBalance = () => {
    if (!walletInfo || !tokenPrices) return 0;
    
    let total = 0;
    
    // Ethereum balance
    if (walletInfo.ethereum?.balance) {
      total += calculateTokenUSDValue('ETH', parseFloat(walletInfo.ethereum.balance), tokenPrices);
    }
    
    // Ethereum tokens
    if (walletInfo.ethereum?.tokens) {
      walletInfo.ethereum.tokens.forEach(token => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
        if (usdValue > 0) {
          total += usdValue;
        }
      });
    }
    
    // Solana balance
    if (walletInfo.solana?.balance) {
      total += calculateTokenUSDValue('SOL', parseFloat(walletInfo.solana.balance), tokenPrices);
    }
    
    // Solana tokens
    if (walletInfo.solana?.tokens) {
      walletInfo.solana.tokens.forEach(token => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
        if (usdValue > 0) {
          total += usdValue;
        }
      });
    }
    
    return total;
  };

  const calculateSolanaTotalUSD = (solanaWallet: WalletInfo['solana']): string => {
    if (!solanaWallet || !tokenPrices) return '0.00';
    
    // SOL balance in USD using real-time prices
    const solBalance = calculateTokenUSDValue('SOL', parseFloat(solanaWallet.balance || '0'), tokenPrices);
    
    // SPL tokens balance in USD using real-time prices
    const tokensBalance = solanaWallet.tokens?.reduce((total, token) => {
      const tokenBalance = parseFloat(token.balance || '0');
      const tokenUsdValue = calculateTokenUSDValue(token.symbol, tokenBalance, tokenPrices);
      return total + tokenUsdValue;
    }, 0) || 0;
    
    const totalUsd = solBalance + tokensBalance;
    return totalUsd.toFixed(2);
  };

  // Generate QR code for wallet address
  const generateQRCode = async (address: string, type: 'ethereum' | 'solana') => {
    try {
      const qrDataUrl = await QRCode.toDataURL(address, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      if (type === 'ethereum') {
        setQrCodeDataUrl(qrDataUrl);
      } else {
        setSolanaQrCodeDataUrl(qrDataUrl);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Monitor wallet balance for incoming deposits
  const startDepositMonitoring = () => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }

    setIsMonitoringDeposit(true);
    
    // Store current balances as baseline including all tokens
    if (walletInfo) {
      setLastKnownBalance({
        eth: walletInfo.ethereum?.balance || '0',
        sol: walletInfo.solana?.balance || '0',
        ethTokens: walletInfo.ethereum?.tokens || [],
        solTokens: walletInfo.solana?.tokens || []
      });
    }

    // Check for balance changes every 10 seconds
    monitoringIntervalRef.current = setInterval(async () => {
      try {
        // Refetch wallet data to get latest balances
        const freshWalletData = await refetch();
        
        if (freshWalletData.data) {
          const newEthBalance = freshWalletData.data.ethereum?.balance || '0';
          const newSolBalance = freshWalletData.data.solana?.balance || '0';
          const newEthTokens = freshWalletData.data.ethereum?.tokens || [];
          const newSolTokens = freshWalletData.data.solana?.tokens || [];
          
          // Check if ETH balance increased (ignore tiny changes under $0.01)
          const ethDiff = parseFloat(newEthBalance) - parseFloat(lastKnownBalance.eth);
          if (ethDiff > 0.000003) { // ~$0.01 worth of ETH at current prices
            await handleDepositDetected(ethDiff.toString(), 'ETH');
            setLastKnownBalance(prev => ({ ...prev, eth: newEthBalance }));
          }
          
          // Check if SOL balance increased (ignore tiny changes under $0.01)
          const solDiff = parseFloat(newSolBalance) - parseFloat(lastKnownBalance.sol);
          if (solDiff > 0.00007) { // ~$0.01 worth of SOL at current prices
            await handleDepositDetected(solDiff.toString(), 'SOL');
            setLastKnownBalance(prev => ({ ...prev, sol: newSolBalance }));
          }

          // Check for ETH token balance changes and new tokens
          newEthTokens.forEach(newToken => {
            const tokenId = newToken.address || newToken.mint;
            const oldToken = lastKnownBalance.ethTokens.find(t => (t.address || t.mint) === tokenId);
            if (!oldToken) {
              // New token detected (ignore amounts under $0.01)
              if (parseFloat(newToken.balance) >= 0.01) {
                handleDepositDetected(newToken.balance, newToken.symbol || 'Unknown Token');
              }
            } else {
              const tokenDiff = parseFloat(newToken.balance) - parseFloat(oldToken.balance);
              // Existing token balance increased (ignore tiny changes under $0.01)
              if (tokenDiff >= 0.01) {
                handleDepositDetected(tokenDiff.toString(), newToken.symbol || 'Unknown Token');
              }
            }
          });

          // Check for SOL token balance changes and new tokens
          newSolTokens.forEach(newToken => {
            const tokenId = newToken.mint || newToken.address;
            const oldToken = lastKnownBalance.solTokens.find(t => (t.mint || t.address) === tokenId);
            
            if (!oldToken) {
              // New token detected (ignore amounts under $0.01)
              if (parseFloat(newToken.balance) >= 0.01) {
                handleDepositDetected(newToken.balance, newToken.symbol || 'Unknown Token');
              }
            } else {
              const tokenDiff = parseFloat(newToken.balance) - parseFloat(oldToken.balance);
              // Existing token balance increased (ignore tiny changes under $0.01)
              if (tokenDiff >= 0.01) {
                handleDepositDetected(tokenDiff.toString(), newToken.symbol || 'Unknown Token');
              }
            }
          });

          // Update stored balances
          setLastKnownBalance({
            eth: newEthBalance,
            sol: newSolBalance,
            ethTokens: newEthTokens,
            solTokens: newSolTokens
          });
        }
      } catch (error) {
        console.error('Error monitoring wallet balance:', error);
      }
    }, 10000); // Check every 10 seconds

    // Stop monitoring after 30 minutes to prevent indefinite polling
    setTimeout(() => {
      stopDepositMonitoring();
    }, 30 * 60 * 1000);
  };

  const stopDepositMonitoring = () => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    setIsMonitoringDeposit(false);
  };

  const handleDepositDetected = async (amount: string, currency: string) => {
    try {
      // Convert the detected amount to USD equivalent for platform balance
      let usdAmount = 0;
      if (currency === 'ETH') {
        usdAmount = parseFloat(amount) * 3500; // ETH price approximation
      } else if (currency === 'SOL') {
        usdAmount = parseFloat(amount) * 140; // SOL price approximation
      } else if (currency === 'USDC' || currency === 'USDT') {
        usdAmount = parseFloat(amount); // Stablecoins are 1:1 with USD
      } else if (currency === 'RAY') {
        usdAmount = parseFloat(amount) * 2; // Raydium approximation
      } else if (currency === 'JUP') {
        usdAmount = parseFloat(amount) * 1; // Jupiter approximation
      } else {
        // For unknown tokens, use conservative 1:1 USD estimate
        usdAmount = parseFloat(amount) * 1;
      }

      // Update platform balance - always specify correct chain type
      const chainType = (currency === 'ETH' || currency.startsWith('ETH-')) ? 'eth' : 'sol';
      await depositMutation.mutateAsync({ 
        amount: usdAmount.toString(), 
        type: chainType
      });

      // Show success notification
      toast({
        title: "Deposit Successful!",
        description: `${amount} ${currency} (${formatBalance(usdAmount.toString())}) has been added to your platform balance`,
        duration: 5000,
      });

      // Stop monitoring after successful deposit
      stopDepositMonitoring();
      
    } catch (error) {
      console.error('Error processing detected deposit:', error);
    }
  };

  // Generate QR codes when wallet info changes
  useEffect(() => {
    if (walletInfo?.ethereum?.address) {
      generateQRCode(walletInfo.ethereum.address, 'ethereum');
    }
    if (walletInfo?.solana?.address) {
      generateQRCode(walletInfo.solana.address, 'solana');
    }
  }, [walletInfo]);

  // Cleanup monitoring on component unmount
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="text-muted-foreground">Loading wallet information...</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!walletInfo) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="text-muted-foreground">Unable to load wallet information</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Wallet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">My Wallet</h1>
          <p className="text-muted-foreground">Manage your crypto wallet and view transaction history</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Wallet Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Overview
              </CardTitle>
              <CardDescription>Your current wallet balance and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Always show wallet type info for consistency */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">
                      {walletInfo.web3AuthProvider ? 'Web3Auth Virtual Wallet' : 'Multi-Chain Wallet'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {walletInfo.web3AuthProvider 
                        ? `Authenticated via ${walletInfo.web3AuthProvider} • ${walletInfo.verifier || 'Decentralized Identity'}`
                        : 'Secure blockchain wallet with multi-chain support'
                      }
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    <Globe className="h-3 w-3 mr-1" />
                    Multi-Chain
                  </Badge>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {walletInfo.isVirtualWallet ? 'Virtual Wallet Balances' : 'Multi-Chain Balances'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSwapModal(true)}
                      disabled={swapMutation.isPending}
                    >
                      <ArrowLeftRight className="h-3 w-3 mr-1" />
                      Convert to USDT
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshBalance}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                {/* Ethereum Balance */}
                <div className="border rounded-lg p-4 mb-3 bg-white/50 dark:bg-black/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">ETH</div>
                      <span className="font-medium">Ethereum</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-7 sm:text-sm sm:px-3 sm:py-2 sm:h-8"
                            onClick={() => {
                              setTransferType('eth');
                              setShowDepositModal(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Deposit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader className="text-center">
                            <DialogTitle className="text-xl font-semibold">Transfer Crypto</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                              Platform Balance: ${parseFloat(user?.balance || '0').toFixed(2)}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-6">
                            {/* Token and Chain Selection */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium mb-2 block">Supported token</label>
                                <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">U</span>
                                  </div>
                                  <span className="text-sm font-medium">USDC</span>
                                  <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-2 block">Supported chain</label>
                                <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                                      <polygon fill="currentColor" points="127.9611,0 125.1661,9.5 125.1661,285.168 127.9611,287.958 255.9231,212.32"/>
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium">Ethereum</span>
                                  <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* QR Code */}
                            <div className="flex justify-center">
                              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                                  {qrCodeDataUrl ? (
                                    <img 
                                      src={qrCodeDataUrl} 
                                      alt="Wallet Address QR Code" 
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Deposit Address */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Your deposit address</span>
                                <span className="text-xs text-blue-600 underline cursor-pointer">Terms apply</span>
                              </div>
                              <div className="bg-muted/30 rounded-lg p-3">
                                <div className="text-xs text-muted-foreground break-all mb-2 font-mono">
                                  {walletInfo?.ethereum?.address || '0x922A7Cd5FdC532D3a84343D3A5a019AcAd454911'}
                                </div>
                                <div className="space-y-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => copyToClipboard(walletInfo?.ethereum?.address || '0x922A7Cd5FdC532D3a84343D3A5a019AcAd454911', 'Deposit address')}
                                  >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy address
                                  </Button>
                                  
                                  {!isMonitoringDeposit ? (
                                    <Button 
                                      size="sm" 
                                      className="w-full bg-green-600 hover:bg-green-700"
                                      onClick={startDepositMonitoring}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      Confirm Deposit
                                    </Button>
                                  ) : (
                                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                                          Monitoring for deposits...
                                        </span>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-xs"
                                        onClick={stopDepositMonitoring}
                                      >
                                        Stop
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs px-2 py-1 h-7 sm:text-sm sm:px-3 sm:py-2 sm:h-8"
                        onClick={() => {
                          setTransferType('eth');
                          setShowWithdrawModal(true);
                        }}
                      >
                        <Minus className="h-3 w-3 mr-1" />
                        Withdraw
                      </Button>
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{formatBalance(walletInfo?.ethereum?.balance || '0', 'ETH')}</div>
                  <div className="text-sm text-muted-foreground">
                    {walletInfo?.ethereum?.network === 'Internal Balance' ? 'Platform Balance' : 'Blockchain Wallet'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Platform Balance: ${calculateTotalPlatformBalance().toFixed(2)}
                  </div>
                  {walletInfo?.ethereum?.address && walletInfo.ethereum.address !== 'Not connected' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Live balance from {walletInfo.ethereum.network}
                    </div>
                  )}
                  
                  {/* ETH Balance */}
                  {walletInfo?.ethereum && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-sm font-medium mb-2">Native Balance</div>
                      {walletInfo.ethereum.balance && parseFloat(walletInfo.ethereum.balance) > 0 ? (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">E</div>
                            <span className="text-sm font-medium">ETH</span>
                            <span className="text-xs text-muted-foreground">Ethereum</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-mono">{parseFloat(walletInfo.ethereum.balance).toFixed(6)}</span>
                            {tokenPrices && (
                              <span className="text-xs text-muted-foreground">
                                ${calculateTokenUSDValue('ETH', parseFloat(walletInfo.ethereum.balance), tokenPrices).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">E</div>
                            <span className="text-sm font-medium">ETH</span>
                            <span className="text-xs text-muted-foreground">Ethereum</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-mono">0.000000</span>
                            <span className="text-xs text-muted-foreground">$0.00</span>
                          </div>
                        </div>
                      )}
                      {(!walletInfo.ethereum.balance || parseFloat(walletInfo.ethereum.balance) < 0.001) && (
                        <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                              <div className="text-xs font-medium text-orange-700 dark:text-orange-300">Low ETH Balance</div>
                              <div className="text-xs text-orange-600 dark:text-orange-400">Bets may fail due to Transaction failure</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ERC-20 Tokens */}
                  {walletInfo?.ethereum?.tokens && walletInfo.ethereum.tokens.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-sm font-medium mb-2">ERC-20 Tokens</div>
                      <div className="space-y-2">
                        {walletInfo.ethereum.tokens
                          .filter(token => {
                            // Filter out tokens with USD value less than $0.0001
                            if (!tokenPrices) return true;
                            const usdValue = calculateTokenUSDValue(token.symbol, parseFloat(token.balance), tokenPrices);
                            return usdValue >= 0.0001;
                          })
                          .map((token, index) => (
                          <div key={token.address || index} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              {token.logoURI ? (
                                <img src={token.logoURI} alt={token.symbol} className="w-4 h-4 rounded-full" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">
                                  {token.symbol.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-medium">{token.symbol}</span>
                              <span className="text-xs text-muted-foreground">{token.name}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-mono">{parseFloat(token.balance).toFixed(4)}</span>
                              {tokenPrices && (
                                <span className="text-xs text-muted-foreground">
                                  ${calculateTokenUSDValue(token.symbol, parseFloat(token.balance), tokenPrices).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Solana Balance */}
                {walletInfo?.solana && (
                  <div className="border rounded-lg p-4 bg-white/50 dark:bg-black/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">SOL</div>
                        <span className="font-medium">Solana</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Dialog open={showSolanaDepositModal} onOpenChange={setShowSolanaDepositModal}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-7 sm:text-sm sm:px-3 sm:py-2 sm:h-8"
                              onClick={() => {
                                setTransferType('sol');
                                setShowSolanaDepositModal(true);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Deposit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader className="text-center">
                              <DialogTitle className="text-xl font-semibold">Transfer Crypto</DialogTitle>
                              <DialogDescription className="text-sm text-muted-foreground">
                                Platform Balance: ${parseFloat(user?.balance || '0').toFixed(2)}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              {/* Token and Chain Selection */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Supported token</label>
                                  <div className="relative" ref={dropdownRef}>
                                    <div 
                                      className="flex items-center gap-2 p-3 border rounded-lg bg-background cursor-pointer"
                                      onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                                    >
                                      {(() => {
                                        const tokenInfo = getTokenInfo(selectedToken);
                                        return (
                                          <>
                                            <div className={`w-6 h-6 rounded-full ${tokenInfo.color} flex items-center justify-center`}>
                                              <span className="text-white text-xs font-bold">{selectedToken.charAt(0)}</span>
                                            </div>
                                            <span className="text-sm font-medium">{selectedToken}</span>
                                            {showTokenDropdown ? (
                                              <svg className="w-4 h-4 ml-auto text-muted-foreground transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            ) : (
                                              <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                    
                                    {showTokenDropdown && (
                                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10">
                                        {solanaTokens.map((token) => (
                                          <div 
                                            key={token.symbol}
                                            className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer first:rounded-t-lg last:rounded-b-lg"
                                            onClick={() => {
                                              setSelectedToken(token.symbol);
                                              setShowTokenDropdown(false);
                                            }}
                                          >
                                            <div className={`w-6 h-6 rounded-full ${token.color} flex items-center justify-center`}>
                                              <span className="text-white text-xs font-bold">{token.symbol.charAt(0)}</span>
                                            </div>
                                            <span className="text-sm font-medium">{token.symbol}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Supported chain</label>
                                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
                                      <span className="text-white text-xs font-bold">S</span>
                                    </div>
                                    <span className="text-sm font-medium">Solana</span>
                                    <svg className="w-4 h-4 ml-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>

                              {/* QR Code */}
                              <div className="flex justify-center">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                                    {solanaQrCodeDataUrl ? (
                                      <img 
                                        src={solanaQrCodeDataUrl} 
                                        alt="Solana Wallet Address QR Code" 
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Deposit Address */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">Your deposit address</span>
                                  <span className="text-xs text-blue-600 underline cursor-pointer">Terms apply</span>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                  <div className="text-xs text-muted-foreground break-all mb-2 font-mono">
                                    {walletInfo?.solana?.address || 'FLAMuYtDQBrhmRwm2an3R6g2SogjFr6iMRGs8ecznNuZ'}
                                  </div>
                                  <div className="space-y-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="w-full"
                                      onClick={() => copyToClipboard(walletInfo?.solana?.address || 'FLAMuYtDQBrhmRwm2an3R6g2SogjFr6iMRGs8ecznNuZ', 'Deposit address')}
                                    >
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy address
                                    </Button>
                                    
                                    {!isMonitoringDeposit ? (
                                      <Button 
                                        size="sm" 
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={startDepositMonitoring}
                                      >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Confirm Deposit
                                      </Button>
                                    ) : (
                                      <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                          <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                                            Monitoring for deposits...
                                          </span>
                                        </div>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 px-2 text-xs"
                                          onClick={stopDepositMonitoring}
                                        >
                                          Stop
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-xs px-2 py-1 h-7 sm:text-sm sm:px-3 sm:py-2 sm:h-8"
                          onClick={() => {
                            setTransferType('sol');
                            setShowWithdrawModal(true);
                          }}
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          Withdraw
                        </Button>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">${calculateSolanaTotalUSD(walletInfo.solana)}</div>
                    <div className="text-sm text-muted-foreground">
                      Blockchain Wallet
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Platform Balance: ${calculateTotalPlatformBalance().toFixed(2)}
                    </div>
                    
                    {/* SOL Balance */}
                    {walletInfo.solana && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="text-sm font-medium mb-2">Native Balance</div>
                        {walletInfo.solana.balance && parseFloat(walletInfo.solana.balance) > 0 ? (
                          <div className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">S</div>
                              <span className="text-sm font-medium">SOL</span>
                              <span className="text-xs text-muted-foreground">Solana</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-mono">{parseFloat(walletInfo.solana.balance).toFixed(6)}</span>
                              {tokenPrices && (
                                <span className="text-xs text-muted-foreground">
                                  ${calculateTokenUSDValue('SOL', parseFloat(walletInfo.solana.balance), tokenPrices).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">S</div>
                              <span className="text-sm font-medium">SOL</span>
                              <span className="text-xs text-muted-foreground">Solana</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-mono">0.000000</span>
                              <span className="text-xs text-muted-foreground">$0.00</span>
                            </div>
                          </div>
                        )}
                        {(!walletInfo.solana.balance || parseFloat(walletInfo.solana.balance) < 0.0015) && (
                          <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-xs font-medium text-orange-700 dark:text-orange-300">Low SOL Balance</div>
                                <div className="text-xs text-orange-600 dark:text-orange-400">Bets may fail due to Transaction failure</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SPL Tokens */}
                    {walletInfo.solana?.tokens && walletInfo.solana.tokens.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="text-sm font-medium mb-2">SPL Tokens</div>
                        <div className="space-y-2">
                          {walletInfo.solana?.tokens
                            .filter(token => {
                              // Filter out tokens with USD value less than $0.0001
                              if (!tokenPrices) return true;
                              const usdValue = calculateTokenUSDValue(token.symbol, parseFloat(token.balance), tokenPrices);
                              return usdValue >= 0.0001;
                            })
                            .map((token, index) => (
                            <div key={token.mint || index} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                {token.logoURI ? (
                                  <img src={token.logoURI} alt={token.symbol} className="w-4 h-4 rounded-full" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">
                                    {token.symbol.charAt(0)}
                                  </div>
                                )}
                                <span className="text-sm font-medium">{token.symbol}</span>
                                <span className="text-xs text-muted-foreground">{token.name}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-mono">{parseFloat(token.balance).toFixed(4)}</span>
                                {tokenPrices && (
                                  <span className="text-xs text-muted-foreground">
                                    ${calculateTokenUSDValue(token.symbol, parseFloat(token.balance), tokenPrices).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Ethereum Address */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Ethereum Address</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                      {walletInfo?.ethereum?.address === 'Not connected' ? 'Not connected' : formatAddress(walletInfo?.ethereum?.address || '')}
                    </code>
                    {walletInfo?.ethereum?.address && walletInfo.ethereum.address !== 'Not connected' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(walletInfo.ethereum.address, "Ethereum address")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://etherscan.io/address/${walletInfo.ethereum.address}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Solana Address */}
                {walletInfo?.solana && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Solana Address</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                        {formatAddress(walletInfo.solana?.address || '')}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(walletInfo.solana?.address || '', "Solana address")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://solscan.io/account/${walletInfo.solana?.address}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Networks</label>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="secondary">{walletInfo?.ethereum?.network || 'Unknown'}</Badge>
                    {walletInfo?.solana && <Badge variant="secondary">{walletInfo.solana.network}</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Recent wallet activity and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {walletInfo?.transactions && walletInfo.transactions.length > 0 ? (
                  walletInfo.transactions.map((tx: Transaction, index: number) => (
                    <div key={tx.id}>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            tx.status === 'win' 
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/20' 
                              : 'bg-red-100 text-red-600 dark:bg-red-900/20'
                          }`}>
                            {tx.status === 'win' ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{tx.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(tx.timestamp).toLocaleDateString()} at {new Date(tx.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${
                            tx.status === 'win' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {tx.status === 'win' ? '+' : '-'}{tx.amount} ETH
                          </div>
                          <Badge 
                            variant={tx.status === 'win' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                      {index < (walletInfo?.transactions?.length || 0) - 1 && <Separator />}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Security Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Status</CardTitle>
              <CardDescription>Your wallet security and backup information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Secure connection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span>Backup recommended</span>
                </div>
              </div>
              <Button className="w-full" variant="outline" size="sm">
                <Key className="h-4 w-4 mr-2" />
                Backup Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Token Swap Confirmation Dialog */}
      <Dialog open={showSwapModal} onOpenChange={setShowSwapModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert All Tokens to USDT</DialogTitle>
            <DialogDescription>
              Convert all your tokens (except SOL/ETH) into USDT for optimal betting liquidity
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Swap Preview
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <div>• JUP tokens → USDT</div>
                <div>• RAY tokens → USDT</div>
                <div>• Other tokens → USDT</div>
                <div>• SOL/ETH remain unchanged</div>
                <div>• Small swap fee (0.3%) applies</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowSwapModal(false)}
                disabled={swapMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSwapToSol}
                disabled={swapMutation.isPending}
              >
                {swapMutation.isPending ? 'Swapping...' : 'Confirm Swap'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Approval Modal */}
      <TransactionApprovalModal
        open={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        transactions={pendingTransactions}
        onApprove={handleTransactionApproval}
        totalValue={swapData?.totalSwapValue || "0"}
        usdtReceived={swapData?.usdtReceived || "0"}
      />
    </div>
  );
}
