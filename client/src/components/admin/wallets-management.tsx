import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Wallet, Copy, RefreshCw, Eye, EyeOff, AlertTriangle, Key } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { adminApiRequest, adminQueryFn } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface WalletData {
  userId: string;
  userName: string;
  email: string | null;
  solanaAddress: string;
  ethereumAddress: string;
  totalUsdValue: number;
  solanaBalance: number;
  ethereumBalance: number;
  tokens: {
    symbol: string;
    balance: number;
    usdValue: number;
    chain: 'solana' | 'ethereum';
  }[];
  lastActivity: string;
  autoSwapEnabled: boolean;
  isRefreshed?: boolean;
}

interface WalletStats {
  totalWallets: number;
  totalUsdValue: string;
  activeWallets: number;
  solanaWallets: number;
  ethereumWallets: number;
}

export default function WalletsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [showPrivateKeys, setShowPrivateKeys] = useState(false);
  const [walletKeys, setWalletKeys] = useState<any>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading } = useQuery<WalletData[]>({
    queryKey: ["/api/admin/wallets"],
    queryFn: adminQueryFn,
    refetchInterval: 60000, // Refresh every minute
  });

  const safeWallets = wallets || [];

  const { data: walletStats } = useQuery<WalletStats>({
    queryKey: ["/api/admin/wallet-stats"],
    queryFn: adminQueryFn,
  });

  const refreshWalletMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminApiRequest("POST", `/api/admin/wallets/${userId}/refresh`);
    },
    onSuccess: (data, userId) => {
      // Force cache invalidation and refetch
      queryClient.removeQueries({ queryKey: ["/api/admin/wallets"] });
      queryClient.removeQueries({ queryKey: ["/api/admin/wallet-stats"] });
      
      // Refetch immediately
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-stats"] });
      
      const balanceInfo = data.solanaBalance !== undefined && data.ethereumBalance !== undefined 
        ? ` - ${data.solanaBalance.toFixed(4)} SOL, ${data.ethereumBalance.toFixed(4)} ETH`
        : '';
      
      toast({
        title: "Wallet Refreshed",
        description: `Real balances loaded${balanceInfo}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to refresh wallet data. Blockchain APIs may be rate limited.",
        variant: "destructive",
      });
    },
  });

  const toggleAutoSwapMutation = useMutation({
    mutationFn: async (data: { userId: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/admin/wallets/${data.userId}/auto-swap`, { enabled: data.enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets"] });
      toast({
        title: "Success",
        description: "Auto-swap setting updated",
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

  const filteredWallets = safeWallets.filter(wallet => {
    const matchesSearch = 
      wallet.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wallet.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wallet.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wallet.solanaAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wallet.ethereumAddress.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesChain = chainFilter === "all" ||
      (chainFilter === "solana" && wallet.solanaBalance > 0) ||
      (chainFilter === "ethereum" && wallet.ethereumBalance > 0);

    return matchesSearch && matchesChain;
  });

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(balance);
  };

  const formatCrypto = (balance: number, symbol: string) => {
    return `${balance.toFixed(6)} ${symbol}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const handleViewDetails = (wallet: WalletData) => {
    setSelectedWallet(wallet);
    setDetailsDialogOpen(true);
  };

  const handleRefreshWallet = (userId: string) => {
    refreshWalletMutation.mutate(userId);
  };

  const handleRefreshAllWallets = () => {
    const userIds = safeWallets.map(w => w.userId);
    userIds.forEach((userId, index) => {
      // Stagger requests to avoid API rate limits
      setTimeout(() => {
        refreshWalletMutation.mutate(userId);
      }, index * 2000); // 2 second delay between each request
    });
  };

  const handleToggleAutoSwap = (userId: string, enabled: boolean) => {
    toggleAutoSwapMutation.mutate({ userId, enabled });
  };

  const handleShowKeys = async (userId: string) => {
    setLoadingKeys(true);
    try {
      const response = await adminApiRequest(`/api/admin/wallets/${userId}/keys`);
      setWalletKeys(response);
      setShowPrivateKeys(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load wallet keys",
        variant: "destructive",
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  const copyKeyToClipboard = (key: string, type: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied",
      description: `${type} copied to clipboard`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{walletStats?.totalWallets || safeWallets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total USD Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {walletStats?.totalUsdValue ? formatBalance(parseFloat(walletStats.totalUsdValue)) : formatBalance(safeWallets.reduce((sum, wallet) => sum + wallet.totalUsdValue, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {walletStats?.activeWallets || safeWallets.filter(w => w.totalUsdValue > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solana Wallets</CardTitle>
            <Badge variant="secondary" className="text-xs">SOL</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {walletStats?.solanaWallets || safeWallets.filter(w => w.solanaBalance > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ethereum Wallets</CardTitle>
            <Badge variant="secondary" className="text-xs">ETH</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {walletStats?.ethereumWallets || safeWallets.filter(w => w.ethereumBalance > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Wallets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Wallets Management</CardTitle>
              <CardDescription>
                Monitor and manage user wallets across all chains
              </CardDescription>
            </div>
            <Button
              onClick={handleRefreshAllWallets}
              disabled={refreshWalletMutation.isPending}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh All Balances
            </Button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search wallets by user, email, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={chainFilter} onValueChange={setChainFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Chain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chains</SelectItem>
                <SelectItem value="solana">Solana</SelectItem>
                <SelectItem value="ethereum">Ethereum</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrivateKeys(!showPrivateKeys)}
              >
                {showPrivateKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showPrivateKeys ? "Hide" : "Show"} Keys
              </Button>
              {showPrivateKeys && (
                <div className="flex items-center text-orange-600 text-sm">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Sensitive data visible
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading wallets...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Solana Address</TableHead>
                  <TableHead>Ethereum Address</TableHead>
                  <TableHead>SOL Balance</TableHead>
                  <TableHead>ETH Balance</TableHead>
                  <TableHead>Total USD</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Auto-Swap</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((wallet) => (
                  <TableRow key={wallet.userId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{wallet.userName}</div>
                        <div className="text-sm text-gray-500">{wallet.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {wallet.solanaAddress.slice(0, 8)}...{wallet.solanaAddress.slice(-6)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(wallet.solanaAddress)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {wallet.ethereumAddress.slice(0, 8)}...{wallet.ethereumAddress.slice(-6)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(wallet.ethereumAddress)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCrypto(wallet.solanaBalance, "SOL")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCrypto(wallet.ethereumBalance, "ETH")}
                    </TableCell>
                    <TableCell className="font-mono font-bold">
                      {formatBalance(wallet.totalUsdValue)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wallet.tokens.slice(0, 3).map((token, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {token.symbol}
                          </Badge>
                        ))}
                        {wallet.tokens.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{wallet.tokens.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={wallet.autoSwapEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleAutoSwap(wallet.userId, !wallet.autoSwapEnabled)}
                        disabled={toggleAutoSwapMutation.isPending}
                      >
                        {wallet.autoSwapEnabled ? "Enabled" : "Disabled"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(wallet.lastActivity), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(wallet)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowKeys(wallet.userId)}
                          disabled={loadingKeys}
                        >
                          <Key className="w-3 h-3 mr-1" />
                          Keys
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshWallet(wallet.userId)}
                          disabled={refreshWalletMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Refresh
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

      {/* Wallet Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Wallet Details - {selectedWallet?.userName}</DialogTitle>
            <DialogDescription>
              Complete wallet information and token holdings
            </DialogDescription>
          </DialogHeader>
          {selectedWallet && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Solana Wallet</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Address:</span></div>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs break-all">
                      {selectedWallet.solanaAddress}
                    </code>
                    <div><span className="text-gray-500">Balance:</span> {formatCrypto(selectedWallet.solanaBalance, "SOL")}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Ethereum Wallet</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Address:</span></div>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs break-all">
                      {selectedWallet.ethereumAddress}
                    </code>
                    <div><span className="text-gray-500">Balance:</span> {formatCrypto(selectedWallet.ethereumBalance, "ETH")}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Token Holdings</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>USD Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWallet.tokens.map((token, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{token.symbol}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={token.chain === 'solana' ? 'default' : 'secondary'}>
                            {token.chain.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {token.balance.toFixed(6)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatBalance(token.usdValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-lg font-semibold">
                  Total Portfolio Value: {formatBalance(selectedWallet.totalUsdValue)}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => handleRefreshWallet(selectedWallet.userId)}
                    disabled={refreshWalletMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Wallet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Keys Display Dialog */}
      <Dialog open={showPrivateKeys} onOpenChange={setShowPrivateKeys}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Wallet Private Keys & Recovery Information
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                Keep this information secure. Never share private keys publicly.
              </div>
            </DialogDescription>
          </DialogHeader>
          {walletKeys && (
            <div className="space-y-6">
              {/* Solana Wallet Keys */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Badge variant="secondary">SOL</Badge>
                  Solana Wallet
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Public Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm break-all">
                        {walletKeys.solana.address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyKeyToClipboard(walletKeys.solana.address, "Solana address")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Private Key (Base58)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm break-all border border-red-200 dark:border-red-800">
                        {walletKeys.solana.privateKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyKeyToClipboard(walletKeys.solana.privateKey, "Solana private key")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ethereum Wallet Keys */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Badge variant="secondary">ETH</Badge>
                  Ethereum Wallet
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Public Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm break-all">
                        {walletKeys.ethereum.address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyKeyToClipboard(walletKeys.ethereum.address, "Ethereum address")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Private Key (Hex)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm break-all border border-red-200 dark:border-red-800">
                        {walletKeys.ethereum.privateKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyKeyToClipboard(walletKeys.ethereum.privateKey, "Ethereum private key")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="space-y-2">
                    <h5 className="font-medium text-yellow-800 dark:text-yellow-200">Security Notice</h5>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <p>• Private keys provide full control over wallet funds</p>
                      <p>• Never share private keys with anyone</p>
                      <p>• Store this information securely offline</p>
                      <p>• Anyone with these keys can access and transfer all funds</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowPrivateKeys(false)}>
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