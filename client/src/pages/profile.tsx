import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Palette, Settings, Trophy, BarChart3 } from "lucide-react";
import { BadgeIcon } from "@/lib/badge-icons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AvatarGenerator, { type AvatarConfig } from "@/components/avatar-generator";
import type { UserBadgeWithBadge } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("avatar");

  // Fetch user badges
  const { data: userBadges = [] } = useQuery<UserBadgeWithBadge[]>({
    queryKey: ['/api/user/badges', user?.id],
    enabled: !!user?.id,
  });

  // Avatar update mutation
  const avatarMutation = useMutation({
    mutationFn: async ({ avatarSvg, avatarConfig }: { avatarSvg: string; avatarConfig: AvatarConfig }) => {
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatarSvg, avatarConfig }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to update avatar');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Updated",
        description: "Your avatar has been successfully updated!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update avatar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAvatarSave = (avatarSvg: string, config: AvatarConfig) => {
    avatarMutation.mutate({ avatarSvg, avatarConfig: config });
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

  const recentBadges = userBadges
    .sort((a, b) => new Date(b.earnedAt || 0).getTime() - new Date(a.earnedAt || 0).getTime())
    .slice(0, 3);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-muted-foreground">Please log in to view your profile</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background min-h-screen ${isMobile ? 'ml-0' : 'ml-12'}`}>
      <div className={`p-6 ${isMobile ? 'pt-3 pb-[90px] pl-4 pr-4' : 'pt-[24px] pb-[24px]'}`}>
        <div className={isMobile ? 'space-y-3' : 'space-y-6'}>
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Current Avatar Display */}
                <div className="flex-shrink-0">
                  {user.avatarSvg ? (
                    <div 
                      className="w-24 h-24 rounded-full border-4 border-primary/20"
                      dangerouslySetInnerHTML={{ __html: user.avatarSvg }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-2xl font-bold text-foreground">{getUserDisplayName()}</h1>
                  <p className="text-muted-foreground">{user.email}</p>
                  <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-success">
                        ${parseFloat(user.balance || "0").toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Balance</div>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">{userBadges.length}</div>
                      <div className="text-sm text-muted-foreground">Badges</div>
                    </div>
                  </div>
                </div>

                {/* Recent Badges */}
                {recentBadges.length > 0 && (
                  <div className="flex-shrink-0">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Recent Badges</div>
                    <div className="flex gap-2">
                      {recentBadges.map((userBadge) => (
                        <div
                          key={userBadge.id}
                          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                          title={userBadge.badge.name}
                        >
                          <BadgeIcon iconName={userBadge.badge.icon} className="h-5 w-5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="avatar" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Avatar
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Achievements
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Avatar Tab */}
            <TabsContent value="avatar" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Avatar Generator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AvatarGenerator
                    onSave={handleAvatarSave}
                    initialConfig={user.avatarConfig as Partial<AvatarConfig> | undefined}
                    size={120}
                  />
                  {avatarMutation.isPending && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Saving avatar...
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Achievements Tab */}
            <TabsContent value="achievements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Your Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userBadges.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No badges earned yet</p>
                      <p className="text-sm text-muted-foreground">Start betting to earn your first achievement!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userBadges.map((userBadge) => (
                        <div
                          key={userBadge.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <BadgeIcon iconName={userBadge.badge.icon} className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground">{userBadge.badge.name}</h4>
                            <p className="text-sm text-muted-foreground">{userBadge.badge.description}</p>
                            {userBadge.earnedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Earned {new Date(userBadge.earnedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={user.email || ""} 
                      disabled 
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed as it's managed by authentication
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        value={user.firstName || ""} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        value={user.lastName || ""} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Account Created</Label>
                    <div className="text-sm text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Unknown'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}