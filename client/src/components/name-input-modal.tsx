import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NameInputModalProps {
  open: boolean;
  onSubmit: (firstName: string, lastName: string, username?: string) => void;
  walletAddress: string;
  isWalletLogin?: boolean;
}

export default function NameInputModal({ open, onSubmit, walletAddress, isWalletLogin = false }: NameInputModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      return;
    }

    if (isWalletLogin && !username.trim()) {
      return;
    }

    setIsSubmitting(true);
    await onSubmit(firstName.trim(), lastName.trim(), username.trim());
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            Welcome to Bets.Fun!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Connected wallet: {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isWalletLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required={isWalletLogin}
                  disabled={isSubmitting}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name (optional)"
                disabled={isSubmitting}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!firstName.trim() || isSubmitting}
            >
              {isSubmitting ? "Creating Account..." : "Get Started"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}