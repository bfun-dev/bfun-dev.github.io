import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, BarChart3, Plus, User, LogOut, Filter, CheckCircle, Clock, Circle, Trophy, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFilters } from "@/contexts/FilterContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

interface Category {
  id: number;
  name: string;
  color: string;
}

export default function MetronicSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const { selectedCategories, setSelectedCategories, status, setStatus } = useFilters();
  const isMobile = useIsMobile();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

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
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Icon anchors - hidden on mobile */}
      {!isMobile && (
        <>
          <div 
            className="fixed left-0 top-0 bottom-0 w-12 z-50 bg-background border-r border-border flex flex-col items-center pt-16"
            onMouseEnter={() => setIsHovered(true)}
          >
            <div className={`flex flex-col space-y-4 mt-4 transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
              <Link href="/">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/60 transition-colors cursor-pointer">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/portfolio">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/60 transition-colors cursor-pointer">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/create">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/60 transition-colors cursor-pointer">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/achievements">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/60 transition-colors cursor-pointer">
                  <Trophy className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/wallet">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent/60 transition-colors cursor-pointer">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            </div>
          </div>

          {/* Hover trigger area */}
          <div 
            className="fixed left-0 top-0 bottom-0 w-12 z-60"
            onMouseEnter={() => setIsHovered(true)}
          />
        </>
      )}
      
      {/* Full Sidebar */}
      <div 
        className={`kt-sidebar bg-background border-e border-e-border fixed top-0 bottom-0 z-50 flex flex-col items-stretch shrink-0 transition-all duration-300 shadow-lg ${
          isHovered ? 'w-[250px] translate-x-12' : 'w-[250px] -translate-x-full'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* Sidebar Header */}
        <div className="kt-sidebar-header flex items-center relative justify-between px-3 lg:px-6 shrink-0 h-16 border-b border-border">
          <Link href="/" className="flex items-center">
            <TrendingUp className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground ml-3">Bets.Fun</span>
          </Link>
        </div>

        {/* Sidebar Content */}
        <div className="kt-sidebar-content flex flex-col grow py-5 px-2">
          <div className="kt-scrollable grow flex flex-col px-3 space-y-1">
            
            {/* Main Navigation */}
            <div className="kt-menu flex flex-col gap-1">
              
              {/* Markets */}
              <div className="kt-menu-item">
                <Link href="/">
                  <div className={`kt-menu-link flex items-center cursor-pointer border border-transparent gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors ${
                    location === "/" ? "bg-accent/60 text-primary" : "text-foreground"
                  }`}>
                    <span className="kt-menu-icon text-muted-foreground w-5">
                      <TrendingUp className="w-5 h-5" />
                    </span>
                    <span className="kt-menu-title text-sm font-medium">
                      Markets
                    </span>
                  </div>
                </Link>
              </div>

              {/* Portfolio */}
              <div className="kt-menu-item">
                <Link href="/portfolio">
                  <div className={`kt-menu-link flex items-center cursor-pointer border border-transparent gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors ${
                    location === "/portfolio" ? "bg-accent/60 text-primary" : "text-foreground"
                  }`}>
                    <span className="kt-menu-icon text-muted-foreground w-5">
                      <BarChart3 className="w-5 h-5" />
                    </span>
                    <span className="kt-menu-title text-sm font-medium">
                      Portfolio
                    </span>
                  </div>
                </Link>
              </div>

              {/* Create Market */}
              <div className="kt-menu-item">
                <Link href="/create">
                  <div className={`kt-menu-link flex items-center cursor-pointer border border-transparent gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors ${
                    location === "/create" ? "bg-accent/60 text-primary" : "text-foreground"
                  }`}>
                    <span className="kt-menu-icon text-muted-foreground w-5">
                      <Plus className="w-5 h-5" />
                    </span>
                    <span className="kt-menu-title text-sm font-medium">
                      Create Market
                    </span>
                  </div>
                </Link>
              </div>

              {/* Achievements */}
              <div className="kt-menu-item">
                <Link href="/achievements">
                  <div className={`kt-menu-link flex items-center cursor-pointer border border-transparent gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors ${
                    location === "/achievements" ? "bg-accent/60 text-primary" : "text-foreground"
                  }`}>
                    <span className="kt-menu-icon text-muted-foreground w-5">
                      <Trophy className="w-5 h-5" />
                    </span>
                    <span className="kt-menu-title text-sm font-medium">
                      Achievements
                    </span>
                  </div>
                </Link>
              </div>

              {/* Wallet */}
              <div className="kt-menu-item">
                <Link href="/wallet">
                  <div className={`kt-menu-link flex items-center cursor-pointer border border-transparent gap-3 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors ${
                    location === "/wallet" ? "bg-accent/60 text-primary" : "text-foreground"
                  }`}>
                    <span className="kt-menu-icon text-muted-foreground w-5">
                      <Wallet className="w-5 h-5" />
                    </span>
                    <span className="kt-menu-title text-sm font-medium">
                      My Wallet
                    </span>
                  </div>
                </Link>
              </div>

              {/* Filter Section */}
              <div className="kt-menu-item pt-6 pb-2">
                <span className="kt-menu-heading uppercase text-xs font-medium text-muted-foreground px-3 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Filters
                </span>
              </div>

              {/* Status Filter */}
              <div className="kt-menu-item pb-4">
                <div className="px-3">
                  <span className="text-xs font-medium text-muted-foreground mb-2 block">Status</span>
                  <RadioGroup value={status} onValueChange={setStatus} className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" className="w-3 h-3" />
                      <Label htmlFor="all" className="text-xs cursor-pointer">All Markets</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="active" id="active" className="w-3 h-3" />
                      <Label htmlFor="active" className="text-xs cursor-pointer flex items-center gap-1">
                        <Circle className="w-2 h-2 text-green-500 fill-green-500" />
                        Active
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="resolved" id="resolved" className="w-3 h-3" />
                      <Label htmlFor="resolved" className="text-xs cursor-pointer flex items-center gap-1">
                        <CheckCircle className="w-2 h-2 text-blue-500" />
                        Resolved
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Categories Filter */}
              <div className="kt-menu-item pb-2">
                <div className="px-3">
                  <span className="text-xs font-medium text-muted-foreground mb-2 block">Categories</span>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories([...selectedCategories, category.id]);
                            } else {
                              setSelectedCategories(selectedCategories.filter((id: number) => id !== category.id));
                            }
                          }}
                          className="w-3 h-3"
                        />
                        <Label 
                          htmlFor={`category-${category.id}`} 
                          className="text-xs cursor-pointer flex items-center gap-2 flex-1"
                        >
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          ></div>
                          {category.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>


    </>
  );
}