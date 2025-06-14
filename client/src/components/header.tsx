import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, User, LogOut, BarChart3, Sun, Moon, Trophy, Menu, TrendingUp, Wallet, ChevronDown, Smartphone, Loader2, Shield } from "lucide-react";
import { useWeb3Auth } from "@/hooks/useWeb3Auth";
import { useTheme } from "@/components/theme-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Badge, UserBadgeWithBadge } from "@shared/schema";
import { useTokenPrices, calculateTokenUSDValue } from "@/hooks/useTokenPrices";


export default function Header() {
  const { user, isAuthenticated, login, logout, isConnecting } = useWeb3Auth();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: tokenPrices } = useTokenPrices();

  // Fetch user badges and all badges for progress calculation
  const { data: userBadges = [] } = useQuery<UserBadgeWithBadge[]>({
    queryKey: ['/api/user/badges', user?.id],
    enabled: !!user?.id,
  });

  const { data: allBadges = [] } = useQuery<Badge[]>({
    queryKey: ['/api/badges'],
  });

  // Fetch wallet info to calculate total balance
  const { data: walletInfo } = useQuery<{
    ethereum?: {
      address: string;
      balance: string;
      tokens?: Array<{
        symbol: string;
        balance: string;
        name: string;
        decimals: number;
        logoURI?: string;
      }>;
    };
    solana?: {
      address: string;
      balance: string;
      tokens?: Array<{
        symbol: string;
        balance: string;
        name: string;
        decimals: number;
        logoURI?: string;
      }>;
    };
  }>({
    queryKey: ['/api/wallet'],
    enabled: !!user,
  });

  const calculateTotalBalance = () => {
    if (!walletInfo || !tokenPrices) return 0;
    
    let total = 0;
    
    // Ethereum balance
    if (walletInfo.ethereum?.balance) {
      total += calculateTokenUSDValue('ETH', parseFloat(walletInfo.ethereum.balance), tokenPrices);
    }
    
    // Ethereum tokens
    if (walletInfo.ethereum?.tokens) {
      walletInfo.ethereum.tokens.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
        if (usdValue > 0) {
          total += usdValue;
        }
      });
    }
    
    // Solana balance
    if (walletInfo.solana?.balance) {
      total += calculateTokenUSDValue('SOL', parseFloat(walletInfo.solana.balance), tokenPrices);
    }
    
    // Solana tokens
    if (walletInfo.solana?.tokens) {
      walletInfo.solana.tokens.forEach((token: any) => {
        const balance = parseFloat(token.balance || '0');
        const usdValue = calculateTokenUSDValue(token.symbol, balance, tokenPrices);
        if (usdValue > 0) {
          total += usdValue;
        }
      });
    }
    
    return total;
  };

  const getUserDisplayName = () => {
    // Prioritize username if set (not system-generated)
    if (user?.username && !user.username.startsWith('user_')) {
      return user.username;
    }
    // Fall back to first/last name for users without custom usernames
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    if (!name) return 'U';
    return name.split(' ').map((n: string) => n?.[0] || '').filter(Boolean).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <header className="bg-background border-b border-border flex items-center justify-between px-6 sticky top-0 z-40" style={{ height: '3.15rem' }} data-tutorial="header">
      {/* Left side - logo */}
      <div className={`flex items-center ${!isMobile ? 'ml-12' : ''}`}>
        <Link href="/">
          <h1 className="text-lg font-semibold text-foreground cursor-pointer transition-colors group">
            <span className="group-hover:text-[#6cd97e] transition-colors">Bets</span>
            <span>.</span>
            <span className="group-hover:text-[#ff6666] transition-colors">Fun</span>
          </h1>
        </Link>
      </div>

      {/* Right side - Authentication or Profile */}
      <div className="flex items-center space-x-3">
        {isAuthenticated && user ? (
          <>
            {/* Balance Display */}
            <div className={`bg-success/10 text-success rounded-full font-medium flex items-center gap-1 ${isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-1.5 text-base'}`}>
              <Wallet className={`${isMobile ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />
              ${calculateTotalBalance().toFixed(2)}
            </div>
            
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={`relative rounded-full border-2 border-yellow-400 ${isMobile ? 'h-7 w-7' : 'h-9 w-9'}`}>
                  <Avatar className={isMobile ? 'h-7 w-7' : 'h-9 w-9'}>
                    <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                    <AvatarFallback className={`bg-muted text-muted-foreground ${isMobile ? 'text-xs' : ''}`}>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-popover border-border" align="end" forceMount>
                <DropdownMenuItem className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-popover-foreground">{getUserDisplayName()}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuItem>
                {/* Wallet Information */}
                {user?.walletAddress && (
                  <DropdownMenuItem className="flex flex-col items-start px-4 py-2 space-y-1">
                    <div className="flex items-center text-sm font-medium text-popover-foreground">
                      <Wallet className="mr-2 h-4 w-4" />
                      <span>Connected Wallet</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-6">
                      {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                    </div>
                    {user.balance && (
                      <div className="text-xs text-muted-foreground ml-6">
                        Balance: ${parseFloat(user.balance).toFixed(2)}
                      </div>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center text-popover-foreground">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portfolio" className="flex items-center text-popover-foreground">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Portfolio</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  className="flex items-center text-popover-foreground cursor-pointer"
                >
                  <div className="mr-2 relative h-4 w-4">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute top-0 left-0 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </div>
                  <span>Toggle theme</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/admin'} className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-popover-foreground">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {/* Login/Signup Button for unauthenticated users */}
            <Button
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-[#ffffff] mr-2"
              onClick={() => login('web3auth')}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Login / Signup
                </>
              )}
            </Button>

          </>
        )}
      </div>
    </header>
  );
}