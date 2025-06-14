import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  CreditCard,
  Wallet,
  PiggyBank,
  BarChart3,
  Plus,
  Minus,
  Eye,
  AlertTriangle,
  Copy,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { adminApiRequest, adminQueryFn } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

// Admin Wallets Component
function AdminWallets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminWallets, isLoading: walletsLoading } = useQuery({
    queryKey: ["/api/admin/platform-wallets"],
    queryFn: adminQueryFn,
  });

  const { data: tokenPrices } = useQuery({
    queryKey: ["/api/token-prices"],
    queryFn: adminQueryFn,
  });

  const { data: transactions } = useQuery({
    queryKey: ["/api/admin/transactions"],
    queryFn: adminQueryFn,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const formatBalance = (balance: string, decimals: number = 18) => {
    const value = parseFloat(balance) / Math.pow(10, decimals);
    if (value === 0) return "0";
    if (value < 0.000001) return value.toExponential(2);
    if (value < 0.01) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    return value.toFixed(2);
  };

  const formatTokenBalance = (balance: string, decimals: number = 18) => {
    // Handle raw token amounts (stored as strings from blockchain)
    const value = parseFloat(balance) / Math.pow(10, decimals);
    if (value === 0) return "0";
    if (value < 0.000001) return value.toExponential(2);
    if (value < 0.01) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    return value.toFixed(2);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const calculateUSDValue = (balance: string, symbol: string, decimals: number = 18) => {
    if (!tokenPrices) return "$0.00";
    // For admin wallets, balance is stored as raw amount, so convert to UI amount
    const tokenAmount = parseFloat(balance) / Math.pow(10, decimals);
    const price = tokenPrices[symbol] || 0;
    const usdValue = tokenAmount * price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(usdValue);
  };

  const calculateUserUSDValue = (balance: string, symbol: string) => {
    if (!tokenPrices) return "$0.00";
    // For user wallets, balance is already in UI amount format
    const tokenAmount = parseFloat(balance);
    const price = tokenPrices[symbol] || 0;
    const usdValue = tokenAmount * price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(usdValue);
  };

  const calculateTotalBalance = () => {
    if (!adminWallets || !tokenPrices) return "$0.00";
    
    let total = 0;
    
    // ETH balance
    if (adminWallets.ethereum?.balance) {
      const ethAmount = parseFloat(adminWallets.ethereum.balance) / Math.pow(10, 18);
      total += ethAmount * (tokenPrices.ETH || 0);
    }
    
    // ETH tokens
    if (adminWallets.ethereum?.tokens) {
      adminWallets.ethereum.tokens.forEach((token: any) => {
        const tokenAmount = parseFloat(token.balance) / Math.pow(10, token.decimals);
        total += tokenAmount * (tokenPrices[token.symbol] || 0);
      });
    }
    
    // SOL balance
    if (adminWallets.solana?.balance) {
      const solAmount = parseFloat(adminWallets.solana.balance) / Math.pow(10, 9);
      total += solAmount * (tokenPrices.SOL || 0);
    }
    
    // SOL tokens
    if (adminWallets.solana?.tokens) {
      adminWallets.solana.tokens.forEach((token: any) => {
        const tokenAmount = parseFloat(token.balance) / Math.pow(10, token.decimals);
        total += tokenAmount * (tokenPrices[token.symbol] || 0);
      });
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(total);
  };

  const getLastTransaction = () => {
    if (!transactions || transactions.length === 0) return null;
    return transactions[0]; // First transaction is the most recent due to desc order
  };

  if (walletsLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-32 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!adminWallets) {
    return (
      <div className="text-center py-8">
        <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Admin Wallets</h3>
        <p className="text-muted-foreground">Admin wallets will appear here once generated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Total Platform Balance</CardTitle>
          <div className="text-4xl font-bold text-primary mt-2">
            {calculateTotalBalance()}
          </div>
          <CardDescription>Combined ETH and SOL wallets</CardDescription>
        </CardHeader>
      </Card>

      {/* Ethereum Wallet */}
      {adminWallets.ethereum && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold">ETH</span>
                </div>
                <div>
                  <CardTitle className="text-xl">Ethereum</CardTitle>
                  <CardDescription>
                    {formatAddress(adminWallets.ethereum.address)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => copyToClipboard(adminWallets.ethereum.address, "Ethereum address")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatBalance(adminWallets.ethereum.balance)} ETH
                </div>
                <div className="text-sm text-muted-foreground">
                  {calculateUSDValue(adminWallets.ethereum.balance, "ETH")}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Full Address</label>
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">
                  {adminWallets.ethereum.address}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(adminWallets.ethereum.address, "Address")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Private Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Private Key</label>
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all text-red-600">
                  {adminWallets.ethereum.privateKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(adminWallets.ethereum.privateKey, "Private Key")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* ERC-20 Tokens */}
            {adminWallets.ethereum.tokens && adminWallets.ethereum.tokens.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">ERC-20 Tokens</h4>
                <div className="space-y-2">
                  {adminWallets.ethereum.tokens.map((token: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {token.logoURI && (
                          <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-sm text-muted-foreground">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatTokenBalance(token.balance, token.decimals)} {token.symbol}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {calculateUSDValue(token.balance, token.symbol, token.decimals)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Transaction */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4" />
                <span>Last Transaction</span>
              </h4>
              {(() => {
                const lastTx = getLastTransaction();
                if (!lastTx) {
                  return (
                    <div className="text-center py-4 text-muted-foreground">
                      <div className="text-sm">No recent transactions</div>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        lastTx.type === 'bet' ? 'bg-blue-100 text-blue-700' :
                        lastTx.type === 'deposit' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {lastTx.type === 'bet' ? 'B' : lastTx.type === 'deposit' ? 'D' : 'W'}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{lastTx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {lastTx.userName} • {format(new Date(lastTx.createdAt), "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">${lastTx.amount}</div>
                      <Badge variant={lastTx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {lastTx.status}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Solana Wallet */}
      {adminWallets.solana && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold">SOL</span>
                </div>
                <div>
                  <CardTitle className="text-xl">Solana</CardTitle>
                  <CardDescription>
                    {formatAddress(adminWallets.solana.address)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => copyToClipboard(adminWallets.solana.address, "Solana address")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatBalance(adminWallets.solana.balance, 9)} SOL
                </div>
                <div className="text-sm text-muted-foreground">
                  {calculateUSDValue(adminWallets.solana.balance, "SOL", 9)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Full Address</label>
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">
                  {adminWallets.solana.address}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(adminWallets.solana.address, "Address")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Private Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Private Key</label>
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all text-red-600">
                  {adminWallets.solana.privateKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(adminWallets.solana.privateKey, "Private Key")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* SPL Tokens */}
            {adminWallets.solana.tokens && adminWallets.solana.tokens.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">SPL Tokens</h4>
                <div className="space-y-2">
                  {adminWallets.solana.tokens.map((token: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {token.logoURI && (
                          <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-sm text-muted-foreground">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatTokenBalance(token.balance, token.decimals)} {token.symbol}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {calculateUSDValue(token.balance, token.symbol, token.decimals)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Transaction */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4" />
                <span>Last Transaction</span>
              </h4>
              {(() => {
                const lastTx = getLastTransaction();
                if (!lastTx) {
                  return (
                    <div className="text-center py-4 text-muted-foreground">
                      <div className="text-sm">No recent transactions</div>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        lastTx.type === 'bet' ? 'bg-blue-100 text-blue-700' :
                        lastTx.type === 'deposit' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {lastTx.type === 'bet' ? 'B' : lastTx.type === 'deposit' ? 'D' : 'W'}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{lastTx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {lastTx.userName} • {format(new Date(lastTx.createdAt), "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">${lastTx.amount}</div>
                      <Badge variant={lastTx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {lastTx.status}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FundsStats {
  totalPlatformRevenue: string;
  totalUserBalances: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalFees: string;
  totalBettingVolume: string;
  activeFunds: string;
  pendingTransactions: number;
}

interface Transaction {
  id: number;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'payout' | 'fee' | 'adjustment';
  amount: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  createdAt: string;
  completedAt?: string;
  txHash?: string;
  chain?: 'ethereum' | 'solana';
}

interface UserBalance {
  userId: string;
  userName: string;
  email: string | null;
  balance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalBets: string;
  totalWinnings: string;
  lastActivity: string;
  status: 'active' | 'suspended' | 'restricted';
}

const adjustBalanceSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(['add', 'subtract']),
  reason: z.string().min(1, "Reason is required"),
});

const processTransactionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
});

export default function FundsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<UserBalance | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [balanceDetailsOpen, setBalanceDetailsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const adjustForm = useForm<z.infer<typeof adjustBalanceSchema>>({
    resolver: zodResolver(adjustBalanceSchema),
    defaultValues: {
      type: "add",
      reason: "",
    },
  });

  const transactionForm = useForm<z.infer<typeof processTransactionSchema>>({
    resolver: zodResolver(processTransactionSchema),
    defaultValues: {
      action: "approve",
    },
  });

  const { data: fundsStats } = useQuery<FundsStats>({
    queryKey: ["/api/admin/funds-stats"],
    queryFn: adminQueryFn,
    refetchInterval: 30000,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: adminQueryFn,
    refetchInterval: 30000,
  });

  const { data: userBalances = [], isLoading: balancesLoading } = useQuery<UserBalance[]>({
    queryKey: ["/api/admin/user-balances"],
    queryFn: adminQueryFn,
    refetchInterval: 30000,
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof adjustBalanceSchema>) => {
      return adminApiRequest("POST", "/api/admin/adjust-balance", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funds-stats"] });
      setAdjustDialogOpen(false);
      adjustForm.reset();
      toast({
        title: "Success",
        description: "User balance adjusted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processTransactionMutation = useMutation({
    mutationFn: async (data: { transactionId: number; action: z.infer<typeof processTransactionSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/transactions/${data.transactionId}/process`, data.action);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funds-stats"] });
      setTransactionDialogOpen(false);
      transactionForm.reset();
      toast({
        title: "Success",
        description: "Transaction processed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.id.toString().includes(searchTerm) ||
      transaction.txHash?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = transactionFilter === "all" || transaction.type === transactionFilter;
    const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredBalances = userBalances.filter(balance => {
    return balance.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           balance.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           balance.userId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatBalance = (balance: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(balance));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case 'bet':
        return <DollarSign className="w-4 h-4 text-blue-600" />;
      case 'payout':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'fee':
        return <CreditCard className="w-4 h-4 text-orange-600" />;
      case 'adjustment':
        return <RefreshCw className="w-4 h-4 text-purple-600" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAdjustBalance = (balance: UserBalance) => {
    setSelectedBalance(balance);
    adjustForm.setValue('userId', balance.userId);
    setAdjustDialogOpen(true);
  };

  const handleProcessTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTransactionDialogOpen(true);
  };

  const handleViewBalanceDetails = (balance: UserBalance) => {
    setSelectedBalance(balance);
    setBalanceDetailsOpen(true);
  };

  const onAdjustSubmit = (data: z.infer<typeof adjustBalanceSchema>) => {
    adjustBalanceMutation.mutate(data);
  };

  const onTransactionSubmit = (data: z.infer<typeof processTransactionSchema>) => {
    if (!selectedTransaction) return;
    processTransactionMutation.mutate({
      transactionId: selectedTransaction.id,
      action: data,
    });
  };

  return (
    <div className="space-y-6">
      {/* Funds Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBalance(fundsStats?.totalPlatformRevenue || "0")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total User Balances</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBalance(fundsStats?.totalUserBalances || "0")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Betting Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBalance(fundsStats?.totalBettingVolume || "0")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fundsStats?.pendingTransactions || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Wallets Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Platform Wallets</CardTitle>
              <CardDescription>
                Admin ETH and SOL wallets for platform operations
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Force refresh wallet balances by invalidating cache
                queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-wallets'] });
                queryClient.refetchQueries({ queryKey: ['/api/admin/platform-wallets'] });
                queryClient.invalidateQueries({ queryKey: ['/api/token-prices'] });
                toast({
                  title: "Refreshing Wallets",
                  description: "Fetching latest wallet balances...",
                });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AdminWallets />
        </CardContent>
      </Card>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Monitor all platform transactions and pending operations
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={transactionFilter} onValueChange={setTransactionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="bet">Bets</SelectItem>
                <SelectItem value="payout">Payouts</SelectItem>
                <SelectItem value="fee">Fees</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transactions Table */}
          {transactionsLoading ? (
            <div className="text-center py-4">Loading transactions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="capitalize">{transaction.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.userName}</div>
                        <div className="text-sm text-muted-foreground">{transaction.userId}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transaction.status)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      {format(new Date(transaction.createdAt), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProcessTransaction(transaction)}
                          disabled={transaction.status !== 'pending'}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {transaction.status === 'pending' ? 'Process' : 'View'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Balances Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Balances</CardTitle>
              <CardDescription>
                Monitor and manage individual user balances
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Balances Table */}
          {balancesLoading ? (
            <div className="text-center py-4">Loading user balances...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Total Deposits</TableHead>
                  <TableHead>Total Bets</TableHead>
                  <TableHead>Total Winnings</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalances.map((balance) => (
                  <TableRow key={balance.userId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{balance.userName}</div>
                        <div className="text-sm text-muted-foreground">{balance.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-bold">
                      {formatBalance(balance.balance)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(balance.totalDeposits)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(balance.totalBets)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(balance.totalWinnings)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(balance.lastActivity), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewBalanceDetails(balance)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAdjustBalance(balance)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Adjust
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust User Balance</DialogTitle>
            <DialogDescription>
              Manually adjust the balance for user: {selectedBalance?.userName}
            </DialogDescription>
          </DialogHeader>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(onAdjustSubmit)} className="space-y-4">
              <FormField
                control={adjustForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adjustForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Type</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="add">Add to Balance</SelectItem>
                          <SelectItem value="subtract">Subtract from Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adjustForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Reason for balance adjustment..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustBalanceMutation.isPending}>
                  {adjustBalanceMutation.isPending ? "Adjusting..." : "Adjust Balance"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Process Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Transaction</DialogTitle>
            <DialogDescription>
              Review and process transaction #{selectedTransaction?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>User:</strong> {selectedTransaction.userName}
                </div>
                <div>
                  <strong>Type:</strong> {selectedTransaction.type}
                </div>
                <div>
                  <strong>Amount:</strong> {formatBalance(selectedTransaction.amount)}
                </div>
                <div>
                  <strong>Status:</strong> {selectedTransaction.status}
                </div>
                <div className="col-span-2">
                  <strong>Description:</strong> {selectedTransaction.description}
                </div>
                {selectedTransaction.txHash && (
                  <div className="col-span-2">
                    <strong>Transaction Hash:</strong> 
                    <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                      {selectedTransaction.txHash}
                    </code>
                  </div>
                )}
              </div>

              {selectedTransaction.status === 'pending' && (
                <Form {...transactionForm}>
                  <form onSubmit={transactionForm.handleSubmit(onTransactionSubmit)} className="space-y-4">
                    <FormField
                      control={transactionForm.control}
                      name="action"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Action</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approve">Approve</SelectItem>
                                <SelectItem value="reject">Reject</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={transactionForm.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note (Optional)</FormLabel>
                          <FormControl>
                            <Textarea rows={2} placeholder="Add a note about this decision..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setTransactionDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={processTransactionMutation.isPending}>
                        {processTransactionMutation.isPending ? "Processing..." : "Process Transaction"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Balance Details Dialog */}
      <Dialog open={balanceDetailsOpen} onOpenChange={setBalanceDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Balance Details - {selectedBalance?.userName}</DialogTitle>
            <DialogDescription>
              Comprehensive balance and transaction history
            </DialogDescription>
          </DialogHeader>
          {selectedBalance && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatBalance(selectedBalance.balance)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Deposits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatBalance(selectedBalance.totalDeposits)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Bets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatBalance(selectedBalance.totalBets)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Winnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatBalance(selectedBalance.totalWinnings)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-sm space-y-2">
                <div><strong>User ID:</strong> {selectedBalance.userId}</div>
                <div><strong>Email:</strong> {selectedBalance.email || 'Not provided'}</div>
                <div><strong>Status:</strong> <Badge variant="outline">{selectedBalance.status}</Badge></div>
                <div><strong>Last Activity:</strong> {format(new Date(selectedBalance.lastActivity), "PPpp")}</div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setBalanceDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}