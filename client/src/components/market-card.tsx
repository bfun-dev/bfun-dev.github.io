import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Clock, TrendingUp, TrendingDown, Info, Sparkles, Share2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import BettingModal from "./betting-modal";
import SocialShare from "./social-share";
import type { MarketWithCategory } from "@shared/schema";

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

interface MarketCardProps {
  market: MarketWithCategory;
}

export default function MarketCard({ market }: MarketCardProps) {
  const [bettingModalOpen, setBettingModalOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<boolean>(true);
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Calculate odds multipliers
  const yesPrice = parseFloat(market.yesPrice);
  const noPrice = parseFloat(market.noPrice);
  const yesOdds = yesPrice > 0 ? (1 / yesPrice) : 1;
  const noOdds = noPrice > 0 ? (1 / noPrice) : 1;
  const isActive = !market.resolved && new Date() < new Date(market.endDate);

  // Simulate price change for display (in real app this would come from historical data)
  const priceChange = Math.random() > 0.5 ? Math.random() * 15 : -Math.random() * 15;
  const isPositiveChange = priceChange > 0;

  const handlePlaceBet = (side: boolean, event?: React.MouseEvent) => {
    event?.stopPropagation(); // Prevent card click when betting
    setSelectedSide(side);
    setBettingModalOpen(true);
  };

  const handleCardClick = () => {
    setLocation(`/market/${market.id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getCategoryColor = (categoryName: string) => {
    const colors: Record<string, string> = {
      'Politics': '#3B82F6',
      'Sports': '#1E40AF', 
      'Technology': '#8B5CF6',
      'Economics': '#F59E0B',
      'Entertainment': '#EC4899',
      'Climate': '#10B981',
    };
    return colors[categoryName] || '#6B7280';
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer relative" onClick={handleCardClick}>
        {/* Action Buttons */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          {/* Social Share Button */}
          <div onClick={(e) => e.stopPropagation()}>
            <SocialShare market={market} variant="compact" />
          </div>
          
          {/* AI Insights Button */}
          <Button
            className="h-6 w-6 p-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg animate-pulse"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/market/${market.id}`);
            }}
          >
            <Sparkles className="h-3 w-3" />
          </Button>
        </div>
        <CardContent className="p-6 pt-[10px] pb-[10px]">
          <div className="mb-2.5">
            <div className="flex items-center gap-2 mb-3">
              {market.category && (
                <Badge 
                  style={{ 
                    backgroundColor: `${getCategoryColor(market.category.name)}20`, 
                    color: getCategoryColor(market.category.name) 
                  }}
                  className="font-medium"
                >
                  {market.category.name}
                </Badge>
              )}
              {market.resolved && (
                <Badge 
                  className={`font-medium text-white ${
                    market.outcome 
                      ? 'bg-[#6cd97e] hover:bg-[#6cd97e]/80' 
                      : 'bg-[#ff6666] hover:bg-[#ff6666]/80'
                  }`}
                >
                  Resolved: {market.outcome ? "YES" : "NO"}
                </Badge>
              )}
              <span className={`text-sm font-medium flex items-center gap-1 ${
                isPositiveChange ? 'text-success' : 'text-error'
              }`}>
                {isPositiveChange ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPositiveChange ? '+' : ''}{priceChange.toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center gap-4 mb-3">
              {market.imageUrl && (
                <img
                  src={market.imageUrl}
                  alt={market.title}
                  className="w-[50px] h-[50px] object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold mb-1 line-clamp-2 text-[14px]">
                  {market.title}
                </h3>
                
                <p className="text-neutral line-clamp-2 text-[12px]">
                  {market.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-4 text-neutral mb-2 text-[11px] bg-[#ffe0e000]">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${formatVolume(parseFloat(market.totalVolume))} Bet Pool
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {formatVolume(market.participantCount)} Bets
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(market.endDate)}
              </span>
            </div>
          </div>
          
          {isActive ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                className={`bg-[#d1e7dd] text-[#0a3622] hover:bg-[#b8d4c2] hover:text-[#083b1e] dark:bg-[#2d5754] dark:text-[#26af60] dark:hover:bg-[#26af60] dark:hover:text-[#1a4c47] border-0 ${isMobile ? 'h-8' : 'h-10'} flex flex-col justify-center transition-all duration-200 gap-0`}
                onClick={(e) => handlePlaceBet(true, e)}
              >
                <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold leading-none`}>{yesOdds.toFixed(2)}x</div>
                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} leading-none`}>YES</div>
              </Button>
              
              <Button
                className={`bg-[#f8d7da] text-[#721c24] hover:bg-[#f1c2c7] hover:text-[#5a161c] dark:bg-[#5c4251] dark:text-[#e74709] dark:hover:bg-[#e74709] dark:hover:text-[#3d2329] border-0 ${isMobile ? 'h-8' : 'h-10'} flex flex-col justify-center transition-all duration-200 gap-0`}
                onClick={(e) => handlePlaceBet(false, e)}
              >
                <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold leading-none`}>{noOdds.toFixed(2)}x</div>
                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} leading-none`}>NO</div>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-100 text-gray-500 border border-gray-200 h-10 flex flex-col justify-center items-center rounded-lg">
                <div className="text-xl font-bold leading-none">{yesOdds.toFixed(2)}x</div>
                <div className="text-sm leading-none">YES (Ended)</div>
              </div>
              
              <div className="bg-gray-100 text-gray-500 border border-gray-200 h-10 flex flex-col justify-center items-center rounded-lg">
                <div className="text-xl font-bold leading-none">{noOdds.toFixed(2)}x</div>
                <div className="text-sm leading-none">NO (Ended)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <BettingModal
        open={bettingModalOpen}
        onClose={() => setBettingModalOpen(false)}
        market={market}
        side={selectedSide}
      />
    </>
  );
}
