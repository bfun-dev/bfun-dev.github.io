import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import type { Category } from "@shared/schema";

interface SidebarFiltersProps {
  selectedCategories: number[];
  onCategoriesChange: (categories: number[]) => void;
  status: 'active' | 'resolved' | 'all';
  onStatusChange: (status: 'active' | 'resolved' | 'all') => void;
}

export default function SidebarFilters({
  selectedCategories,
  onCategoriesChange,
  status,
  onStatusChange,
}: SidebarFiltersProps) {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    if (checked) {
      onCategoriesChange([...selectedCategories, categoryId]);
    } else {
      onCategoriesChange(selectedCategories.filter(id => id !== categoryId));
    }
  };

  const getCategoryCount = (categoryName: string) => {
    // In a real app, this would come from the API
    const counts: Record<string, number> = {
      'Politics': 24,
      'Sports': 18,
      'Technology': 12,
      'Economics': 8,
      'Entertainment': 6,
      'Climate': 4,
    };
    return counts[categoryName] || 0;
  };

  return (
    <div className="lg:w-64 space-y-6 pl-[0px] pr-[0px] ml-[-15px] mr-[-15px]">
      {/* Categories Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between text-[14px]">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={(checked) => 
                    handleCategoryToggle(category.id, !!checked)
                  }
                />
                <Label 
                  htmlFor={`category-${category.id}`} 
                  className="text-sm cursor-pointer"
                >
                  {category.name}
                </Label>
              </div>
              <Badge variant="secondary" className="text-xs">
                {getCategoryCount(category.name)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Status Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={status} onValueChange={onStatusChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="active" id="status-active" />
              <Label htmlFor="status-active" className="text-sm cursor-pointer">
                Active
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="resolved" id="status-resolved" />
              <Label htmlFor="status-resolved" className="text-sm cursor-pointer">
                Resolved
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="status-all" />
              <Label htmlFor="status-all" className="text-sm cursor-pointer">
                All
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      {/* Volume Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Slider
            defaultValue={[30]}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-neutral">
            <span>$0</span>
            <span>$1M+</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
