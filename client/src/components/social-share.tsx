import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Download, Twitter, Facebook, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import type { MarketWithCategory } from '@shared/schema';

interface SocialShareProps {
  market: MarketWithCategory;
  variant?: 'default' | 'compact';
}

export default function SocialShare({ market, variant = 'default' }: SocialShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateShareableGraphic = async (): Promise<string> => {
    setIsGenerating(true);
    
    // Generate QR code first
    const shareUrl = `${window.location.origin}/market/${market.id}`;
    let qrCodeDataUrl: string | null = null;
    
    try {
      qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.warn('QR code generation failed:', error);
    }
    
    // Create canvas for generating shareable graphic
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas dimensions for social media optimization
    canvas.width = 1200;
    canvas.height = 630;
    
    // Background gradient with brand colors
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#334155');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add geometric pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < canvas.width; i += 80) {
      for (let j = 0; j < canvas.height; j += 80) {
        ctx.beginPath();
        ctx.arc(i, j, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    // Brand header with logo
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Bets', 60, 80);
    ctx.fillStyle = '#10b981';
    ctx.fillText('.', 140, 80);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Fun', 160, 80);
    
    // Tagline
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('Prediction Markets', 60, 110);
    
    // Market category badge with rounded corners
    if (market.category) {
      const badgeX = 60;
      const badgeY = 140;
      const badgeWidth = 140;
      const badgeHeight = 32;
      const radius = 16;
      
      // Draw rounded rectangle
      ctx.beginPath();
      ctx.moveTo(badgeX + radius, badgeY);
      ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
      ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
      ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
      ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
      ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
      ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
      ctx.lineTo(badgeX, badgeY + radius);
      ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
      ctx.fillStyle = market.category.color;
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(market.category.name, badgeX + badgeWidth / 2, badgeY + 20);
    }
    
    // Market title with better typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.textAlign = 'left';
    const titleLines = wrapText(ctx, market.title, 800);
    let yOffset = 220;
    titleLines.forEach((line, index) => {
      ctx.fillText(line, 60, yOffset + (index * 50));
    });
    
    // Calculate market prices
    const yesPrice = parseFloat(market.yesPrice || '0.5');
    const noPrice = parseFloat(market.noPrice || '0.5');
    const yesOdds = yesPrice > 0 ? (1 / yesPrice) : 2;
    const noOdds = noPrice > 0 ? (1 / noPrice) : 2;
    const yesPercentage = Math.round(yesPrice * 100);
    const noPercentage = Math.round(noPrice * 100);
    
    // Betting options with enhanced design
    const buttonY = 450;
    const buttonWidth = 180;
    const buttonHeight = 80;
    const buttonRadius = 12;
    
    // YES button with gradient
    const yesGradient = ctx.createLinearGradient(60, buttonY, 60, buttonY + buttonHeight);
    yesGradient.addColorStop(0, '#10b981');
    yesGradient.addColorStop(1, '#059669');
    ctx.fillStyle = yesGradient;
    ctx.beginPath();
    ctx.roundRect(60, buttonY, buttonWidth, buttonHeight, buttonRadius);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YES', 150, buttonY + 35);
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(`${yesOdds.toFixed(2)}x`, 150, buttonY + 58);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(`${yesPercentage}%`, 150, buttonY + 75);
    
    // NO button with gradient
    const noGradient = ctx.createLinearGradient(260, buttonY, 260, buttonY + buttonHeight);
    noGradient.addColorStop(0, '#ef4444');
    noGradient.addColorStop(1, '#dc2626');
    ctx.fillStyle = noGradient;
    ctx.beginPath();
    ctx.roundRect(260, buttonY, buttonWidth, buttonHeight, buttonRadius);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NO', 350, buttonY + 35);
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(`${noOdds.toFixed(2)}x`, 350, buttonY + 58);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(`${noPercentage}%`, 350, buttonY + 75);
    
    // Market stats sidebar
    const statsX = 900;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(statsX, 140, 240, 380);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Market Stats', statsX + 20, 170);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('Total Volume', statsX + 20, 200);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`$${parseFloat(market.totalVolume || '0').toLocaleString()}`, statsX + 20, 220);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('Market ID', statsX + 20, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`#${market.id}`, statsX + 20, 270);
    
    // QR code section - handle asynchronously
    return new Promise<string>((resolve) => {
      if (qrCodeDataUrl) {
        const qrImage = new Image();
        qrImage.onload = () => {
          ctx.drawImage(qrImage, statsX + 20, 300, 120, 120);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Scan to bet', statsX + 80, 440);
          
          // Call to action
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 16px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Join the prediction!', 600, 580);
          
          setIsGenerating(false);
          resolve(canvas.toDataURL('image/png'));
        };
        qrImage.onerror = () => {
          // Fallback if image loading fails
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(statsX + 20, 300, 120, 120);
          ctx.fillStyle = '#000000';
          ctx.font = '12px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('QR Code', statsX + 80, 365);
          ctx.fillText('Scan to bet', statsX + 80, 380);
          
          // Call to action
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 16px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Join the prediction!', 600, 580);
          
          setIsGenerating(false);
          resolve(canvas.toDataURL('image/png'));
        };
        qrImage.src = qrCodeDataUrl;
      } else {
        // Fallback to placeholder if QR generation failed
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(statsX + 20, 300, 120, 120);
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', statsX + 80, 365);
        ctx.fillText('Scan to bet', statsX + 80, 380);
        
        // Call to action
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Join the prediction!', 600, 580);
        
        setIsGenerating(false);
        resolve(canvas.toDataURL('image/png'));
      }
    });
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.slice(0, 3); // Limit to 3 lines
  };

  const shareText = `Check out this prediction: "${market.title}" on Bets.Fun`;
  const shareUrl = `${window.location.origin}/market/${market.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadGraphic = async () => {
    try {
      const dataUrl = await generateShareableGraphic();
      const link = document.createElement('a');
      link.download = `bets-fun-${market.id}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "Graphic downloaded!",
        description: "Shareable graphic has been saved to your device.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate shareable graphic.",
        variant: "destructive",
      });
    }
  };

  const handleSocialShare = (platform: string) => {
    let url = '';
    
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
    }
    
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {variant === 'compact' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 rounded-full bg-white/90 hover:bg-white border-gray-200 shadow-lg"
          >
            <Share2 className="h-3 w-3 text-gray-600" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this prediction</DialogTitle>
        </DialogHeader>
        
        {/* Market Preview */}
        <div className="bg-muted rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            {market.category && (
              <Badge 
                style={{ backgroundColor: `${market.category.color}20`, color: market.category.color }}
                className="text-xs"
              >
                {market.category.name}
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-sm mb-2 line-clamp-2">{market.title}</h3>
          <div className="flex gap-2">
            <div className="bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded text-xs">
              YES {((1 / parseFloat(market.yesPrice || '0.5'))).toFixed(2)}x
            </div>
            <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded text-xs">
              NO {((1 / parseFloat(market.noPrice || '0.5'))).toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Share Actions */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleDownloadGraphic}
              disabled={isGenerating}
            >
              <Download className="h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Download Image'}
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40"
              onClick={() => handleSocialShare('twitter')}
            >
              <Twitter className="h-4 w-4" />
              Twitter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40"
              onClick={() => handleSocialShare('facebook')}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40"
              onClick={() => handleSocialShare('whatsapp')}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center mt-4">
          Share your prediction and invite others to bet!
        </div>
      </DialogContent>
    </Dialog>
  );
}