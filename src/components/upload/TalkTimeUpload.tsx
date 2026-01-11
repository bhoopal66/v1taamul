import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Clock, Save, TrendingUp, Calendar } from 'lucide-react';
import { useTalkTime } from '@/hooks/useTalkTime';
import { format, parseISO } from 'date-fns';

export const TalkTimeUpload: React.FC = () => {
  const { todayTalkTime, recentEntries, monthlyTotal, isLoading, submitTalkTime } = useTalkTime();
  
  const [minutes, setMinutes] = useState<string>(todayTalkTime?.talk_time_minutes?.toString() || '');
  const [notes, setNotes] = useState<string>(todayTalkTime?.notes || '');

  // Update local state when data loads
  React.useEffect(() => {
    if (todayTalkTime) {
      setMinutes(todayTalkTime.talk_time_minutes.toString());
      setNotes(todayTalkTime.notes || '');
    }
  }, [todayTalkTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMinutes = parseInt(minutes, 10);
    if (isNaN(parsedMinutes) || parsedMinutes < 0) {
      return;
    }
    submitTalkTime.mutate({ minutes: parsedMinutes, notes: notes || undefined });
  };

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Daily Talk Time
        </CardTitle>
        <CardDescription>
          Log your total call duration for today (in minutes)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Today's Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="talk-time">Talk Time (minutes)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="talk-time"
                  type="number"
                  min="0"
                  max="1440"
                  placeholder="e.g., 120"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                type="submit" 
                disabled={submitTalkTime.isPending || !minutes}
                className="w-full gap-2"
              >
                <Save className="w-4 h-4" />
                {todayTalkTime ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any notes about today's calls..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </form>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {todayTalkTime ? formatDuration(todayTalkTime.talk_time_minutes) : '0m'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">This Month</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatDuration(monthlyTotal)}
            </p>
          </div>
        </div>

        {/* Recent Entries */}
        {recentEntries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recent Entries
            </h4>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {recentEntries.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {format(parseISO(entry.date), 'MMM d')}
                      </Badge>
                      <span className="text-sm font-medium">
                        {formatDuration(entry.talk_time_minutes)}
                      </span>
                    </div>
                    {entry.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {entry.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
