import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Wallet, DollarSign, Shield, Target } from "lucide-react";
import UserManagement from "@/components/admin/user-management";
import BetsManagement from "@/components/admin/bets-management";
import MarketsManagement from "@/components/admin/markets-management";
import WalletsManagement from "@/components/admin/wallets-management";
import FundsManagement from "@/components/admin/funds-management";

interface AdminPanelProps {
  onLogout: () => void;
  adminToken: string | null;
}

export default function AdminPanel({ onLogout, adminToken }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Panel
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Manage users, bets, wallets, and funds across the platform
            </p>
          </div>
          <Button variant="outline" onClick={onLogout} className="w-full sm:w-auto">
            Logout
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 mb-4 md:mb-8">
            <TabsTrigger value="users" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Users className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Users</span>
              <span className="sm:hidden">Users</span>
            </TabsTrigger>
            <TabsTrigger value="bets" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Bets</span>
              <span className="sm:hidden">Bets</span>
            </TabsTrigger>
            <TabsTrigger value="markets" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Target className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Markets</span>
              <span className="sm:hidden">Markets</span>
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Wallet className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Wallets</span>
              <span className="sm:hidden">Wallets</span>
            </TabsTrigger>
            <TabsTrigger value="funds" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Funds</span>
              <span className="sm:hidden">Funds</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="bets">
            <BetsManagement />
          </TabsContent>

          <TabsContent value="markets">
            <MarketsManagement />
          </TabsContent>

          <TabsContent value="wallets">
            <WalletsManagement />
          </TabsContent>

          <TabsContent value="funds">
            <FundsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}