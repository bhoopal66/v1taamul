import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Share2, 
  Twitter, 
  Linkedin, 
  MessageCircle,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { Achievement } from '@/hooks/useAgentProfile';

interface ShareAchievementDialogProps {
  achievement: Achievement | null;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShareAchievementDialog: React.FC<ShareAchievementDialogProps> = ({
  achievement,
  agentName,
  open,
  onOpenChange,
}) => {
  const [copied, setCopied] = useState(false);

  if (!achievement) return null;

  const shareText = `🎉 I just earned the "${achievement.title}" achievement on TeleSales! ${achievement.icon}\n\n${achievement.description}\n\n#TeleSales #Achievement #Sales`;
  
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleLinkedInShare = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(shareText)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText + '\n\n' + shareUrl);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Achievement
          </DialogTitle>
          <DialogDescription>
            Share your accomplishment with your network
          </DialogDescription>
        </DialogHeader>

        {/* Achievement Preview */}
        <div className="flex flex-col items-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
          <span className="text-5xl mb-3">{achievement.icon}</span>
          <h3 className="text-xl font-bold">{achievement.title}</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {achievement.description}
          </p>
          <Badge className="mt-3" variant="secondary">
            Earned by {agentName}
          </Badge>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="gap-2 h-12"
            onClick={handleTwitterShare}
          >
            <Twitter className="w-5 h-5 text-[#1DA1F2]" />
            Twitter / X
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-12"
            onClick={handleLinkedInShare}
          >
            <Linkedin className="w-5 h-5 text-[#0A66C2]" />
            LinkedIn
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-12"
            onClick={handleWhatsAppShare}
          >
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            WhatsApp
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-12"
            onClick={handleCopyLink}
          >
            {copied ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
            {copied ? 'Copied!' : 'Copy Text'}
          </Button>
        </div>

        {/* Preview Text */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Preview:</p>
          <p className="text-sm whitespace-pre-line">{shareText}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
