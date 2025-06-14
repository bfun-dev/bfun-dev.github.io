import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { FilterProvider } from "@/contexts/FilterContext";
import ErrorBoundary from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import MetronicSidebar from "@/components/metronic-sidebar";
import Header from "@/components/header";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import UsernamePrompt from "@/components/username-prompt";
import { useState, useEffect } from "react";

import Home from "@/pages/home";
import MarketDetail from "@/pages/market-detail";
import Portfolio from "@/pages/portfolio";
import CreateMarket from "@/pages/create-market";
import Achievements from "@/pages/achievements";
import Profile from "@/pages/profile";
import WalletPage from "@/pages/wallet";

import NotFound from "@/pages/not-found";
import AdminApp from "@/admin-app";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  // Show username prompt for authenticated users with system-generated usernames only
  // This runs on every page load to ensure users are always prompted when needed
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      // Only check if user has a system-generated username (starts with "user_")
      // Once they've set a custom username, they shouldn't be prompted again
      const hasSystemUsername = user.username && user.username.startsWith("user_");
      
      // Debug logging
      console.log("🔍 Username prompt analysis:", {
        userId: user.id,
        firstName: user.firstName,
        username: user.username,
        hasSystemUsername,
        shouldPrompt: hasSystemUsername
      });
      
      // Only prompt if they have a system-generated username
      setShowUsernamePrompt(hasSystemUsername);
    } else {
      setShowUsernamePrompt(false);
    }
  }, [isAuthenticated, user, isLoading]);

  // Always show the main interface immediately - don't block on auth loading
  // Auth will complete in background and update the UI when ready

  return (
    <ErrorBoundary>
      <FilterProvider>
        <div className="flex min-h-screen bg-background">
          {isAuthenticated && <MetronicSidebar />}
          <div 
            className="flex-1 flex flex-col" 
            style={{ 
              marginLeft: (isMobile || !isAuthenticated) ? '0px' : '60px', 
              marginRight: (isMobile || !isAuthenticated) ? '0px' : '12px' 
            }}
          >
            <Header />
            <main className={`flex-1 ${isMobile ? 'pb-16' : ''}`}>
              <ErrorBoundary>
                <Switch>
                  <Route path="/admin*">
                    <AdminApp />
                  </Route>
                  <Route path="/" component={Home} />
                  <Route path="/market/:id" component={MarketDetail} />
                  {isAuthenticated && <Route path="/portfolio" component={Portfolio} />}
                  {isAuthenticated && <Route path="/create" component={CreateMarket} />}
                  {isAuthenticated && <Route path="/achievements" component={Achievements} />}
                  {isAuthenticated && <Route path="/profile" component={Profile} />}
                  {isAuthenticated && <Route path="/wallet" component={WalletPage} />}
                  <Route path="/admin/*?" component={AdminApp} />
                  <Route component={NotFound} />
                </Switch>
              </ErrorBoundary>
            </main>
          </div>
          {isMobile && <MobileBottomNav />}
        </div>
        
        {/* Username prompt for users with system-generated usernames */}
        <UsernamePrompt
          open={showUsernamePrompt}
          onClose={() => setShowUsernamePrompt(false)}
          onSuccess={() => setShowUsernamePrompt(false)}
        />
      </FilterProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="bets-fun-theme">
        <TooltipProvider>
          <Toaster />
          <div suppressHydrationWarning>
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
