import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BettingModal from "@/components/betting-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Users, DollarSign, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import type { MarketWithCategory, Bet } from "@shared/schema";

// Format volume with abbreviations
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 100000) {
    return `${Math.round(volume / 1000)}k`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toString();
}

export default function MarketDetail() {
  const { id } = useParams();
  const [bettingModalOpen, setBettingModalOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<boolean>(true);

  const { data: market, isLoading } = useQuery<MarketWithCategory>({
    queryKey: [`/api/markets/${id}`],
  });

  const { data: bets = [] } = useQuery<Bet[]>({
    queryKey: [`/api/markets/${id}/bets`],
  });

  const handlePlaceBet = (side: boolean) => {
    setSelectedSide(side);
    setBettingModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded mb-8"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text mb-4">Market Not Found</h1>
            <p className="text-neutral">The market you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate odds multipliers
  const yesPrice = parseFloat(market.yesPrice);
  const noPrice = parseFloat(market.noPrice);
  const yesOdds = yesPrice > 0 ? (1 / yesPrice) : 1;
  const noOdds = noPrice > 0 ? (1 / noPrice) : 1;
  const isActive = !market.resolved && new Date() < new Date(market.endDate);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Market Header */}
          <div className="rounded-xl shadow-sm border p-8 bg-card">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                {market.category && (
                  <Badge 
                    style={{ backgroundColor: `${market.category.color}20`, color: market.category.color }}
                    className="font-medium"
                  >
                    {market.category.name}
                  </Badge>
                )}
                {market.resolved && (
                  <Badge variant={market.outcome ? "default" : "destructive"}>
                    Resolved: {market.outcome ? "YES" : "NO"}
                  </Badge>
                )}
                {!isActive && !market.resolved && (
                  <Badge variant="secondary">Ended</Badge>
                )}
              </div>

              <div className="flex items-center gap-6">
                {/* Market Image */}
                {market.imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={market.imageUrl}
                      alt={market.title}
                      className="w-[100px] h-[100px] object-cover rounded-lg"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-4">{market.title}</h1>
                  <p className="text-muted-foreground text-lg leading-relaxed">{market.description}</p>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                  <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="text-xl font-bold text-foreground">${formatVolume(parseFloat(market.totalVolume))}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bets</p>
                  <p className="text-xl font-bold text-foreground">{formatVolume(market.participantCount)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="text-xl font-bold text-foreground">
                    {new Date(market.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-xl font-bold text-foreground">
                    {new Date(market.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Betting Interface */}
            {isActive && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  size="lg"
                  className="hover:bg-success/20 text-success border border-success/20 h-20 flex flex-col justify-center bg-[#6cd97e]"
                  onClick={() => handlePlaceBet(true)}
                >
                  <div className="text-2xl font-bold">{yesOdds.toFixed(2)}x</div>
                  <div className="text-sm">YES</div>
                </Button>
                
                <Button
                  size="lg"
                  className="hover:bg-error/20 text-error border border-error/20 h-20 flex flex-col justify-center bg-[#ff6666]"
                  onClick={() => handlePlaceBet(false)}
                >
                  <div className="text-2xl font-bold">{noOdds.toFixed(2)}x</div>
                  <div className="text-sm">NO</div>
                </Button>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Bets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 px-6">No bets placed yet on this market.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Odds</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.slice(0, 10).map((bet, index) => {
                        const getUserDisplayName = (user: any) => {
                          if (!user) return 'Anonymous';
                          if (user.firstName || user.lastName) {
                            return `${user.firstName || ''} ${user.lastName || ''}`.trim();
                          }
                          if (user.email) {
                            return user.email.split('@')[0];
                          }
                          return 'Anonymous';
                        };

                        // Calculate odds from price (1 / price)
                        const odds = (1 / parseFloat(bet.price)).toFixed(2);

                        return (
                          <tr key={bet.id} className={`border-b border-border/20 hover:bg-muted/20 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(bet.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-3 px-4 text-sm text-foreground font-medium">
                              {getUserDisplayName(bet.user)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-sm font-medium ${bet.side ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {bet.side ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-sm font-mono text-foreground">
                              ${formatVolume(parseFloat(bet.amount))}
                            </td>
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
      </div>
      <BettingModal
        open={bettingModalOpen}
        onClose={() => setBettingModalOpen(false)}
        market={market}
        side={selectedSide}
      />
    </div>
  );
}
