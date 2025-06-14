import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Edit, DollarSign, User, Calendar, Mail, Wallet } from "lucide-react";
import { format } from "date-fns";
import { adminApiRequest, adminQueryFn } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  balance: string;
  createdAt: string;
  walletAddress: string | null;
  hasSeenTutorial: boolean;
  totalBets: number;
  totalWinnings: string;
}

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  balance: z.string().min(0),
});

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: adminQueryFn,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const safeUsers = users || [];

  const { data: userStats = {} } = useQuery({
    queryKey: ["/api/admin/user-stats"],
    queryFn: adminQueryFn,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: z.infer<typeof updateUserSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/users/${data.userId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      balance: "0",
    },
  });

  const filteredUsers = safeUsers.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    form.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      balance: user.balance,
    });
    setEditDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof updateUserSchema>) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      userId: selectedUser.id,
      updates: data,
    });
  };

  const formatBalance = (balance: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(balance));
  };

  const getUserDisplayName = (user: AdminUser) => {
    // Prioritize username if set (not system-generated)
    if (user.username && !user.username.startsWith('user_')) {
      return user.username;
    }
    // Fall back to first/last name for users without custom usernames
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.lastName) return user.lastName;
    return user.email || user.id.slice(0, 8) + "...";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(userStats as any)?.activeUsers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBalance(safeUsers.reduce((sum, user) => sum + parseFloat(user.balance || "0"), 0).toString())}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users (24h)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeUsers.filter(user => {
                const userDate = new Date(user.createdAt);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return userDate > yesterday;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user accounts, balances, and information
          </CardDescription>
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Total Bets</TableHead>
                      <TableHead>Winnings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium">{getUserDisplayName(user)}</div>
                          {user.username && !user.username.startsWith('user_') && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">@{user.username}</div>
                          )}
                          {user.firstName || user.lastName ? (
                            <div className="text-sm text-gray-500">
                              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.lastName)}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">{user.id.slice(0, 12)}...</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{user.email || "No email"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(user.balance)}
                    </TableCell>
                    <TableCell>{user.totalBets}</TableCell>
                    <TableCell className="font-mono">
                      {formatBalance(user.totalWinnings)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {user.walletAddress && (
                          <Badge variant="secondary" className="text-xs">
                            <Wallet className="w-3 h-3 mr-1" />
                            Wallet
                          </Badge>
                        )}
                        {user.hasSeenTutorial && (
                          <Badge variant="outline" className="text-xs">
                            Onboarded
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(user.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{getUserDisplayName(user)}</div>
                            {user.username && !user.username.startsWith('user_') && (
                              <div className="text-xs text-blue-600 dark:text-blue-400">@{user.username}</div>
                            )}
                            <div className="text-xs text-gray-500">{user.email || 'No email'}</div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs">Balance</div>
                          <div className="font-medium">{formatBalance(user.balance)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Total Bets</div>
                          <div className="font-medium">{user.totalBets}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Winnings</div>
                          <div className="font-medium">{formatBalance(user.totalWinnings)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Status</div>
                          <Badge variant={user.hasSeenTutorial ? "default" : "secondary"}>
                            {user.hasSeenTutorial ? "Active" : "New"}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        Joined {format(new Date(user.createdAt), "MMM dd, yyyy")}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-full max-w-sm md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Edit User</DialogTitle>
            <DialogDescription className="text-sm md:text-base">
              Update user information and balance
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Balance (USD)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? "Updating..." : "Update User"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}