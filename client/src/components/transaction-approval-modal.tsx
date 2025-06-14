import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TransactionData {
  requiresUserSigning: boolean;
  chain: string;
  from: string;
  to: string;
  tokenMint?: string;
  tokenAddress?: string;
  amount: string;
  token: string;
  instruction: string;
}

interface TransactionApprovalModalProps {
  open: boolean;
  onClose: () => void;
  transactions: TransactionData[];
  onApprove: () => Promise<void>;
  totalValue: string;
  usdtReceived: string;
}

export default function TransactionApprovalModal({
  open,
  onClose,
  transactions,
  onApprove,
  totalValue,
  usdtReceived
}: TransactionApprovalModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove();
      toast({
        title: "Transactions Submitted",
        description: "Your token swap transactions have been submitted for processing.",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to process transactions",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Approve Token Transfers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              You need to approve {transactions.length} transaction(s) in your wallet to complete the token swap.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Swap Summary:</h4>
            <div className="text-sm text-muted-foreground">
              <div>Total Value: ${totalValue}</div>
              <div>USDT Equivalent: {usdtReceived} USDT</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Required Transactions:</h4>
            {transactions.map((tx, index) => (
              <Card key={index} className="border-dashed">
                <CardContent className="p-3">
                  <div className="space-y-1 text-xs">
                    <div className="font-medium">
                      {tx.amount} {tx.token} ({tx.chain})
                    </div>
                    <div className="text-muted-foreground">
                      From: {formatAddress(tx.from)}
                    </div>
                    <div className="text-muted-foreground">
                      To: {formatAddress(tx.to)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              Each transaction will require approval in your Web3 wallet. Make sure you have enough gas fees for the transactions.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Approve Transfers"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}