import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Gift, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { BetWithMarket, UserStats } from "@shared/schema";

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  } else {
    return volume.toFixed(2);
  }
}

export default function Portfolio() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  
  const navigate = (path: string) => setLocation(path);

  const { data: userBets = [], isLoading: betsLoading } = useQuery<BetWithMarket[]>({
    queryKey: ['/api/bets/user'],
    enabled: isAuthenticated,
  });

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ['/api/user/stats'],
    enabled: isAuthenticated,
  });

  const { data: winnings, refetch: refetchWinnings } = useQuery<{
    totalAmount: string;
    bets: Array<{
      id: number;
      amount: string;
      payout: string;
      side: boolean;
      market: {
        id: number;
        title: string;
        createdAt: string;
      };
    }>;
  }>({
    queryKey: ['/api/user/winnings'],
    enabled: isAuthenticated,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const claimWinningsMutation = useMutation({
    mutationFn: async (betId: number) => {
      return apiRequest("POST", `/api/user/claim/${betId}`);
    },
    onSuccess: (data: any) => {
      console.log("Claim response data:", data);
      const amount = data.amountClaimed || data.amount || "0";
      const txSignature = data.transactionSignature || data.signature;
      
      toast({
        title: "Winnings Claimed!",
        description: txSignature 
          ? `$${parseFloat(amount).toFixed(2)} transferred to your Solana wallet. Transaction: ${txSignature.slice(0, 8)}...`
          : `$${parseFloat(amount).toFixed(2)} claimed successfully. Balance updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/winnings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bets/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim winnings",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-6">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to view your portfolio and betting history.
            </p>
            <Button onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeBets = (userBets as BetWithMarket[]).filter((bet: BetWithMarket) => !bet.market.resolved);
  const completedBets = (userBets as BetWithMarket[]).filter((bet: BetWithMarket) => bet.market.resolved);

  const totalInvested = (userBets as BetWithMarket[]).reduce((sum: number, bet: BetWithMarket) => 
    sum + parseFloat(bet.shares || bet.amount), 0);
  
  const totalWinnings = completedBets.reduce((sum: number, bet: BetWithMarket) => 
    sum + (bet.payout ? parseFloat(bet.payout) : 0), 0);

  const winRate = completedBets.length > 0 
    ? (completedBets.filter((bet: BetWithMarket) => bet.payout && parseFloat(bet.payout) > parseFloat(bet.amount)).length / completedBets.length) * 100
    : 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">Track your betting performance and history</p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Wallet className="h-4 w-4 mr-2 text-blue-500" />
              <div className="text-2xl font-bold">${parseFloat(user?.balance || "0").toLocaleString()}</div>
            </div>
            <p className="text-xs text-muted-foreground">Current Balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
              <div className="text-2xl font-bold">${totalInvested.toLocaleString()}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Invested</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
              <div className="text-2xl font-bold">${totalWinnings.toLocaleString()}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Winnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-yellow-500" />
              <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            </div>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Claimable Winnings */}
      <Card className={`border-2 pt-[0px] pb-[0px] mt-[9px] mb-[9px] ${winnings?.totalAmount && parseFloat(winnings.totalAmount) > 0 
        ? 'border-yellow-500/20 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20' 
        : 'border-gray-200 dark:border-gray-700'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className={`h-5 w-5 ${winnings?.totalAmount && parseFloat(winnings.totalAmount) > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
            Claimable Winnings
            {winnings?.totalAmount && parseFloat(winnings.totalAmount) > 0 && (
              <Badge variant="secondary" className="ml-auto">
                ${parseFloat(winnings.totalAmount).toLocaleString()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {winnings?.totalAmount && parseFloat(winnings.totalAmount) > 0 ? (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                You have {winnings.bets?.length || 0} winning bet{(winnings.bets?.length || 0) !== 1 ? 's' : ''} ready to claim!
              </div>
              <div className="space-y-3">
                {winnings.bets?.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{bet.market.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {bet.side ? 'YES' : 'NO'} • Bet: ${parseFloat(bet.shares || bet.amount).toFixed(2)} • 
                        Won: ${parseFloat(bet.payout).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Resolved: {bet.market.createdAt ? format(new Date(bet.market.createdAt), 'MMM dd, yyyy') : 'Recently'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={bet.side ? "default" : "secondary"} className="text-xs">
                        {bet.side ? 'YES' : 'NO'}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => claimWinningsMutation.mutate(bet.id)}
                        disabled={claimWinningsMutation.isPending}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                      >
                        {claimWinningsMutation.isPending ? (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            Claiming...
                          </div>
                        ) : (
                          <>
                            <Star className="h-3 w-3 mr-1" />
                            Claim ${parseFloat(bet.payout).toFixed(2)}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-lg font-medium mb-2">No Winnings to Claim</div>
              <p className="text-sm">
                When you win bets, your winnings will appear here for you to claim.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Place Your First Bet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Betting History */}
      <Card>
        <CardHeader>
          <CardTitle>Betting History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Bets ({activeBets.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedBets.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              {activeBets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>No active bets</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/')}
                  >
                    Explore Markets
                  </Button>
                </div>
              ) : (
                activeBets.map((bet: BetWithMarket) => (
                  <Card key={bet.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm mb-1 line-clamp-2">
                            {bet.market.title}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant={bet.side ? "default" : "secondary"}
                              className={bet.side ? "bg-green-500" : "bg-red-500"}
                            >
                              {bet.side ? "YES" : "NO"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              ${parseFloat(bet.shares || bet.amount).toFixed(2)} @ {parseFloat(bet.price).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/market/${bet.market.id}`)}
                        >
                          View Market
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-4">
              {completedBets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>No completed bets yet</p>
                </div>
              ) : (
                completedBets.map((bet: BetWithMarket) => {
                  const payout = bet.payout ? parseFloat(bet.payout) : 0;
                  const stake = parseFloat(bet.shares || bet.amount);
                  const profit = payout - stake;
                  const isWin = profit > 0;
                  
                  return (
                    <Card key={bet.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-sm mb-1 line-clamp-2">
                              {bet.market.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant={bet.side ? "default" : "secondary"}
                                className={bet.side ? "bg-green-500" : "bg-red-500"}
                              >
                                {bet.side ? "YES" : "NO"}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                ${stake.toFixed(2)} @ {parseFloat(bet.price).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1">
                                {isWin ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-sm font-medium ${isWin ? "text-green-500" : "text-red-500"}`}>
                                  {isWin ? "+" : ""}${profit.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/market/${bet.market.id}`)}
                          >
                            View Market
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}