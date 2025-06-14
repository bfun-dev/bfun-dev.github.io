import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Sparkles, BarChart3, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import BettingModal from "@/components/betting-modal";
import BettingChart from "@/components/betting-chart";
import SocialShare from "@/components/social-share";
import { useIsMobile } from "@/hooks/use-mobile";

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K';
  }
  return volume.toString();
}

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const marketId = parseInt(params?.id || "0");
  const [bettingModalOpen, setBettingModalOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<boolean>(true);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: market, isLoading, error } = useQuery({
    queryKey: [`/api/markets/${marketId}`],
    enabled: marketId > 0,
  });

  const { data: bets = [] } = useQuery({
    queryKey: [`/api/markets/${marketId}/bets`],
    enabled: marketId > 0,
  });

  // Scroll to top when market detail page loads or market changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [marketId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading market...</div>
        </div>
      </div>
    );
  }

  if (error || !market || !(market as any).title) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-muted-foreground">Market not found</div>
          {error && (
            <div className="text-sm text-muted-foreground mt-2">
              Error: {(error as any).message}
            </div>
          )}
        </div>
      </div>
    );
  }

  const marketData = market as any;
  const betsData = bets as any[];
  
  const isActive = marketData.endDate && new Date() < new Date(marketData.endDate) && !marketData.resolved;
  const yesOdds = marketData.yesPrice ? 1 / parseFloat(marketData.yesPrice) : 1;
  const noOdds = marketData.noPrice ? 1 / parseFloat(marketData.noPrice) : 1;

  const handlePlaceBet = (side: boolean) => {
    setSelectedSide(side);
    setBettingModalOpen(true);
  };

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'ml-0 pb-20' : 'ml-12'}`}>
      {/* Category Badges Section */}
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4 pt-3' : 'px-4 sm:px-6 lg:px-8 pt-6'}`}>
        <div className={`flex items-center gap-2 ${isMobile ? 'mb-2' : 'mb-4'}`}>
          {marketData.category && (
            <Badge 
              style={{ backgroundColor: `${marketData.category.color}20`, color: marketData.category.color }}
              className={`font-medium ${isMobile ? 'text-xs' : ''}`}
            >
              {marketData.category.name}
            </Badge>
          )}
          {marketData.resolved && (
            <Badge variant={marketData.outcome ? "default" : "destructive"} className={isMobile ? 'text-xs' : ''}>
              Resolved: {marketData.outcome ? "YES" : "NO"}
            </Badge>
          )}
          {!isActive && !marketData.resolved && (
            <Badge variant="secondary" className={isMobile ? 'text-xs' : ''}>Ended</Badge>
          )}
        </div>
      </div>

      {/* Sticky Header Content - Image and Title Only */}
      <div className={`sticky z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 ${isMobile ? 'mb-3' : 'mb-6'}`} style={{ top: '3.15rem' }}>
        <div className={`max-w-7xl mx-auto flex items-center gap-3 ${isMobile ? 'px-4 py-3' : 'px-4 sm:px-6 lg:px-8 py-4'}`}>
          {marketData.imageUrl && (
            <img
              src={marketData.imageUrl}
              alt={marketData.title}
              className={`object-cover rounded-lg flex-shrink-0 ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}`}
            />
          )}
          <div className="flex-1">
            <h1 className={`font-bold text-foreground ${isMobile ? 'text-lg' : 'text-2xl'}`}>{marketData.title}</h1>
          </div>
          <div className="flex-shrink-0">
            <SocialShare market={marketData} />
          </div>
        </div>
      </div>

      {/* Description Section - Scrollable */}
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4 mb-4' : 'px-4 sm:px-6 lg:px-8 mb-6'}`}>
        <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>{marketData.description}</p>
      </div>

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4' : 'px-4 sm:px-6 lg:px-8'}`}>



        {/* Resolution Section */}
        {marketData.resolverUrl && (
          <Card className={`bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 ${isMobile ? 'p-3 mb-3' : 'p-4 mb-6'}`}>
            <div className={`flex items-start ${isMobile ? 'gap-2' : 'gap-3'}`}>
              <ExternalLink className={`text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              <div className={isMobile ? 'space-y-1' : 'space-y-2'}>
                <h3 className={`font-semibold text-blue-900 dark:text-blue-100 ${isMobile ? 'text-sm' : ''}`}>Resolution Source</h3>
                <p className={`text-blue-800 dark:text-blue-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  This market will be resolved based on information from:
                </p>
                <a
                  href={marketData.resolverUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {marketData.resolverUrl}
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* AI Insights Section */}
        <Card className={`${isMobile ? 'mb-3' : 'mb-6'}`}>
          {!aiInsightsExpanded ? (
            <Button
              onClick={() => setAiInsightsExpanded(true)}
              className={`w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 ${isMobile ? 'h-9 text-xs px-3' : 'h-12'}`}
            >
              <Sparkles className={`${isMobile ? 'h-3.5 w-3.5' : 'h-5 w-5'} mr-2`} />
              <span className={isMobile ? 'text-xs' : 'text-base'}>Generate AI Insights</span>
            </Button>
          ) : (
            <div className={`bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800 ${isMobile ? 'p-3' : 'p-4'}`}>
              <div className={`flex items-start ${isMobile ? 'gap-2' : 'gap-3'}`}>
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className={`flex-1 ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold text-purple-900 dark:text-purple-100 ${isMobile ? 'text-sm' : ''}`}>AI Market Insights</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAiInsightsExpanded(false)}
                      className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                    >
                      ×
                    </Button>
                  </div>
                  <p className={`text-purple-800 dark:text-purple-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    Advanced AI analysis for "{marketData.title}" is currently being processed. Our AI will analyze market trends, sentiment, and historical data to provide intelligent predictions.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                      <h4 className={`font-medium text-purple-900 dark:text-purple-100 ${isMobile ? 'text-xs' : 'text-sm'}`}>Sentiment Analysis</h4>
                      <p className={`text-purple-700 dark:text-purple-300 ${isMobile ? 'text-xs' : 'text-xs'} mt-1`}>Processing...</p>
                    </div>
                    <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                      <h4 className={`font-medium text-purple-900 dark:text-purple-100 ${isMobile ? 'text-xs' : 'text-sm'}`}>Trend Prediction</h4>
                      <p className={`text-purple-700 dark:text-purple-300 ${isMobile ? 'text-xs' : 'text-xs'} mt-1`}>Processing...</p>
                    </div>
                    <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                      <h4 className={`font-medium text-purple-900 dark:text-purple-100 ${isMobile ? 'text-xs' : 'text-sm'}`}>Risk Assessment</h4>
                      <p className={`text-purple-700 dark:text-purple-300 ${isMobile ? 'text-xs' : 'text-xs'} mt-1`}>Processing...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Main Layout */}
        <div className={`grid grid-cols-1 lg:grid-cols-4 ${isMobile ? 'gap-3' : 'gap-6'}`}>
          {/* Chart Area */}
          <div className="lg:col-span-3">
            <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-3 pl-[0px] pr-[0px]">
              <div className={`${isMobile ? 'mb-3' : 'mb-6'}`}>
                <div className={`grid text-center ${isMobile ? 'grid-cols-4 gap-2' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}>
                  <div>
                    <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>YES Odds</div>
                    <div className={`font-bold text-emerald-600 dark:text-emerald-400 ${isMobile ? 'text-sm' : 'text-2xl'}`}>
                      {yesOdds.toFixed(2)}x
                    </div>
                  </div>
                  <div>
                    <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>NO Odds</div>
                    <div className={`font-bold text-red-600 dark:text-red-400 ${isMobile ? 'text-sm' : 'text-2xl'}`}>
                      {noOdds.toFixed(2)}x
                    </div>
                  </div>
                  <div>
                    <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>Volume</div>
                    <div className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>${formatVolume(parseFloat(marketData.totalVolume || '0'))}</div>
                  </div>
                  <div>
                    <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>Bets</div>
                    <div className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>{formatVolume(marketData.participantCount || 0)}</div>
                  </div>
                  {!isMobile && (
                    <>
                      <div>
                        <div className="text-sm text-muted-foreground">End Date</div>
                        <div className="font-semibold">{marketData.endDate ? new Date(marketData.endDate).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Created</div>
                        <div className="font-semibold">{marketData.createdAt ? new Date(marketData.createdAt).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Betting Activity Chart */}
              <BettingChart bets={betsData} />
            </Card>
          </div>

          {/* Right Sidebar - Betting Interface (Hidden on Mobile) */}
          {!isMobile && (
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-6">
                <h3 className="text-lg font-semibold mb-4">Place Your Bet</h3>
                
                {isActive ? (
                  <div className="space-y-4">
                    <Button
                      size="lg"
                      className="w-full h-16 flex flex-col justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handlePlaceBet(true)}
                    >
                      <div className="text-xl font-bold">{yesOdds.toFixed(2)}x</div>
                      <div className="text-sm">YES</div>
                    </Button>
                    
                    <Button
                      size="lg"
                      className="w-full h-16 flex flex-col justify-center bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handlePlaceBet(false)}
                    >
                      <div className="text-xl font-bold">{noOdds.toFixed(2)}x</div>
                      <div className="text-sm">NO</div>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-lg font-medium">Market Closed</div>
                    <div className="text-sm">Betting is no longer available</div>
                  </div>
                )}
                
                {/* Market Stats */}
                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Volume</span>
                    <span className="font-medium">${formatVolume(parseFloat(marketData.totalVolume || '0'))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Bets</span>
                    <span className="font-medium">{formatVolume(marketData.participantCount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">YES Probability</span>
                    <span className="font-medium">{marketData.yesPrice ? (parseFloat(marketData.yesPrice) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NO Probability</span>
                    <span className="font-medium">{marketData.noPrice ? (parseFloat(marketData.noPrice) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Transactions Table at Bottom */}
        <Card className={isMobile ? 'mt-3' : 'mt-6'}>
          <CardHeader className={isMobile ? 'py-3 px-3' : ''}>
            <CardTitle className={isMobile ? 'text-base' : ''}>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {betsData.length === 0 ? (
              <p className={`text-muted-foreground text-center px-6 ${isMobile ? 'py-4 text-sm' : 'py-8'}`}>No bets placed yet on this market.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    {isMobile ? (
                      <>
                        <col className="w-1/4" />
                        <col className="w-1/4" />
                        <col className="w-1/4" />
                        <col className="w-1/4" />
                      </>
                    ) : (
                      <>
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                        <col className="w-1/6" />
                      </>
                    )}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className={`text-left font-medium text-muted-foreground uppercase tracking-wider ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-xs'}`}>Date</th>
                      <th className={`text-left font-medium text-muted-foreground uppercase tracking-wider ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-xs'}`}>User</th>
                      <th className={`text-left font-medium text-muted-foreground uppercase tracking-wider ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-xs'}`}>Type</th>
                      <th className={`text-right font-medium text-muted-foreground uppercase tracking-wider ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-xs'}`}>Amount</th>
                      {!isMobile && <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Odds</th>}
                      {!isMobile && <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {betsData
                      .sort((a, b) => {
                        // Sort active bets first, then resolved bets
                        if (a.resolved !== b.resolved) {
                          return a.resolved ? 1 : -1; // Active bets (resolved=false) first
                        }
                        // Within each group, sort by creation date (newest first)
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                      })
                      .slice(0, isMobile ? 8 : 15).map((bet: any, index: number) => {
                      const getUserDisplayName = (user: any) => {
                        if (!user) return 'Anonymous';
                        // Prioritize username if set (not system-generated)
                        if (user.username && !user.username.startsWith('user_')) {
                          return user.username;
                        }
                        // Fall back to first/last name for users without custom usernames
                        if (user.firstName || user.lastName) {
                          return `${user.firstName || ''} ${user.lastName || ''}`.trim();
                        }
                        if (user.email) {
                          return user.email.split('@')[0];
                        }
                        return 'Anonymous';
                      };

                      const getElapsedTime = (createdAt: string) => {
                        const betTime = new Date(createdAt);
                        const now = new Date();
                        const diffMs = now.getTime() - betTime.getTime();
                        const diffMins = Math.floor(diffMs / (1000 * 60));
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                        if (diffDays > 0) {
                          return `${diffDays}d ago`;
                        } else if (diffHours > 0) {
                          return `${diffHours}h ago`;
                        } else if (diffMins > 0) {
                          return `${diffMins}m ago`;
                        } else {
                          return 'Just now';
                        }
                      };

                      const odds = (1 / parseFloat(bet.price)).toFixed(2);

                      return (
                        <tr key={bet.id} className={`border-b border-border/20 hover:bg-muted/20 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                          <td className={`text-muted-foreground ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-sm'}`}>
                            {getElapsedTime(bet.createdAt)}
                          </td>
                          <td className={`text-foreground font-medium ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-sm'}`}>
                            {isMobile ? getUserDisplayName(bet.user).slice(0, 8) + (getUserDisplayName(bet.user).length > 8 ? '...' : '') : getUserDisplayName(bet.user)}
                          </td>
                          <td className={isMobile ? 'py-2 px-2' : 'py-3 px-4'}>
                            <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} ${bet.side ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {bet.side ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className={`text-right font-mono text-foreground ${isMobile ? 'py-2 px-2 text-xs' : 'py-3 px-4 text-sm'}`}>
                            ${formatVolume(parseFloat(bet.shares || bet.amount))}
                          </td>
                          {!isMobile && (
                            <>
                              <td className="py-3 px-4 text-right text-sm font-mono text-foreground">
                                {odds}x
                              </td>
                              <td className="py-3 px-4 text-right text-sm font-mono">
                                <span className={bet.resolved ? 
                                  (bet.payout && parseFloat(bet.payout) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
                                  : 'text-muted-foreground'
                                }>
                                  {bet.resolved ? 
                                    (bet.payout ? `$${formatVolume(parseFloat(bet.payout))}` : '$0.00')
                                    : 'Pending'
                                  }
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Betting Bar for Mobile */}
      {isMobile && isActive && (
        <div className="fixed bottom-16 left-0 right-0 z-[60] bg-background border-t border-border p-4 shadow-lg">
          <div className="flex gap-3 max-w-md mx-auto">
            <Button
              size="lg"
              className="flex-1 h-12 flex flex-col justify-center bg-emerald-600 hover:bg-emerald-700 text-white gap-0"
              onClick={() => handlePlaceBet(true)}
            >
              <div className="text-lg font-bold leading-none">{yesOdds.toFixed(2)}x</div>
              <div className="text-xs leading-none">YES</div>
            </Button>
            
            <Button
              size="lg"
              className="flex-1 h-12 flex flex-col justify-center bg-red-600 hover:bg-red-700 text-white gap-0"
              onClick={() => handlePlaceBet(false)}
            >
              <div className="text-lg font-bold leading-none">{noOdds.toFixed(2)}x</div>
              <div className="text-xs leading-none">NO</div>
            </Button>
          </div>
        </div>
      )}
      
      <BettingModal
        open={bettingModalOpen}
        onClose={() => setBettingModalOpen(false)}
        market={marketData}
        side={selectedSide}
      />
    </div>
  );
}