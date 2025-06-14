import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrendingUp, Plus, Menu, User, LogOut, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { href: "/", label: "Markets", active: location === "/" },
    { href: "/portfolio", label: "Portfolio", active: location === "/portfolio" },
    { href: "#leaderboard", label: "Leaderboard", active: false },
    { href: "#about", label: "About", active: false },
  ];

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
    <nav className="bg-card shadow-sm border-b border-border sticky top-0 z-50 backdrop-blur-md bg-card/95">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pr-[32px] ${!isMobile ? 'pl-[56px]' : 'pl-4'}`}>
        <div className="flex justify-between items-center h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-foreground">Bets.Fun</span>
            </Link>
            
            <div className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span className={`font-medium transition-colors ${
                    item.active 
                      ? 'text-foreground' 
                      : 'text-muted-foreground hover:text-primary'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/create">
              <Button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 px-3 py-2 hover:bg-primary/90 text-[12px] pt-[1px] pb-[1px] bg-[#bf95f96b] text-[#f5f9fd] pl-[9px] pr-[9px]">
                <Plus className="h-4 w-4" />
                Create Market
              </Button>
            </Link>
            
            <div className="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
              ${parseFloat(user?.balance || "0").toLocaleString()}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                    <AvatarFallback className="bg-muted text-muted-foreground">{getUserInitials()}</AvatarFallback>
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
                <DropdownMenuItem asChild>
                  <Link href="/portfolio" className="flex items-center text-popover-foreground">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Portfolio</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} className="text-popover-foreground">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6 text-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-card border-border">
                <div className="flex flex-col space-y-6 mt-6">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 pb-6 border-b border-border">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                      <AvatarFallback className="bg-muted text-muted-foreground">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{getUserDisplayName()}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <div className="bg-success/10 text-success px-2 py-1 rounded-full text-xs font-medium inline-block mt-1">
                        ${parseFloat(user?.balance || "0").toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Navigation Items */}
                  <div className="space-y-3">
                    {navItems.map((item) => (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className={`block py-2 px-3 rounded-lg transition-colors ${
                          item.active 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}>
                          {item.label}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-6 border-t border-border">
                    <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Market
                      </Button>
                    </Link>
                    
                    <Button 
                      variant="outline" 
                      className="w-full border-border text-foreground hover:bg-accent" 
                      onClick={() => window.location.href = '/api/logout'}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Log out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
