import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Trophy, Filter, User, Home, Wallet } from "lucide-react";
import { useFilters } from "@/contexts/FilterContext";
import SidebarFilters from "./sidebar-filters";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Web3AuthModal from "./web3auth-modal";

export default function MobileBottomNav() {
  const [location] = useLocation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { selectedCategories, setSelectedCategories, status, setStatus } = useFilters();
  const { isAuthenticated } = useAuth();

  // Only show filter on main markets page
  const showFilter = location === "/";
  const showHome = location !== "/";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-16 flex items-center justify-around px-2 md:hidden">
      {isAuthenticated ? (
        <>
          {/* Home Button - Show on all pages except main */}
          {showHome && (
            <Link href="/">
              <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 text-muted-foreground hover:text-foreground">
                <Home className="h-4 w-4" />
                <span className="text-xs">Home</span>
              </Button>
            </Link>
          )}

          {/* Badges Button - Authenticated only */}
          <Link href="/achievements">
            <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 text-muted-foreground hover:text-foreground">
              <Trophy className="h-4 w-4" />
              <span className="text-xs">Badges</span>
            </Button>
          </Link>
          
          {/* Create Market Button - Authenticated only */}
          <Link href="/create">
            <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
              <span className="text-xs">New Bet</span>
            </Button>
          </Link>

          {/* Wallet Button - Authenticated only */}
          <Link href="/wallet">
            <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 text-muted-foreground hover:text-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-xs">Wallet</span>
            </Button>
          </Link>

          {/* Filter Button - Authenticated only and only on main page */}
          {showFilter && (
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 text-muted-foreground hover:text-foreground">
                  <Filter className="h-4 w-4" />
                  <span className="text-xs">Filter</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filter Markets
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <SidebarFilters
                    selectedCategories={selectedCategories}
                    onCategoriesChange={setSelectedCategories}
                    status={status}
                    onStatusChange={setStatus}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </>
      ) : (
        <>
          {/* Home Button - Show on all pages except main for unauthenticated users */}
          {showHome && (
            <Link href="/">
              <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 hover:text-foreground text-[#ffffff]">
                <Home className="h-4 w-4" />
                <span className="text-xs">Home</span>
              </Button>
            </Link>
          )}

          {/* Filter Button - Unauthenticated users and only on main page */}
          {showFilter ? (
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="flex flex-col items-center gap-1 h-12 w-14 p-1 hover:text-foreground text-[#ffffff]">
                  <Filter className="h-4 w-4" />
                  <span className="text-xs">Filter</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filter Markets
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <SidebarFilters
                    selectedCategories={selectedCategories}
                    onCategoriesChange={setSelectedCategories}
                    status={status}
                    onStatusChange={setStatus}
                  />
                </div>
              </SheetContent>
            </Sheet>
          ) : !showHome ? (
            <div className="w-14"></div>
          ) : null}
          
          {/* Login Button - For unauthenticated users */}
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-12 w-14 p-1 hover:text-foreground text-[#ffffff]"
            onClick={() => setShowLoginModal(true)}
          >
            <User className="h-4 w-4" />
            <span className="text-xs">Login</span>
          </Button>
        </>
      )}

      {/* Web3Auth Login Modal */}
      <Web3AuthModal 
        open={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
}