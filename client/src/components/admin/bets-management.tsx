import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, TrendingUp, DollarSign, CheckCircle, XCircle, Clock, Eye, Edit, Settings, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { adminApiRequest, adminQueryFn } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface AdminBet {
  id: number;
  userId: string;
  marketId: number;
  amount: string;
  side: boolean;
  price: string;
  shares: string;
  resolved: boolean;
  payout: string | null;
  createdAt: string;
  platformFee?: string;
  creatorFee?: string;
  user: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  market: {
    title: string;
    resolved: boolean | null;
    outcome: boolean | null;
  };
}

const editBetSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  side: z.boolean(),
  price: z.string().min(1, "Price is required"),
  shares: z.string().min(1, "Shares is required"),
  resolved: z.boolean(),
  payout: z.string().optional(),
  platformFee: z.string().optional(),
  creatorFee: z.string().optional(),
});

const resolveBetSchema = z.object({
  outcome: z.boolean(),
  payout: z.string().min(1, "Payout amount is required"),
  platformFee: z.string().optional(),
  creatorFee: z.string().optional(),
});

interface BetStats {
  totalBets: number;
  totalVolume: string;
  resolvedBets: number;
  pendingBets: number;
  totalPayouts: string;
}

export default function BetsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [selectedBet, setSelectedBet] = useState<AdminBet | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [feesDialogOpen, setFeesDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const editForm = useForm<z.infer<typeof editBetSchema>>({
    resolver: zodResolver(editBetSchema),
    defaultValues: {
      amount: "",
      side: true,
      price: "",
      shares: "",
      resolved: false,
      payout: "",
      platformFee: "2.5",
      creatorFee: "1.0",
    },
  });

  const resolveForm = useForm<z.infer<typeof resolveBetSchema>>({
    resolver: zodResolver(resolveBetSchema),
    defaultValues: {
      outcome: true,
      payout: "",
      platformFee: "2.5",
      creatorFee: "1.0",
    },
  });

  const { data: bets = [], isLoading } = useQuery<AdminBet[]>({
    queryKey: ["/api/admin/bets"],
    queryFn: adminQueryFn,
    refetchInterval: 30000,
  });

  const { data: betStats } = useQuery<BetStats>({
    queryKey: ["/api/admin/bet-stats"],
    queryFn: adminQueryFn,
  });

  const editBetMutation = useMutation({
    mutationFn: async (data: { betId: number; updates: z.infer<typeof editBetSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/bets/${data.betId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bet-stats"] });
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Bet updated successfully",
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

  const resolveBetMutation = useMutation({
    mutationFn: async (data: { betId: number; resolve: z.infer<typeof resolveBetSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/bets/${data.betId}/resolve`, data.resolve);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bet-stats"] });
      setResolveDialogOpen(false);
      toast({
        title: "Success",
        description: "Bet resolved successfully",
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

  const updateFeesMutation = useMutation({
    mutationFn: async (data: { betId: number; platformFee: string; creatorFee: string }) => {
      return adminApiRequest("PATCH", `/api/admin/bets/${data.betId}/fees`, { 
        platformFee: data.platformFee, 
        creatorFee: data.creatorFee 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bet-stats"] });
      setFeesDialogOpen(false);
      toast({
        title: "Success",
        description: "Bet fees updated successfully",
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

  const filteredBets = bets.filter(bet => {
    const matchesSearch = 
      bet.user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.id.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "resolved" && bet.resolved) ||
      (statusFilter === "pending" && !bet.resolved);

    const matchesSide = sideFilter === "all" ||
      (sideFilter === "yes" && bet.side) ||
      (sideFilter === "no" && !bet.side);

    return matchesSearch && matchesStatus && matchesSide;
  }).sort((a, b) => {
    // Sort active bets first, then resolved bets
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1; // Active bets (resolved=false) first
    }
    // Within each group, sort by creation date (newest first)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const formatBalance = (balance: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(balance));
  };

  const getUserDisplayName = (user: AdminBet['user']) => {
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
    return user.email || "Unknown User";
  };

  const handleViewDetails = (bet: AdminBet) => {
    setSelectedBet(bet);
    setDetailsDialogOpen(true);
  };

  const handleEditBet = (bet: AdminBet) => {
    setSelectedBet(bet);
    editForm.reset({
      amount: bet.amount,
      side: bet.side,
      price: bet.price,
      shares: bet.shares,
      resolved: bet.resolved,
      payout: bet.payout || "",
      platformFee: bet.platformFee || "2.5",
      creatorFee: bet.creatorFee || "1.0",
    });
    setEditDialogOpen(true);
  };

  const handleResolveBet = (bet: AdminBet) => {
    setSelectedBet(bet);
    resolveForm.reset({
      outcome: true,
      payout: "",
      platformFee: bet.platformFee || "2.5",
      creatorFee: bet.creatorFee || "1.0",
    });
    setResolveDialogOpen(true);
  };

  const handleManageFees = (bet: AdminBet) => {
    setSelectedBet(bet);
    setFeesDialogOpen(true);
  };

  const onEditSubmit = (values: z.infer<typeof editBetSchema>) => {
    if (!selectedBet) return;
    editBetMutation.mutate({
      betId: selectedBet.id,
      updates: values,
    });
  };

  const onResolveSubmit = (values: z.infer<typeof resolveBetSchema>) => {
    if (!selectedBet) return;
    resolveBetMutation.mutate({
      betId: selectedBet.id,
      resolve: values,
    });
  };

  const onFeesUpdate = (platformFee: string, creatorFee: string) => {
    if (!selectedBet) return;
    updateFeesMutation.mutate({
      betId: selectedBet.id,
      platformFee,
      creatorFee,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{betStats?.totalBets || bets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {betStats?.totalVolume ? formatBalance(betStats.totalVolume) : formatBalance(bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0).toString())}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {betStats?.resolvedBets || bets.filter(bet => bet.resolved).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {betStats?.pendingBets || bets.filter(bet => !bet.resolved).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {betStats?.totalPayouts ? formatBalance(betStats.totalPayouts) : formatBalance(bets.filter(bet => bet.payout).reduce((sum, bet) => sum + parseFloat(bet.payout || "0"), 0).toString())}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Bets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bets Management</CardTitle>
          <CardDescription>
            Monitor and manage all platform bets
          </CardDescription>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search bets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sides</SelectItem>
                <SelectItem value="yes">YES</SelectItem>
                <SelectItem value="no">NO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading bets...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bet ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBets.map((bet) => (
                  <TableRow key={bet.id}>
                    <TableCell className="font-mono">#{bet.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{getUserDisplayName(bet.user)}</div>
                      <div className="text-sm text-gray-500">{bet.user.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={bet.market.title}>
                        {bet.market.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={bet.side ? "default" : "secondary"}
                        className={bet.side ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}
                      >
                        {bet.side ? "YES" : "NO"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{formatBalance(bet.amount)}</TableCell>
                    <TableCell className="font-mono">{parseFloat(bet.price).toFixed(2)}</TableCell>
                    <TableCell className="font-mono">{parseFloat(bet.shares).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={bet.resolved ? "default" : "outline"}>
                        {bet.resolved ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <Clock className="w-3 h-3 mr-1" />
                        )}
                        {bet.resolved ? "Resolved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {bet.payout ? formatBalance(bet.payout) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(bet.createdAt), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(bet)}
                          title="View Details"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBet(bet)}
                          title="Edit Bet"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        {!bet.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveBet(bet)}
                            className="text-green-600 hover:text-green-700"
                            title="Resolve Bet"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageFees(bet)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Manage Fees"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bet Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bet Details #{selectedBet?.id}</DialogTitle>
            <DialogDescription>
              Complete information about this bet
            </DialogDescription>
          </DialogHeader>
          {selectedBet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">User Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Name:</span> {getUserDisplayName(selectedBet.user)}</div>
                    <div><span className="text-gray-500">Email:</span> {selectedBet.user.email || "Not provided"}</div>
                    <div><span className="text-gray-500">User ID:</span> {selectedBet.userId}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Market Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Title:</span> {selectedBet.market.title}</div>
                    <div><span className="text-gray-500">Market ID:</span> {selectedBet.marketId}</div>
                    <div><span className="text-gray-500">Market Status:</span> {selectedBet.market.resolved ? "Resolved" : "Active"}</div>
                    {selectedBet.market.outcome !== null && (
                      <div><span className="text-gray-500">Outcome:</span> {selectedBet.market.outcome ? "YES" : "NO"}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Bet Details</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Side:</span> <Badge variant={selectedBet.side ? "default" : "secondary"}>{selectedBet.side ? "YES" : "NO"}</Badge></div>
                    <div><span className="text-gray-500">Amount:</span> {formatBalance(selectedBet.amount)}</div>
                    <div><span className="text-gray-500">Price:</span> {parseFloat(selectedBet.price).toFixed(4)}</div>
                    <div><span className="text-gray-500">Shares:</span> {parseFloat(selectedBet.shares).toFixed(4)}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Resolution</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-500">Status:</span> <Badge variant={selectedBet.resolved ? "default" : "outline"}>{selectedBet.resolved ? "Resolved" : "Pending"}</Badge></div>
                    <div><span className="text-gray-500">Payout:</span> {selectedBet.payout ? formatBalance(selectedBet.payout) : "Not resolved"}</div>
                    <div><span className="text-gray-500">Date:</span> {format(new Date(selectedBet.createdAt), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                </div>
              </div>

              {!selectedBet.resolved && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Quick Actions</h4>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolveBet(selectedBet)}
                      disabled={resolveBetMutation.isPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolve Bet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBet(selectedBet)}
                      disabled={editBetMutation.isPending}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit Details
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Bet Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Bet #{selectedBet?.id}</DialogTitle>
            <DialogDescription>
              Modify all bet details including amounts, prices, and resolution status
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bet Amount (USD)</FormLabel>
                      <FormControl>
                        <Input placeholder="100.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input placeholder="0.65" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="shares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shares</FormLabel>
                      <FormControl>
                        <Input placeholder="153.85" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="side"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bet Side</FormLabel>
                      <FormControl>
                        <Select value={field.value ? "yes" : "no"} onValueChange={(value) => field.onChange(value === "yes")}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">YES</SelectItem>
                            <SelectItem value="no">NO</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="platformFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Fee (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="2.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="creatorFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creator Fee (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="resolved"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Resolved Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this bet as resolved or pending
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {editForm.watch("resolved") && (
                <FormField
                  control={editForm.control}
                  name="payout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout Amount (USD)</FormLabel>
                      <FormControl>
                        <Input placeholder="153.85" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editBetMutation.isPending}>
                  {editBetMutation.isPending ? "Updating..." : "Update Bet"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Resolve Bet Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Bet #{selectedBet?.id}</DialogTitle>
            <DialogDescription>
              Determine the outcome and payout for this bet
            </DialogDescription>
          </DialogHeader>
          <Form {...resolveForm}>
            <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-4">
              <FormField
                control={resolveForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bet Outcome</FormLabel>
                    <FormControl>
                      <Select value={field.value ? "yes" : "no"} onValueChange={(value) => field.onChange(value === "yes")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">YES (Win)</SelectItem>
                          <SelectItem value="no">NO (Loss)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resolveForm.control}
                name="payout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payout Amount (USD)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={resolveForm.control}
                  name="platformFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Fee (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="2.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resolveForm.control}
                  name="creatorFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Creator Fee (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resolveBetMutation.isPending}>
                  {resolveBetMutation.isPending ? "Resolving..." : "Resolve Bet"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Fees Dialog */}
      <Dialog open={feesDialogOpen} onOpenChange={setFeesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Fees - Bet #{selectedBet?.id}</DialogTitle>
            <DialogDescription>
              Adjust platform and creator fee percentages for this bet
            </DialogDescription>
          </DialogHeader>
          {selectedBet && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Platform Fee (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={selectedBet.platformFee || "2.5"}
                    id="platform-fee"
                    placeholder="2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Creator Fee (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={selectedBet.creatorFee || "1.0"}
                    id="creator-fee"
                    placeholder="1.0"
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <h4 className="font-medium text-sm mb-2">Fee Calculation Preview</h4>
                <div className="text-xs space-y-1">
                  <div>Bet Amount: {formatBalance(selectedBet.amount)}</div>
                  <div>Platform Fee: ${((parseFloat(selectedBet.amount) * (parseFloat(selectedBet.platformFee || "2.5") / 100))).toFixed(2)}</div>
                  <div>Creator Fee: ${((parseFloat(selectedBet.amount) * (parseFloat(selectedBet.creatorFee || "1.0") / 100))).toFixed(2)}</div>
                  <div className="border-t pt-1 font-medium">
                    Net Amount: ${(parseFloat(selectedBet.amount) - 
                      (parseFloat(selectedBet.amount) * (parseFloat(selectedBet.platformFee || "2.5") / 100)) - 
                      (parseFloat(selectedBet.amount) * (parseFloat(selectedBet.creatorFee || "1.0") / 100))).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setFeesDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    const platformFee = (document.getElementById("platform-fee") as HTMLInputElement)?.value || "2.5";
                    const creatorFee = (document.getElementById("creator-fee") as HTMLInputElement)?.value || "1.0";
                    onFeesUpdate(platformFee, creatorFee);
                  }}
                  disabled={updateFeesMutation.isPending}
                >
                  {updateFeesMutation.isPending ? "Updating..." : "Update Fees"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}