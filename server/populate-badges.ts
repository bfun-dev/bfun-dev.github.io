import { storage } from "./storage";
import type { InsertBadge } from "@shared/schema";

const sampleBadges: InsertBadge[] = [
  // Accuracy badges
  {
    name: "Sharp Shooter",
    description: "Achieve 60% prediction accuracy",
    icon: "Target",
    category: "accuracy",
    threshold: "60",
    color: "#10B981",
    rarity: "common"
  },
  {
    name: "Oracle",
    description: "Achieve 75% prediction accuracy",
    icon: "Eye",
    category: "accuracy",
    threshold: "75",
    color: "#3B82F6",
    rarity: "rare"
  },
  {
    name: "Prophet",
    description: "Achieve 85% prediction accuracy",
    icon: "Crown",
    category: "accuracy",
    threshold: "85",
    color: "#8B5CF6",
    rarity: "epic"
  },
  {
    name: "Nostradamus",
    description: "Achieve 95% prediction accuracy",
    icon: "Zap",
    category: "accuracy",
    threshold: "95",
    color: "#F59E0B",
    rarity: "legendary"
  },

  // Volume badges
  {
    name: "First Win",
    description: "Earn your first $10 in winnings",
    icon: "DollarSign",
    category: "volume",
    threshold: "10",
    color: "#10B981",
    rarity: "common"
  },
  {
    name: "High Roller",
    description: "Earn $100 in total winnings",
    icon: "TrendingUp",
    category: "volume",
    threshold: "100",
    color: "#3B82F6",
    rarity: "rare"
  },
  {
    name: "Market Whale",
    description: "Earn $500 in total winnings",
    icon: "Gem",
    category: "volume",
    threshold: "500",
    color: "#8B5CF6",
    rarity: "epic"
  },
  {
    name: "Prediction Tycoon",
    description: "Earn $1000 in total winnings",
    icon: "Trophy",
    category: "volume",
    threshold: "1000",
    color: "#F59E0B",
    rarity: "legendary"
  },

  // Experience badges
  {
    name: "Getting Started",
    description: "Place your first 5 bets",
    icon: "Play",
    category: "experience",
    threshold: "5",
    color: "#10B981",
    rarity: "common"
  },
  {
    name: "Active Trader",
    description: "Place 25 bets",
    icon: "BarChart3",
    category: "experience",
    threshold: "25",
    color: "#3B82F6",
    rarity: "rare"
  },
  {
    name: "Market Veteran",
    description: "Place 100 bets",
    icon: "Award",
    category: "experience",
    threshold: "100",
    color: "#8B5CF6",
    rarity: "epic"
  },
  {
    name: "Prediction Master",
    description: "Place 250 bets",
    icon: "Star",
    category: "experience",
    threshold: "250",
    color: "#F59E0B",
    rarity: "legendary"
  }
];

async function populateBadges() {
  try {
    console.log("Populating badges...");
    
    for (const badge of sampleBadges) {
      await storage.createBadge(badge);
      console.log(`Created badge: ${badge.name}`);
    }
    
    console.log("Badges populated successfully!");
  } catch (error) {
    console.error("Error populating badges:", error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  populateBadges().then(() => process.exit(0));
}

export { populateBadges };