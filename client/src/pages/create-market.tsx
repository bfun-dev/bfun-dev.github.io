import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMarketSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, Clock, Info, Upload, X, ExternalLink } from "lucide-react";
import type { Category } from "@shared/schema";
import { z } from "zod";

const createMarketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.number().min(1, "Category is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
  imageUrl: z.string().min(1, "Market image is required"),
  resolverUrl: z.string().min(1, "Resolution rules/link is required"),
  featured: z.boolean().optional().default(false),
});

type CreateMarketFormData = z.infer<typeof createMarketSchema>;

export default function CreateMarket() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateMarketFormData>({
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
        setValue('imageUrl', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setValue('imageUrl', '');
  };

  const createMarketMutation = useMutation({
    mutationFn: async (data: CreateMarketFormData) => {
      // Combine endDate and endTime into a complete datetime
      const combinedEndDate = new Date(`${data.endDate}T${data.endTime || '23:59'}:00.000Z`);
      
      const response = await apiRequest('POST', '/api/markets', {
        ...data,
        endDate: combinedEndDate.toISOString(),
        categoryId: parseInt(data.categoryId.toString()),
      });
      return response.json();
    },
    onSuccess: (market) => {
      toast({
        title: "Market Created",
        description: "Your prediction market has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/markets'] });
      setLocation(`/market/${market.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create market. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateMarketFormData) => {
    createMarketMutation.mutate(data);
  };

  const categoryId = watch('categoryId');
  const endDate = watch('endDate');

  // Calculate minimum end date (24 hours from now)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateString = minDate.toISOString().split('T')[0];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'ml-0' : 'ml-12'}`}>
      <div className={`max-w-4xl mx-auto ${isMobile ? 'py-3 px-4' : 'py-8 px-4 sm:px-6 lg:px-8'}`}>
        <div className={isMobile ? 'space-y-4' : 'space-y-8'}>
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-text mb-2">Create New Market</h1>
            <p className="text-neutral">Set up a new prediction market for others to trade on</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Market Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Market Question *</Label>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="e.g., Will AI achieve AGI by 2025?"
                    className="text-lg"
                  />
                  {errors.title && (
                    <p className="text-sm text-error">{errors.title.message}</p>
                  )}
                  <p className="text-sm text-neutral">
                    Make sure your question is clear, specific, and has a yes/no answer
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Provide detailed context, resolution criteria, and any relevant information..."
                    rows={4}
                  />
                  {errors.description && (
                    <p className="text-sm text-error">{errors.description.message}</p>
                  )}
                  <p className="text-sm text-neutral">
                    Include clear resolution criteria so traders know how the market will be decided
                  </p>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label htmlFor="image">Market Image *</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Market preview"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-2">
                          <label htmlFor="image-upload" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              Upload an image
                            </span>
                            <span className="mt-1 block text-sm text-gray-500">
                              PNG, JPG up to 10MB
                            </span>
                          </label>
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.imageUrl && (
                    <p className="text-sm text-error">{errors.imageUrl.message}</p>
                  )}
                  <p className="text-sm text-neutral">
                    Required: Upload an image to represent your market
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={categoryId?.toString() || ''}
                    onValueChange={(value) => setValue('categoryId', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-sm text-error">{errors.categoryId.message}</p>
                  )}
                </div>

                {/* End Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      End Date *
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      {...register('endDate')}
                    />
                    {errors.endDate && (
                      <p className="text-sm text-error">{errors.endDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      End Time *
                    </Label>
                    <Input
                      id="endTime"
                      type="time"
                      {...register('endTime')}
                    />
                    {errors.endTime && (
                      <p className="text-sm text-error">{errors.endTime.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-neutral">
                  Select the exact date and time when the market should resolve
                </p>

                {/* Resolution Rules/Link */}
                <div className="space-y-2">
                  <Label htmlFor="resolverUrl" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Resolution Rules/Link *
                  </Label>
                  <Input
                    id="resolverUrl"
                    placeholder="https://example.com/resolution-source OR detailed resolution criteria"
                    {...register('resolverUrl')}
                  />
                  {errors.resolverUrl && (
                    <p className="text-sm text-error">{errors.resolverUrl.message}</p>
                  )}
                  <p className="text-sm text-neutral">
                    Required: Link to resolution source OR detailed explanation of how this market will be resolved
                  </p>
                </div>

                {/* Featured */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured"
                    checked={watch('featured')}
                    onCheckedChange={(checked) => setValue('featured', !!checked)}
                  />
                  <Label htmlFor="featured" className="text-sm">
                    Feature this market (appears prominently on the homepage)
                  </Label>
                </div>

                {/* Resolution Guidelines */}
                <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    Resolution Guidelines
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li>• Markets must have objective, verifiable resolution criteria</li>
                    <li>• Provide reliable sources that will be used to determine the outcome</li>
                    <li>• Avoid ambiguous language that could lead to disputes</li>
                    <li>• Set a reasonable timeframe for resolution after the end date</li>
                    <li>• Consider edge cases and how they will be handled</li>
                  </ul>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-6">
                  <Button
                    type="submit"
                    disabled={createMarketMutation.isPending}
                    className="flex-1"
                  >
                    {createMarketMutation.isPending ? "Creating Market..." : "Create Market"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
