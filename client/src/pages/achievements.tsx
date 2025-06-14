import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Target, TrendingUp, Award, Calendar, Users, DollarSign, Zap, Crown, Shield, Flame, Gift, Sparkles, Eye, Play, BarChart3, Gem } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Badge as BadgeType, UserBadgeWithBadge, UserStats } from "@shared/schema";

interface AchievementStats {
  totalBadges: number;
  earnedBadges: number;
  recentBadges: UserBadgeWithBadge[];
  progressToNext: number;
}

const categoryIcons = {
  // Accuracy badges
  "Sharp Shooter": Target,
  "Oracle": Eye,
  "Prophet": Crown,
  "Nostradamus": Zap,
  
  // Volume badges
  "First Win": Gift,
  "High Roller": DollarSign, 
  "Market Whale": Gem,
  "Prediction Tycoon": Trophy,
  
  // Experience badges
  "Getting Started": Play,
  "Active Trader": BarChart3,
  "Market Veteran": Shield,
  "Prediction Master": Star
};

export default function Achievements() {
  const { user, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [animatingBadges, setAnimatingBadges] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { data: userBadges = [], isLoading: badgesLoading } = useQuery<UserBadgeWithBadge[]>({
    queryKey: ["/api/user/badges"],
    enabled: isAuthenticated,
  });

  const { data: allBadges = [], isLoading: allBadgesLoading } = useQuery<BadgeType[]>({
    queryKey: ["/api/badges"],
    enabled: isAuthenticated,
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
  });

  // Claim badge mutation
  const claimBadgeMutation = useMutation({
    mutationFn: async (badgeId: number) => {
      await apiRequest("POST", `/api/badges/${badgeId}/claim`);
    },
    onSuccess: () => {
      // Invalidate queries to refresh badge data
      queryClient.invalidateQueries({ queryKey: ["/api/user/badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      
      toast({
        title: "Badge Claimed!",
        description: "Congratulations on earning your new badge!",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to claim badge",
        description: error.message || "Unable to claim badge at this time",
        variant: "destructive",
      });
    },
  });

  // Calculate achievement statistics
  const achievementStats: AchievementStats = {
    totalBadges: allBadges.length,
    earnedBadges: userBadges.length,
    recentBadges: userBadges
      .sort((a: UserBadgeWithBadge, b: UserBadgeWithBadge) => 
        new Date(b.earnedAt || 0).getTime() - new Date(a.earnedAt || 0).getTime()
      )
      .slice(0, 3),
    progressToNext: allBadges.length > 0 ? (userBadges.length / allBadges.length) * 100 : 0
  };

  // Group badges by category
  const badgesByCategory = allBadges.reduce((acc: Record<string, BadgeType[]>, badge: BadgeType) => {
    const category = badge.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(badge);
    return acc;
  }, {});

  const categories = ["all", ...Object.keys(badgesByCategory)];

  // Filter badges based on selected category
  const filteredBadges = selectedCategory === "all" 
    ? allBadges 
    : badgesByCategory[selectedCategory] || [];

  // Check if user has earned a badge
  const hasBadge = (badgeId: number) => 
    userBadges.some((ub: UserBadgeWithBadge) => ub.badge.id === badgeId);

  const getBadgeEarnedDate = (badgeId: number) => {
    const userBadge = userBadges.find((ub: UserBadgeWithBadge) => ub.badge.id === badgeId);
    return userBadge?.earnedAt;
  };

  // Calculate badge progress and remaining count
  const getBadgeProgress = (badge: BadgeType) => {
    if (!userStats) return { current: 0, required: 0, remaining: 0, progress: 0 };
    
    const totalBets = userStats.totalBets;
    const winRate = userStats.winRate;
    const totalWinnings = parseFloat(userStats.totalWinnings);
    
    let current = 0;
    let required = 0;
    
    switch (badge.name) {
      case "Sharp Shooter":
        // Requires 10 bets with >60% win rate
        current = winRate >= 60 ? totalBets : 0;
        required = 10;
        break;
      case "High Roller":
        // Requires $100+ in total winnings
        current = totalWinnings;
        required = 100;
        break;
      case "Streak Master":
        // Requires 5 consecutive wins (simplified to 5 bets with >80% win rate)
        current = winRate >= 80 ? totalBets : 0;
        required = 5;
        break;
      case "Early Bird":
        // Requires 3 bets (early adopter)
        current = totalBets;
        required = 3;
        break;
      case "Social Butterfly":
        // Requires 20 bets (social engagement)
        current = totalBets;
        required = 20;
        break;
      case "Market Maker":
        // Requires 50 bets
        current = totalBets;
        required = 50;
        break;
      case "Lucky Charm":
        // Requires 15 bets with >70% win rate
        current = winRate >= 70 ? totalBets : 0;
        required = 15;
        break;
      case "Veteran Trader":
        // Requires 100 bets
        current = totalBets;
        required = 100;
        break;
      default:
        current = totalBets;
        required = 10;
        break;
    }
    
    const remaining = Math.max(0, required - current);
    const progress = Math.min(100, (current / required) * 100);
    
    return { current, required, remaining, progress };
  };

  // Animate badge when it's clicked
  const handleBadgeClick = (badgeId: number) => {
    if (!hasBadge(badgeId)) return;
    
    setAnimatingBadges(prev => new Set([...Array.from(prev), badgeId]));
    setTimeout(() => {
      setAnimatingBadges(prev => {
        const newSet = new Set([...Array.from(prev)]);
        newSet.delete(badgeId);
        return newSet;
      });
    }, 600);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground">
            Please sign in to view your achievements and badges.
          </p>
        </Card>
      </div>
    );
  }

  const isLoading = badgesLoading || allBadgesLoading || statsLoading;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-background via-background to-accent/5 ${isMobile ? 'ml-0' : 'ml-12'}`}>
      <div className={`max-w-7xl mx-auto ${isMobile ? 'py-3 px-4' : 'py-8 px-4'}`}>
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Achievements
            </h1>
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track your progress, unlock badges, and showcase your trading achievements
          </p>
        </motion.div>

        {/* Achievement Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`grid gap-6 mb-8 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}
        >
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className={`text-center ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">Total Badges</span>
              </div>
              <div className={`font-bold text-primary ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                {achievementStats.earnedBadges}/{achievementStats.totalBadges}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className={`text-center ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className={`font-semibold text-green-600 ${isMobile ? 'text-sm' : ''}`}>Progress</span>
              </div>
              <div className={`font-bold text-green-600 mb-2 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                {Math.round(achievementStats.progressToNext)}%
              </div>
              <Progress value={achievementStats.progressToNext} className="h-2" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className={`text-center ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className={`font-semibold text-blue-600 ${isMobile ? 'text-sm' : ''}`}>Win Rate</span>
              </div>
              <div className={`font-bold text-blue-600 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                {userStats ? Math.round(userStats.winRate) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
            <CardContent className={`text-center ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <span className={`font-semibold text-yellow-600 ${isMobile ? 'text-sm' : ''}`}>Total Bets</span>
              </div>
              <div className={`font-bold text-yellow-600 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                {userStats?.totalBets || 0}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Achievements */}
        {achievementStats.recentBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={isMobile ? 'mb-4' : 'mb-8'}
          >
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {achievementStats.recentBadges.map((userBadge: UserBadgeWithBadge, index: number) => {
                    const IconComponent = categoryIcons[userBadge.badge.name as keyof typeof categoryIcons] || Award;
                    return (
                      <motion.div
                        key={userBadge.badge.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex-shrink-0 text-center p-4 rounded-lg bg-background border hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => handleBadgeClick(userBadge.badge.id)}
                      >
                        <div className="relative">
                          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white shadow-lg">
                            <IconComponent className="h-8 w-8" />
                          </div>
                          <motion.div
                            className="absolute inset-0 rounded-full bg-primary/20"
                            initial={{ scale: 1, opacity: 0 }}
                            animate={animatingBadges.has(userBadge.badge.id) ? 
                              { scale: [1, 1.2, 1], opacity: [0, 0.6, 0] } : 
                              { scale: 1, opacity: 0 }
                            }
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{userBadge.badge.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {userBadge.earnedAt && new Date(userBadge.earnedAt).toLocaleDateString()}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-background border hover:bg-accent hover:shadow-md"
                }`}
              >
                {category === "all" ? "All Badges" : category}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Badge Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {isLoading ? (
            <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className={`text-center ${isMobile ? 'p-4' : 'p-6'}`}>
                    <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} mx-auto mb-4 bg-muted rounded-full`} />
                    <div className={`${isMobile ? 'h-5' : 'h-6'} bg-muted rounded mb-2`} />
                    <div className={`${isMobile ? 'h-3' : 'h-4'} bg-muted rounded`} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
              <AnimatePresence mode="popLayout">
                {filteredBadges.map((badge: BadgeType, index: number) => {
                  const earned = hasBadge(badge.id);
                  const earnedDate = getBadgeEarnedDate(badge.id);
                  const IconComponent = categoryIcons[badge.name as keyof typeof categoryIcons] || Award;
                  const isAnimating = animatingBadges.has(badge.id);

                  return (
                    <motion.div
                      key={badge.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        delay: index * 0.05,
                        layout: { duration: 0.3 }
                      }}
                      whileHover={{ y: -5 }}
                      className="group"
                    >
                      <Card 
                        className={`h-full transition-all duration-300 cursor-pointer ${
                          earned 
                            ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-lg hover:shadow-xl" 
                            : "bg-muted/30 hover:bg-muted/50 border-muted"
                        }`}
                        onClick={() => handleBadgeClick(badge.id)}
                      >
                        <CardContent className={`text-center relative overflow-hidden ${isMobile ? 'p-4' : 'p-6'}`}>
                          {/* Badge Icon */}
                          <div className="relative mb-4">
                            <motion.div
                              className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                                earned
                                  ? "bg-gradient-to-br from-primary to-primary/60 text-white shadow-lg"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              animate={isAnimating ? {
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0]
                              } : {}}
                              transition={{ duration: 0.6 }}
                            >
                              <IconComponent className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`} />
                            </motion.div>

                            {/* Glow effect for earned badges */}
                            {earned && (
                              <motion.div
                                className="absolute inset-0 rounded-full bg-primary/20 blur-md"
                                animate={isAnimating ? {
                                  scale: [1, 1.3, 1],
                                  opacity: [0.3, 0.6, 0.3]
                                } : {}}
                                transition={{ duration: 0.6 }}
                              />
                            )}

                            {/* Sparkle animation for earned badges */}
                            {earned && isAnimating && (
                              <motion.div
                                className="absolute inset-0 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 0.6 }}
                              >
                                {[...Array(6)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-primary rounded-full"
                                    animate={{
                                      x: [0, Math.cos(i * 60 * Math.PI / 180) * 30],
                                      y: [0, Math.sin(i * 60 * Math.PI / 180) * 30],
                                      opacity: [1, 0]
                                    }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                  />
                                ))}
                              </motion.div>
                            )}
                          </div>

                          {/* Badge Info */}
                          <h3 className={`font-bold mb-2 ${isMobile ? 'text-base' : 'text-lg'} ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                            {badge.name}
                          </h3>
                          <p className={`mb-3 ${isMobile ? 'text-xs' : 'text-sm'} ${earned ? "text-foreground/80" : "text-muted-foreground"}`}>
                            {badge.description}
                          </p>

                          {/* Progress and Status */}
                          {(() => {
                            const progress = getBadgeProgress(badge);
                            return earned ? (
                              <div className="space-y-2">
                                <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                                  Earned
                                </Badge>
                                {earnedDate && (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(earnedDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* Progress Bar */}
                                <div className="w-full">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Progress
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {progress.current}/{progress.required}
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted/50 rounded-full h-2">
                                    <div 
                                      className="bg-primary h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${progress.progress}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Remaining Count and Claim Button */}
                                {progress.remaining > 0 ? (
                                  <div className="text-center">
                                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                                      {progress.remaining} more needed
                                    </Badge>
                                  </div>
                                ) : progress.progress >= 100 ? (
                                  <div className="text-center space-y-2">
                                    <Button
                                      onClick={() => claimBadgeMutation.mutate(badge.id)}
                                      disabled={claimBadgeMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-auto"
                                      size="sm"
                                    >
                                      {claimBadgeMutation.isPending ? "Claiming..." : "Claim Badge"}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <Badge variant="outline" className="text-muted-foreground">
                                      Not Started
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Background decoration */}
                          <div className={`absolute -top-10 -right-10 w-20 h-20 rounded-full transition-all duration-300 ${
                            earned ? "bg-primary/5" : "bg-muted/30"
                          } group-hover:scale-110`} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {filteredBadges.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No badges in this category</h3>
            <p className="text-muted-foreground">
              Try selecting a different category or start trading to earn your first badge!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}