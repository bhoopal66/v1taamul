import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Clock, Coffee, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FullScreenClockProps {
  dubaiTime: Date;
  withinWorkHours: boolean;
  breakStatus: { onBreak: boolean; breakLabel: string; breakEnd: string | null };
  onStart: () => void;
  isStarting: boolean;
  agentName?: string;
}

export const FullScreenClock: React.FC<FullScreenClockProps> = ({
  dubaiTime,
  withinWorkHours,
  breakStatus,
  onStart,
  isStarting,
  agentName,
}) => {
  const hours = dubaiTime.getHours().toString().padStart(2, '0');
  const minutes = dubaiTime.getMinutes().toString().padStart(2, '0');
  const seconds = dubaiTime.getSeconds().toString().padStart(2, '0');
  const dateStr = format(dubaiTime, 'EEEE, MMMM d, yyyy');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 p-8 max-w-2xl w-full">
        {/* Greeting */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Good {dubaiTime.getHours() < 12 ? 'Morning' : dubaiTime.getHours() < 17 ? 'Afternoon' : 'Evening'}
            {agentName && `, ${agentName.split(' ')[0]}`}!
          </h1>
          <p className="text-muted-foreground">{dateStr}</p>
        </div>

        {/* Digital Clock */}
        <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-12 px-8">
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-8xl md:text-9xl font-mono font-bold text-primary tabular-nums">
                  {hours}
                </span>
                <span className="text-8xl md:text-9xl font-mono font-bold text-primary/60 animate-pulse">
                  :
                </span>
                <span className="text-8xl md:text-9xl font-mono font-bold text-primary tabular-nums">
                  {minutes}
                </span>
              </div>
              <span className="text-4xl md:text-5xl font-mono text-muted-foreground tabular-nums self-end mb-4">
                {seconds}
              </span>
            </div>
            <p className="text-center text-muted-foreground mt-4">
              <Clock className="inline-block w-4 h-4 mr-1" />
              Dubai Time (GST)
            </p>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {breakStatus.onBreak && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 w-full">
            <Coffee className="w-6 h-6 text-amber-500" />
            <div>
              <p className="font-medium text-amber-600">{breakStatus.breakLabel}</p>
              <p className="text-sm text-muted-foreground">
                Break ends at {breakStatus.breakEnd}
              </p>
            </div>
          </div>
        )}

        {!withinWorkHours && !breakStatus.onBreak && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border w-full">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
            <div>
              <p className="font-medium">Outside Work Hours</p>
              <p className="text-sm text-muted-foreground">
                Work hours: 10:00 AM - 7:00 PM
              </p>
            </div>
          </div>
        )}

        {/* START Button */}
        <Button
          size="lg"
          className={cn(
            "w-full max-w-md h-20 text-2xl font-bold gap-3 transition-all",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "shadow-lg hover:shadow-xl",
            isStarting && "opacity-50 cursor-not-allowed"
          )}
          onClick={onStart}
          disabled={isStarting || breakStatus.onBreak}
        >
          <Play className="w-8 h-8" />
          {isStarting ? 'Starting...' : 'START'}
        </Button>

        <p className="text-center text-sm text-muted-foreground max-w-md">
          Press START to begin your work session. Your attendance will be recorded 
          and you'll be asked to select your current activity.
        </p>

        {/* Work Hours Info */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>🕐 Work: 10:00 AM - 7:00 PM</span>
          <span>☕ Tea: 11:15-11:30 & 4:30-4:45</span>
          <span>🍽️ Lunch: 1:15-2:15 PM</span>
        </div>
      </div>
    </div>
  );
};