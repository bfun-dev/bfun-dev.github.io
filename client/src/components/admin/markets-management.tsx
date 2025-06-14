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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, TrendingUp, DollarSign, CheckCircle, XCircle, Clock, Eye, Edit, Settings, Plus, Target, BarChart3, Upload, X, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { adminApiRequest, adminQueryFn } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface AdminMarket {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  creatorId: string;
  yesPrice: string;
  noPrice: string;
  yesPool: string;
  noPool: string;
  totalVolume: string;
  resolved: boolean | null;
  outcome: boolean | null;
  featured: boolean;
  resolvedAt: string | null;
  createdAt: string;
  category: {
    id: number;
    name: string;
    color: string;
  } | null;
  creator: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

interface MarketStats {
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
  featuredMarkets: number;
  totalVolume: string;
  averageVolume: string;
}

const editMarketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.number().min(1, "Category is required"),
  yesPrice: z.string().min(1, "Yes price is required"),
  noPrice: z.string().min(1, "No price is required"),
  yesPool: z.string().min(1, "Yes pool is required"),
  noPool: z.string().min(1, "No pool is required"),
  featured: z.boolean(),
  resolved: z.boolean(),
  outcome: z.boolean().optional(),
});

const createMarketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.number().min(1, "Category is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
  imageUrl: z.string().min(1, "Market image is required"),
  resolverUrl: z.string().min(1, "Resolution rules/link is required"),
  featured: z.boolean(),
});

const resolveMarketSchema = z.object({
  outcome: z.boolean(),
  resolutionNote: z.string().optional(),
});

export default function MarketsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<AdminMarket | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [feesDialogOpen, setFeesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const editForm = useForm<z.infer<typeof editMarketSchema>>({
    resolver: zodResolver(editMarketSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: 1,
      yesPrice: "0.50",
      noPrice: "0.50",
      yesPool: "1000.00",
      noPool: "1000.00",
      featured: false,
      resolved: false,
      outcome: false,
    },
  });

  const createForm = useForm<z.infer<typeof createMarketSchema>>({
    resolver: zodResolver(createMarketSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: 1,
      endDate: "",
      endTime: "",
      imageUrl: "",
      resolverUrl: "",
      featured: false,
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        createForm.setValue('imageUrl', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    createForm.setValue('imageUrl', '');
  };

  const resolveForm = useForm<z.infer<typeof resolveMarketSchema>>({
    resolver: zodResolver(resolveMarketSchema),
    defaultValues: {
      outcome: true,
      resolutionNote: "",
    },
  });

  const { data: markets = [], isLoading } = useQuery<AdminMarket[]>({
    queryKey: ["/api/admin/markets"],
    queryFn: adminQueryFn,
    refetchInterval: 30000,
  });

  const { data: marketStats } = useQuery<MarketStats>({
    queryKey: ["/api/admin/market-stats"],
    queryFn: adminQueryFn,
  });

  const { data: categories = [] } = useQuery<Array<{id: number; name: string; color: string}>>({
    queryKey: ["/api/categories"],
  });

  const editMarketMutation = useMutation({
    mutationFn: async (data: { marketId: number; updates: z.infer<typeof editMarketSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/markets/${data.marketId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-stats"] });
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Market updated successfully",
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

  const createMarketMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createMarketSchema>) => {
      return adminApiRequest("POST", "/api/admin/markets", {
        ...data,
        endDate: new Date(data.endDate).toISOString(),
        categoryId: parseInt(data.categoryId.toString()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-stats"] });
      setCreateDialogOpen(false);
      createForm.reset({
        title: "",
        description: "",
        categoryId: 1,
        endDate: "",
        endTime: "",
        imageUrl: "",
        resolverUrl: "",
        featured: false,
      });
      setImageFile(null);
      setImagePreview(null);
      toast({
        title: "Success",
        description: "Market created successfully",
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

  const resolveMarketMutation = useMutation({
    mutationFn: async (data: { marketId: number; resolve: z.infer<typeof resolveMarketSchema> }) => {
      return adminApiRequest("PATCH", `/api/admin/markets/${data.marketId}/resolve`, data.resolve);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-stats"] });
      setResolveDialogOpen(false);
      toast({
        title: "Success",
        description: "Market resolved successfully",
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

  const updateMarketFeesMutation = useMutation({
    mutationFn: async (data: { marketId: number; platformFee: string; creatorFee: string }) => {
      return adminApiRequest("PATCH", `/api/admin/markets/${data.marketId}/fees`, { 
        platformFee: data.platformFee, 
        creatorFee: data.creatorFee 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-stats"] });
      setFeesDialogOpen(false);
      toast({
        title: "Success",
        description: "Market fees updated successfully",
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

  const deleteMarketMutation = useMutation({
    mutationFn: async (marketId: number) => {
      return adminApiRequest("DELETE", `/api/admin/markets/${marketId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market-stats"] });
      toast({
        title: "Success",
        description: "Market deleted successfully",
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

  const filteredMarkets = markets.filter(market => {
    const matchesSearch = 
      market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.creator?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.creator?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.creator?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.id.toString().includes(searchTerm);

    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && !market.resolved) ||
      (statusFilter === "resolved" && market.resolved) ||
      (statusFilter === "featured" && market.featured);

    const matchesCategory = categoryFilter === "all" ||
      market.categoryId.toString() === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  }).sort((a, b) => {
    // Sort active markets first, then resolved markets
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1; // Active markets (resolved=false) first
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

  const getCreatorDisplayName = (creator: AdminMarket['creator']) => {
    if (!creator) return "System";
    
    // Prioritize username if set (not system-generated)
    if (creator.username && !creator.username.startsWith('user_')) {
      return creator.username;
    }
    // Fall back to first/last name for users without custom usernames
    if (creator.firstName && creator.lastName) {
      return `${creator.firstName} ${creator.lastName}`;
    }
    if (creator.firstName) return creator.firstName;
    if (creator.lastName) return creator.lastName;
    return creator.email || "Unknown User";
  };

  const handleViewDetails = (market: AdminMarket) => {
    setSelectedMarket(market);
    setDetailsDialogOpen(true);
  };

  const handleEditMarket = (market: AdminMarket) => {
    setSelectedMarket(market);
    editForm.reset({
      title: market.title,
      description: market.description,
      categoryId: market.categoryId,
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      yesPool: market.yesPool,
      noPool: market.noPool,
      featured: market.featured,
      resolved: market.resolved || false,
      outcome: market.outcome || false,
    });
    setEditDialogOpen(true);
  };

  const handleResolveMarket = (market: AdminMarket) => {
    setSelectedMarket(market);
    resolveForm.reset({
      outcome: true,
      resolutionNote: "",
    });
    setResolveDialogOpen(true);
  };

  const handleManageFees = (market: AdminMarket) => {
    setSelectedMarket(market);
    setFeesDialogOpen(true);
  };

  const handleDeleteMarket = (market: AdminMarket) => {
    setSelectedMarket(market);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteMarket = () => {
    if (!selectedMarket) return;
    deleteMarketMutation.mutate(selectedMarket.id);
    setDeleteDialogOpen(false);
  };

  const onEditSubmit = (values: z.infer<typeof editMarketSchema>) => {
    if (!selectedMarket) return;
    editMarketMutation.mutate({
      marketId: selectedMarket.id,
      updates: values,
    });
  };

  const onCreateSubmit = (values: z.infer<typeof createMarketSchema>) => {
    createMarketMutation.mutate(values);
  };

  const onResolveSubmit = (values: z.infer<typeof resolveMarketSchema>) => {
    if (!selectedMarket) return;
    resolveMarketMutation.mutate({
      marketId: selectedMarket.id,
      resolve: values,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Markets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats?.totalMarkets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Markets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats?.activeMarkets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Markets</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats?.resolvedMarkets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured Markets</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats?.featuredMarkets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats ? formatBalance(marketStats.totalVolume) : "$0"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketStats ? formatBalance(marketStats.averageVolume) : "$0"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Markets Management</CardTitle>
              <CardDescription>Manage all prediction markets on the platform</CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Market
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search markets, creators, or IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading markets...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMarkets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-mono">#{market.id}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium truncate" title={market.title}>
                          {market.title}
                        </div>
                        {market.featured && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {market.category && (
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: market.category.color, color: market.category.color }}
                        >
                          {market.category.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{getCreatorDisplayName(market.creator)}</div>
                        <div className="text-gray-500">{market.creator?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={market.resolved ? "default" : "outline"}>
                        {market.resolved ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolved
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Active
                          </>
                        )}
                      </Badge>
                      {market.resolved && market.outcome !== null && (
                        <div className="text-xs mt-1">
                          Outcome: <span className="font-medium">{market.outcome ? "YES" : "NO"}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center">
                          <span className="text-green-600 font-medium">YES</span>
                          <span className="ml-2">{parseFloat(market.yesPrice).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-red-600 font-medium">NO</span>
                          <span className="ml-2">{parseFloat(market.noPrice).toFixed(2)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{formatBalance(market.totalVolume)}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(market.createdAt), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(market)}
                          title="View Details"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMarket(market)}
                          title="Edit Market"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        {!market.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveMarket(market)}
                            className="text-green-600 hover:text-green-700"
                            title="Resolve Market"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageFees(market)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Manage Fees"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMarket(market)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Market"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Market Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Market Details #{selectedMarket?.id}</DialogTitle>
            <DialogDescription>
              Complete information about this prediction market
            </DialogDescription>
          </DialogHeader>
          {selectedMarket && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Market Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Title:</span> {selectedMarket.title}</div>
                    <div><span className="text-gray-500">Description:</span> {selectedMarket.description}</div>
                    <div><span className="text-gray-500">Category:</span> {selectedMarket.category?.name}</div>
                    <div><span className="text-gray-500">Creator:</span> {getCreatorDisplayName(selectedMarket.creator)}</div>
                    <div><span className="text-gray-500">Featured:</span> {selectedMarket.featured ? "Yes" : "No"}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Market Status</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Status:</span> <Badge variant={selectedMarket.resolved ? "default" : "outline"}>{selectedMarket.resolved ? "Resolved" : "Active"}</Badge></div>
                    {selectedMarket.resolved && selectedMarket.outcome !== null && (
                      <div><span className="text-gray-500">Outcome:</span> <Badge variant={selectedMarket.outcome ? "default" : "secondary"}>{selectedMarket.outcome ? "YES" : "NO"}</Badge></div>
                    )}
                    {selectedMarket.resolvedAt && (
                      <div><span className="text-gray-500">Resolved At:</span> {format(new Date(selectedMarket.resolvedAt), "MMM dd, yyyy HH:mm")}</div>
                    )}
                    <div><span className="text-gray-500">Created:</span> {format(new Date(selectedMarket.createdAt), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Price Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">YES Price:</span> {parseFloat(selectedMarket.yesPrice).toFixed(4)}</div>
                    <div><span className="text-gray-500">NO Price:</span> {parseFloat(selectedMarket.noPrice).toFixed(4)}</div>
                    <div><span className="text-gray-500">YES Pool:</span> {formatBalance(selectedMarket.yesPool)}</div>
                    <div><span className="text-gray-500">NO Pool:</span> {formatBalance(selectedMarket.noPool)}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Volume & Activity</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Total Volume:</span> {formatBalance(selectedMarket.totalVolume)}</div>
                    <div><span className="text-gray-500">Total Pool:</span> {formatBalance((parseFloat(selectedMarket.yesPool) + parseFloat(selectedMarket.noPool)).toString())}</div>
                  </div>
                </div>
              </div>

              {!selectedMarket.resolved && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Quick Actions</h4>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolveMarket(selectedMarket)}
                      disabled={resolveMarketMutation.isPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolve Market
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditMarket(selectedMarket)}
                      disabled={editMarketMutation.isPending}
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

      {/* Create Market Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Market</DialogTitle>
            <DialogDescription>
              Create a new prediction market for users to bet on
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Will Bitcoin reach $100k by end of 2024?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detailed description of the market conditions and resolution criteria..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="resolverUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Rules/Link *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/resolution-source OR detailed resolution criteria"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="text-sm text-muted-foreground">
                      Required: Link to resolution source OR detailed explanation of how this market will be resolved
                    </div>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4" />
                    Resolution Date & Time
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={createForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Select the date and time when this market should be resolved
                  </div>
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-4">
                <FormLabel>Market Image *</FormLabel>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Market preview"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={removeImage}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Click the X to remove this image
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <label htmlFor="admin-image-upload" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Upload an image
                          </span>
                          <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                            PNG, JPG, GIF up to 10MB
                          </span>
                        </label>
                        <input
                          id="admin-image-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={createForm.control}
                name="featured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Featured Market</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this market as featured on the homepage for increased visibility
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMarketMutation.isPending}>
                  {createMarketMutation.isPending ? "Creating..." : "Create Market"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Market Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Market #{selectedMarket?.id}</DialogTitle>
            <DialogDescription>
              Modify market details, pricing, and resolution status
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Market Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Market Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="featured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Featured</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Show on homepage
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="yesPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YES Price</FormLabel>
                      <FormControl>
                        <Input placeholder="0.65" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="noPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NO Price</FormLabel>
                      <FormControl>
                        <Input placeholder="0.35" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="yesPool"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YES Pool (USD)</FormLabel>
                      <FormControl>
                        <Input placeholder="1000.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="noPool"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NO Pool (USD)</FormLabel>
                      <FormControl>
                        <Input placeholder="1000.00" {...field} />
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
                        Mark this market as resolved
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
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Market Outcome</FormLabel>
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
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMarketMutation.isPending}>
                  {editMarketMutation.isPending ? "Updating..." : "Update Market"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Resolve Market Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Market #{selectedMarket?.id}</DialogTitle>
            <DialogDescription>
              Determine the final outcome for this prediction market
            </DialogDescription>
          </DialogHeader>
          <Form {...resolveForm}>
            <form onSubmit={resolveForm.handleSubmit(onResolveSubmit)} className="space-y-4">
              <FormField
                control={resolveForm.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Outcome</FormLabel>
                    <FormControl>
                      <Select value={field.value ? "yes" : "no"} onValueChange={(value) => field.onChange(value === "yes")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">YES (True)</SelectItem>
                          <SelectItem value="no">NO (False)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resolveForm.control}
                name="resolutionNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explanation of the resolution decision..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resolveMarketMutation.isPending}>
                  {resolveMarketMutation.isPending ? "Resolving..." : "Resolve Market"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Market Fees Dialog */}
      <Dialog open={feesDialogOpen} onOpenChange={setFeesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Fees - Market #{selectedMarket?.id}</DialogTitle>
            <DialogDescription>
              Adjust platform and creator fee percentages for this market
            </DialogDescription>
          </DialogHeader>
          {selectedMarket && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Platform Fee (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue="2.5"
                    id="market-platform-fee"
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
                    defaultValue="1.0"
                    id="market-creator-fee"
                    placeholder="1.0"
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <h4 className="font-medium text-sm mb-2">Fee Structure Overview</h4>
                <div className="text-xs space-y-1">
                  <div>Market Volume: {formatBalance(selectedMarket.totalVolume)}</div>
                  <div>Total Pool: {formatBalance((parseFloat(selectedMarket.yesPool) + parseFloat(selectedMarket.noPool)).toString())}</div>
                  <div className="border-t pt-1 font-medium">
                    Estimated Monthly Fees: ${((parseFloat(selectedMarket.totalVolume) * 0.035)).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setFeesDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    const platformFee = (document.getElementById("market-platform-fee") as HTMLInputElement)?.value || "2.5";
                    const creatorFee = (document.getElementById("market-creator-fee") as HTMLInputElement)?.value || "1.0";
                    updateMarketFeesMutation.mutate({
                      marketId: selectedMarket.id,
                      platformFee,
                      creatorFee,
                    });
                  }}
                  disabled={updateMarketFeesMutation.isPending}
                >
                  {updateMarketFeesMutation.isPending ? "Updating..." : "Update Fees"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Market</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this market? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedMarket && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedMarket.title}</div>
                <div className="text-sm text-gray-600">Market ID: #{selectedMarket.id}</div>
                <div className="text-sm text-gray-600">Total Volume: {formatBalance(selectedMarket.totalVolume)}</div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmDeleteMarket}
                  disabled={deleteMarketMutation.isPending}
                >
                  {deleteMarketMutation.isPending ? "Deleting..." : "Delete Market"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}