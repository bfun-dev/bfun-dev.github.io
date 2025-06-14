import { 
  Target, 
  Eye, 
  Crown, 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Gem, 
  Trophy, 
  Play, 
  BarChart3, 
  Award, 
  Star 
} from "lucide-react";

// Map badge icon names to Lucide React components
export const BadgeIconMap: Record<string, React.ComponentType<any>> = {
  Target,
  Eye,
  Crown,
  Zap,
  DollarSign,
  TrendingUp,
  Gem,
  Trophy,
  Play,
  BarChart3,
  Award,
  Star,
};

interface BadgeIconProps {
  iconName: string;
  className?: string;
  size?: number;
}

export function BadgeIcon({ iconName, className = "h-4 w-4", size }: BadgeIconProps) {
  const IconComponent = BadgeIconMap[iconName];
  
  if (!IconComponent) {
    // Fallback to Trophy if icon not found
    return <Trophy className={className} size={size} />;
  }
  
  return <IconComponent className={className} size={size} />;
}