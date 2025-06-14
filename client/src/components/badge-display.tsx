import { Badge, UserBadgeWithBadge } from "@shared/schema";
import { BadgeIcon } from "@/lib/badge-icons";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

interface BadgeDisplayProps {
  badge: Badge;
  earned?: boolean;
  earnedAt?: Date;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

export function BadgeDisplay({ badge, earned = false, earnedAt, size = "md", showDescription = false }: BadgeDisplayProps) {
  
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  const rarityColors = {
    common: "from-gray-400 to-gray-600",
    rare: "from-blue-400 to-blue-600", 
    epic: "from-purple-400 to-purple-600",
    legendary: "from-yellow-400 to-yellow-600"
  };

  return (
    <div className={cn(
      "relative group cursor-pointer transition-all duration-200",
      earned ? "hover:scale-110" : "opacity-50 grayscale"
    )}>
      <div className={cn(
        "rounded-full bg-gradient-to-br border-2 border-white/20 shadow-lg flex items-center justify-center",
        sizeClasses[size],
        earned ? rarityColors[badge.rarity as keyof typeof rarityColors] : "from-gray-300 to-gray-500"
      )}>
        <BadgeIcon 
          iconName={badge.icon}
          className={cn(iconSizes[size], "text-white drop-shadow-md")} 
        />
      </div>
      
      {/* Badge info tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap max-w-xs">
          <div className="font-semibold">{badge.name}</div>
          <div className="text-gray-300 text-xs">{badge.description}</div>
          {earned && earnedAt && (
            <div className="text-gray-400 text-xs mt-1">
              Earned {new Date(earnedAt).toLocaleDateString()}
            </div>
          )}
          {!earned && (
            <div className="text-gray-400 text-xs mt-1">Not earned</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface BadgeGridProps {
  userBadges: UserBadgeWithBadge[];
  allBadges: Badge[];
  title?: string;
}

export function BadgeGrid({ userBadges, allBadges, title = "Achievements" }: BadgeGridProps) {
  const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId));

  // Group badges by category
  const badgesByCategory = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  const categoryTitles = {
    accuracy: "Prediction Accuracy",
    volume: "Trading Volume", 
    experience: "Experience"
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      
      {Object.entries(badgesByCategory).map(([category, badges]) => (
        <div key={category} className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {categoryTitles[category as keyof typeof categoryTitles] || category}
          </h4>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {badges.map((badge) => {
              const userBadge = userBadges.find(ub => ub.badgeId === badge.id);
              return (
                <BadgeDisplay
                  key={badge.id}
                  badge={badge}
                  earned={earnedBadgeIds.has(badge.id)}
                  earnedAt={userBadge?.earnedAt || undefined}
                  size="md"
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface BadgeNotificationProps {
  badges: UserBadgeWithBadge[];
  onClose: () => void;
}

export function BadgeNotification({ badges, onClose }: BadgeNotificationProps) {
  if (badges.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6" />
            <div>
              <h4 className="font-semibold">New Achievement{badges.length > 1 ? 's' : ''}!</h4>
              <div className="text-sm space-y-1">
                {badges.map(userBadge => (
                  <div key={userBadge.badge.id}>{userBadge.badge.name}</div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}