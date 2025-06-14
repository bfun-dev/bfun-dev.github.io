import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useFilters } from "@/contexts/FilterContext";
import StatsOverview from "@/components/stats-overview";
import MarketCard from "@/components/market-card";
import Leaderboard from "@/components/leaderboard";
import TopVolumeMarkets from "@/components/top-volume-markets";
import OnboardingTutorial from "@/components/onboarding-tutorial";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, TrendingUp, DollarSign, Users, Clock } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MarketWithCategory } from "@shared/schema";

// Format volume with abbreviations
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toString();
}

export default function Home() {
  const [sortBy, setSortBy] = useState("volume");
  const { selectedCategories, status: statusFilter } = useFilters();
  const { user, isAuthenticated } = useAuth();
  const { shouldShowTutorial, completeTutorial, closeTutorial, showTutorial, startTutorial } = useOnboarding(user?.id);
  const isMobile = useIsMobile();

  // Auto-start tutorial for new users only once when they first log in
  useEffect(() => {
    if (isAuthenticated && user?.id && !(user as any)?.hasSeenTutorial) {
      const hasSeenTutorialLocal = localStorage.getItem(`tutorial-seen-${user.id}`);
      if (!hasSeenTutorialLocal) {
        startTutorial();
      }
    }
  }, [isAuthenticated, user?.id, user, startTutorial]);

  const { data: markets = [], isLoading: marketsLoading } = useQuery<MarketWithCategory[]>({
    queryKey: ['/api/markets', selectedCategories, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(id => params.append('categoryIds', id.toString()));
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const url = `/api/markets${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  // Sort markets based on selected criteria
  const sortedMarkets = [...markets].sort((a, b) => {
    // First, prioritize active markets over resolved ones
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1; // Active markets (resolved=false) first
    }
    
    // Then sort by selected criteria within each group
    switch (sortBy) {
      case "volume":
        return parseFloat(b.totalVolume || "0") - parseFloat(a.totalVolume || "0");
      case "newest":
        return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime();
      case "ending":
        return new Date(a.endDate || new Date()).getTime() - new Date(b.endDate || new Date()).getTime();
      default:
        return 0;
    }
  });

  // Get featured markets (top volume markets)
  const topFeaturedMarkets = sortedMarkets
    .filter(market => parseFloat(market.totalVolume || "0") > 1000)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <div className={`p-6 ${isMobile ? 'pt-3 pb-[24px] pl-4 pr-4' : 'pt-[24px] pb-[24px] pl-[0px] pr-[0px]'}`}>
        <div className={isMobile ? 'space-y-3' : 'space-y-6'}>
          <StatsOverview />

          {/* Markets Grid - Show immediately while data loads in background */}
          {marketsLoading && markets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl shadow-sm border border-border p-6 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-20 bg-muted rounded mb-4"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-16 bg-muted rounded"></div>
                    <div className="h-16 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Show markets immediately when available */}
              {sortedMarkets.length > 0 && (
                <>
                  {/* Initial markets grid */}
                  <div id="market-grid" className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isMobile ? 'gap-2 mb-4' : 'gap-2 mb-8'}`}>
                    {sortedMarkets.slice(0, isMobile ? 4 : 6).map((market, index) => (
                      <div key={market.id} id={index === 0 ? "first-market-card" : undefined}>
                        <MarketCard market={market} />
                      </div>
                    ))}
                  </div>

                  {/* Featured Markets after first 2 rows */}
                  {topFeaturedMarkets.length > 0 && (
                    <div className={`space-y-4 p-6 rounded-xl border-2 border-primary/30 dark:border-primary/20 bg-gradient-to-br from-primary/5 to-purple-50/30 dark:from-primary/10 dark:to-purple-900/10 ${isMobile ? 'mb-3' : 'mb-6'}`}>
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Featured Bets</h2>
                        <Badge className="bg-primary/10 text-primary font-medium border-primary/20">
                          Top Picks
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {topFeaturedMarkets.map((market) => (
                          <MarketCard key={market.id} market={market} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remaining markets */}
                  {sortedMarkets.slice(isMobile ? 4 : 6).length > 0 && (
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isMobile ? 'gap-2 mb-4' : 'gap-2 mb-8'}`}>
                      {sortedMarkets.slice(isMobile ? 4 : 6).map((market) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  )}

                  {/* Top Volume Markets section */}
                  <div className={isMobile ? 'mb-4' : 'mb-8'}>
                    <TopVolumeMarkets />
                  </div>
                </>
              )}

              {/* No markets message */}
              {sortedMarkets.length === 0 && !marketsLoading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">No markets found.</p>
                </div>
              )}
            </>
          )}

          {/* Onboarding Tutorial */}
          <OnboardingTutorial
            isOpen={showTutorial}
            onClose={closeTutorial}
            onComplete={(points) => completeTutorial(points)}
          />
        </div>
      </div>
    </div>
  );
}