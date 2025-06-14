import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, TrendingUp, Target, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { BadgeDisplay } from "@/components/badge-display";
import type { User, UserStats, UserBadgeWithBadge, Badge as BadgeType } from "@shared/schema";

interface LeaderboardUser extends User {
  stats: UserStats;
  badges: UserBadgeWithBadge[];
}

interface LeaderboardProps {
  category?: "accuracy" | "volume" | "experience" | "overall";
}

export default function Leaderboard({ category = "overall" }: LeaderboardProps) {
  const [showAll, setShowAll] = useState(false);
  
  const { data: users = [], isLoading } = useQuery<LeaderboardUser[]>({
    queryKey: ["/api/leaderboard", category],
  });

  const { data: allBadges = [] } = useQuery<BadgeType[]>({
    queryKey: ["/api/badges"],
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Award className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-semibold">{rank}</span>;
    }
  };

  const getCategoryMetric = (user: LeaderboardUser) => {
    switch (category) {
      case "accuracy":
        return `${user.stats.winRate.toFixed(1)}%`;
      case "volume":
        return `$${parseFloat(user.stats.totalWinnings).toLocaleString()}`;
      case "experience":
        return `${user.stats.totalBets} bets`;
      default:
        return `${user.stats.winRate.toFixed(1)}% • $${parseFloat(user.stats.totalWinnings).toLocaleString()}`;
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case "accuracy": return <Target className="w-4 h-4" />;
      case "volume": return <DollarSign className="w-4 h-4" />;
      case "experience": return <TrendingUp className="w-4 h-4" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  const getCategoryTitle = () => {
    switch (category) {
      case "accuracy": return "Top Predictors";
      case "volume": return "High Earners";
      case "experience": return "Most Active";
      default: return "Leaderboard";
    }
  };

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = (user: User) => {
    // Prioritize username if set (not system-generated)
    if (user.username && !user.username.startsWith('user_')) {
      return user.username;
    }
    // Fall back to first/last name for users without custom usernames
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'Anonymous';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getCategoryIcon()}
            <span>{getCategoryTitle()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-2 animate-pulse">
                <div className="w-4 h-4 bg-muted rounded"></div>
                <div className="w-6 h-6 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded w-1/3 mb-1"></div>
                  <div className="h-2 bg-muted rounded w-1/4"></div>
                </div>
                <div className="h-3 bg-muted rounded w-10"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-6 pt-[2px] pb-[2px]">
        <CardTitle className="flex items-center space-x-2 pt-[4px] pb-[4px]">
          {getCategoryIcon()}
          <span>{getCategoryTitle()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="space-y-1">
          {(() => {
            const displayUsers = (users || []).slice(0, showAll ? 10 : 4);
            const rows = [];
            
            for (let i = 0; i < displayUsers.length; i += 2) {
              const user1 = displayUsers[i];
              const user2 = displayUsers[i + 1];
              
              rows.push(
                <div key={`row-${i}`} className="grid grid-cols-2 gap-x-3">
                  {/* First user in row */}
                  <div className="flex items-center space-x-2 p-1 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="w-4 flex justify-center">
                      {getRankIcon(i + 1)}
                    </div>
                    
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={user1.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getUserInitials(user1)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate text-xs">
                        {getUserDisplayName(user1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getCategoryMetric(user1)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {(user1.badges || [])
                        .filter(ub => ub.badge.category === category || category === "overall")
                        .slice(0, 1)
                        .map((userBadge) => (
                          <BadgeDisplay
                            key={userBadge.badge.id}
                            badge={userBadge.badge}
                            earned={true}
                            earnedAt={userBadge.earnedAt || undefined}
                            size="sm"
                          />
                        ))}
                      
                      {(i + 1) <= 3 && (
                        <Badge variant={(i + 1) === 1 ? "default" : "secondary"} className="text-xs px-1 py-0">
                          #{i + 1}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Second user in row (if exists) */}
                  {user2 && (
                    <div className="flex items-center space-x-2 p-1 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="w-4 flex justify-center">
                        {getRankIcon(i + 2)}
                      </div>
                      
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={user2.profileImageUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate text-xs">
                          {getUserDisplayName(user2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getCategoryMetric(user2)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        {(user2.badges || [])
                          .filter(ub => ub.badge.category === category || category === "overall")
                          .slice(0, 1)
                          .map((userBadge) => (
                            <BadgeDisplay
                              key={userBadge.badge.id}
                              badge={userBadge.badge}
                              earned={true}
                              earnedAt={userBadge.earnedAt || undefined}
                              size="sm"
                            />
                          ))}
                        
                        {(i + 2) <= 3 && (
                          <Badge variant={(i + 2) === 1 ? "default" : "secondary"} className="text-xs px-1 py-0">
                            #{i + 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            
            return rows;
          })()}

        </div>
        
        {/* View More/Less Button */}
        {(users || []).length > 4 && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setShowAll(!showAll)}
              className="w-full justify-center space-x-1 text-xs h-6 py-1"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-2 h-2" />
                  <span>Show Top 4</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-2 h-2" />
                  <span>View All {(users || []).length}</span>
                </>
              )}
            </Button>
          </div>
        )}

        {(users || []).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No rankings available yet</p>
            <p className="text-sm">Start trading to appear on the leaderboard!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}