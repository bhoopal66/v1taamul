import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  AlertTriangle,
  Database,
  Phone,
  UserCheck,
  Users,
  MapPin,
  MoreHorizontal,
} from 'lucide-react';
import { SimpleActivityType, SIMPLE_ACTIVITY_LABELS, GRACE_PERIOD_MS } from '@/hooks/useActivitySession';
import { cn } from '@/lib/utils';

interface ActivityConfirmationPromptProps {
  currentActivity: string | null;
  graceTimeRemaining: number;
  onAccept: () => void;
  onChange: (activity: SimpleActivityType, details?: string) => void;
  isLoading: boolean;
}

const ACTIVITY_OPTIONS: { type: SimpleActivityType; icon: React.ReactNode; color: string }[] = [
  { type: 'data_collection', icon: <Database className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { type: 'calling', icon: <Phone className="w-5 h-5" />, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { type: 'followup', icon: <UserCheck className="w-5 h-5" />, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  { type: 'meeting_in_office', icon: <Users className="w-5 h-5" />, color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  { type: 'market_visit', icon: <MapPin className="w-5 h-5" />, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { type: 'others', icon: <MoreHorizontal className="w-5 h-5" />, color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
];

export const ActivityConfirmationPrompt: React.FC<ActivityConfirmationPromptProps> = ({
  currentActivity,
  graceTimeRemaining,
  onAccept,
  onChange,
  isLoading,
}) => {
  const [showChangeOptions, setShowChangeOptions] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<SimpleActivityType | null>(null);
  const [details, setDetails] = useState('');

  const graceProgress = (graceTimeRemaining / GRACE_PERIOD_MS) * 100;
  const graceSeconds = Math.ceil(graceTimeRemaining / 1000);
  const isUrgent = graceProgress < 33;

  const getCurrentActivityLabel = () => {
    if (!currentActivity) return 'No activity';
    const labels: Record<string, string> = {
      data_collection: 'Data Collection',
      calling_telecalling: 'Calling',
      calling_coldcalling: 'Calling',
      calling_calllist_movement: 'Calling',
      customer_followup: 'Follow-up',
      client_meeting: 'Meeting In Office',
      market_visit: 'Market Visit',
      others: 'Others',
    };
    return labels[currentActivity] || currentActivity;
  };

  const handleSelectActivity = (activity: SimpleActivityType) => {
    setSelectedActivity(activity);
    if (activity !== 'others' && activity !== 'market_visit') {
      onChange(activity);
    }
  };

  const handleConfirmWithDetails = () => {
    if (selectedActivity) {
      const requiresDetails = selectedActivity === 'others' || selectedActivity === 'market_visit';
      if (requiresDetails && !details.trim()) {
        return; // Don't submit without required details
      }
      onChange(selectedActivity, details);
    }
  };

  const requiresDetails = selectedActivity === 'others' || selectedActivity === 'market_visit';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 shadow-2xl border-2">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className={cn(
              "p-3 rounded-full",
              isUrgent ? "bg-red-500/10" : "bg-amber-500/10"
            )}>
              <Clock className={cn(
                "w-8 h-8",
                isUrgent ? "text-red-500 animate-pulse" : "text-amber-500"
              )} />
            </div>
          </div>
          <CardTitle className="text-xl">
            Confirm Your Activity
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Every 15 minutes, please confirm your current activity
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Grace Period Timer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Response time remaining</span>
              <span className={cn(
                "font-medium",
                isUrgent ? "text-red-500" : "text-amber-600"
              )}>
                {Math.floor(graceSeconds / 60)}:{(graceSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <Progress 
              value={graceProgress} 
              className={cn(
                "h-2",
                isUrgent && "[&>div]:bg-red-500"
              )} 
            />
            {isUrgent && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                If you don't respond, you will be auto-switched to Calling
              </p>
            )}
          </div>

          {/* Current Activity Display */}
          <div className="p-4 rounded-lg bg-muted text-center">
            <p className="text-sm text-muted-foreground mb-1">Current Activity</p>
            <p className="text-lg font-semibold">{getCurrentActivityLabel()}</p>
          </div>

          {!showChangeOptions ? (
            /* Quick Accept/Change Buttons */
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-16 text-lg gap-2 bg-green-600 hover:bg-green-700"
                onClick={onAccept}
                disabled={isLoading}
              >
                <CheckCircle2 className="w-6 h-6" />
                Accept Same
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 text-lg gap-2"
                onClick={() => setShowChangeOptions(true)}
                disabled={isLoading}
              >
                <RefreshCw className="w-6 h-6" />
                Change Activity
              </Button>
            </div>
          ) : (
            /* Activity Selection */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_OPTIONS.map(({ type, icon, color }) => (
                  <Button
                    key={type}
                    variant="outline"
                    className={cn(
                      "h-14 justify-start gap-2 border-2 transition-all",
                      selectedActivity === type && color,
                      selectedActivity === type && "ring-2 ring-offset-2 ring-primary"
                    )}
                    onClick={() => handleSelectActivity(type)}
                    disabled={isLoading}
                  >
                    {icon}
                    <span className="text-sm">{SIMPLE_ACTIVITY_LABELS[type]}</span>
                    {type === 'market_visit' && (
                      <Badge variant="destructive" className="ml-auto text-xs">
                        Logout
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              {/* Details input for Others/Market Visit */}
              {requiresDetails && (
                <div className="space-y-2">
                  <Label htmlFor="details">
                    {selectedActivity === 'market_visit' 
                      ? 'Location/Purpose (required)' 
                      : 'Description (required)'}
                  </Label>
                  <Textarea
                    id="details"
                    placeholder={selectedActivity === 'market_visit' 
                      ? 'Enter location and purpose of your market visit...' 
                      : 'Describe what you are working on...'}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="min-h-[80px]"
                  />
                  {selectedActivity === 'market_visit' && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Selecting Market Visit will log you out immediately
                    </p>
                  )}
                </div>
              )}

              {/* Confirm Button */}
              {requiresDetails && (
                <Button
                  className="w-full h-12"
                  onClick={handleConfirmWithDetails}
                  disabled={isLoading || !details.trim()}
                >
                  {selectedActivity === 'market_visit' ? 'Confirm & Logout' : 'Confirm Activity'}
                </Button>
              )}

              {/* Back Button */}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowChangeOptions(false);
                  setSelectedActivity(null);
                  setDetails('');
                }}
              >
                ← Back to Quick Options
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};