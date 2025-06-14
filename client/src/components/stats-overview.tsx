import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, BarChart3, Trophy } from "lucide-react";

interface MarketStats {
  totalVolume: string;
  activeUsers: number;
  totalMarkets: number;
  resolvedMarkets: number;
}

export default function StatsOverview() {
  const { data: stats, isLoading } = useQuery<MarketStats>({
    queryKey: ['/api/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="bg-gray-200 p-3 rounded-lg">
                  <div className="h-6 w-6 bg-gray-300 rounded"></div>
                </div>
                <div className="ml-4">
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Total Volume",
      value: `$${parseFloat(stats?.totalVolume || "0").toLocaleString()}`,
      icon: TrendingUp,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Active Users",
      value: `${(stats?.activeUsers || 0).toLocaleString()}`,
      icon: Users,
      bgColor: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Markets",
      value: `${stats?.totalMarkets || 0}`,
      icon: BarChart3,
      bgColor: "bg-secondary/10",
      iconColor: "text-secondary",
    },
    {
      title: "Resolved",
      value: `${stats?.resolvedMarkets || 0}`,
      icon: Trophy,
      bgColor: "bg-error/10",
      iconColor: "text-error",
    },
  ];

  return null;
}
