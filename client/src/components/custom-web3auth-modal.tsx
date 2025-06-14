import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, User } from "lucide-react";
import { FaGoogle, FaTwitter, FaDiscord, FaApple } from "react-icons/fa";

interface CustomWeb3AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (userInfo: any) => void;
}

export default function CustomWeb3AuthModal({ open, onClose, onSuccess }: CustomWeb3AuthModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialLogin = async (provider: string) => {
    setIsLoading(true);
    
    try {
      const userInfo = {
        id: `${provider}_${Date.now()}`,
        email: provider === "email" ? email : `user@${provider}.com`,
        firstName: "User",
        lastName: "",
        profileImageUrl: "https://via.placeholder.com/100",
        walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
        balance: "0"
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSuccess(userInfo);
      onClose();
    } catch (error) {
      console.error(`${provider} login failed:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address");
      return;
    }
    await handleSocialLogin("email");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Connect to Bets.Fun</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("google")}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <FaGoogle className="w-4 h-4 text-red-500" />
              Google
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("twitter")}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <FaTwitter className="w-4 h-4 text-blue-500" />
              Twitter
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("discord")}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <FaDiscord className="w-4 h-4 text-indigo-500" />
              Discord
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSocialLogin("apple")}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <FaApple className="w-4 h-4 text-gray-800 dark:text-white" />
              Apple
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === "Enter" && handleEmailLogin()}
              />
            </div>
            
            <Button
              onClick={handleEmailLogin}
              disabled={isLoading || !email}
              className="w-full"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Continue with Email
                </div>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}