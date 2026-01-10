import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Volume2, VolumeX } from 'lucide-react';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { cn } from '@/lib/utils';

interface SoundToggleProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ variant = 'default', className }) => {
  const { soundEnabled, toggleSound } = useSoundSettings();

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', className)}
              onClick={toggleSound}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{soundEnabled ? 'Mute sounds' : 'Unmute sounds'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'gap-2 justify-start',
        !soundEnabled && 'text-muted-foreground',
        className
      )}
      onClick={toggleSound}
    >
      {soundEnabled ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <VolumeX className="h-4 w-4" />
      )}
      <span>{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
    </Button>
  );
};
