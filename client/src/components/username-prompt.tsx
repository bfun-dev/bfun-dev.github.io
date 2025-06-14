import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const usernameSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

interface UsernamePromptProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UsernamePrompt({ open, onClose, onSuccess }: UsernamePromptProps) {
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: "",
    },
  });

  const watchedUsername = form.watch("username");

  const updateUsernameMutation = useMutation({
    mutationFn: async (data: z.infer<typeof usernameSchema>) => {
      try {
        return await apiRequest("POST", "/api/auth/update-username", data);
      } catch (error) {
        console.error("Username update failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Your username has been set successfully!",
      });
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      console.error("Username mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to set username",
        variant: "destructive",
      });
    },
  });

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingAvailability(true);
    try {
      const response = await fetch(`/api/auth/check-username/${encodeURIComponent(username)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error("Error checking username availability:", error);
      setUsernameAvailable(null);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Check availability when username changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedUsername && watchedUsername.length >= 3) {
        checkUsernameAvailability(watchedUsername);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedUsername]);

  const onSubmit = (data: z.infer<typeof usernameSchema>) => {
    if (usernameAvailable) {
      updateUsernameMutation.mutate(data);
    }
  };

  const getUsernameStatus = () => {
    if (!watchedUsername || watchedUsername.length < 3) return null;
    if (checkingAvailability) return "checking";
    if (usernameAvailable === true) return "available";
    if (usernameAvailable === false) return "taken";
    return null;
  };

  const status = getUsernameStatus();



  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="w-full max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <User className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center">Choose Your Username</DialogTitle>
          <DialogDescription className="text-center">
            Set a unique username to personalize your Bets.Fun experience
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="Enter your username"
                        disabled={updateUsernameMutation.isPending}
                        className="pr-10"
                      />
                      {status && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {status === "checking" && (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          )}
                          {status === "available" && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                          {status === "taken" && (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                  {status === "taken" && (
                    <p className="text-sm text-red-600">This username is already taken</p>
                  )}
                  {status === "available" && (
                    <p className="text-sm text-green-600">This username is available</p>
                  )}
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={
                updateUsernameMutation.isPending ||
                status !== "available" ||
                checkingAvailability ||
                !watchedUsername ||
                watchedUsername.length < 3
              }
            >
              {updateUsernameMutation.isPending ? "Setting Username..." : "Set Username"}
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Your username will be visible to other users on the platform</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}