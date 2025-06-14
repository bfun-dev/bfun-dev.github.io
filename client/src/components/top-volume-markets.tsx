import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { type MarketWithCategory } from "@shared/schema";
import MarketCard from "./market-card";

function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return volume.toString();
}

export default function TopVolumeMarkets() {
  const { data: markets = [], isLoading } = useQuery<MarketWithCategory[]>({
    queryKey: ["/api/markets"],
    select: (markets) => 
      markets
        .filter(market => parseFloat(market.totalVolume || "0") > 0)
        .sort((a, b) => parseFloat(b.totalVolume || "0") - parseFloat(a.totalVolume || "0"))
        .slice(0, 2)
  });

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Volume Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (markets.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Volume Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            No markets with trading volume found.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-6 rounded-xl border-2 border-yellow-200 dark:border-yellow-800/30 bg-gradient-to-br from-yellow-50/50 to-amber-50/30 dark:from-yellow-900/10 dark:to-amber-900/10">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h2 className="text-lg font-semibold">Top Volume Markets</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {markets.map((market, index) => (
          <div key={market.id} className="relative">
            {/* Rank Badge */}
            <div className={`
              absolute -top-2 -left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
              ${index === 0 
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border-2 border-yellow-400' 
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-2 border-gray-300'
              }
            `}>
              #{index + 1}
            </div>
            
            {/* Use the existing MarketCard component */}
            <MarketCard market={market} />
          </div>
        ))}
      </div>
    </div>
  );
}