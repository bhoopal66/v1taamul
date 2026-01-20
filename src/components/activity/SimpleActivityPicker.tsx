import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Database,
  Phone,
  UserCheck,
  Users,
  MapPin,
  MoreHorizontal,
  Coffee,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { SimpleActivityType, SIMPLE_ACTIVITY_LABELS } from '@/hooks/useActivitySession';
import { cn } from '@/lib/utils';

interface SimpleActivityPickerProps {
  currentActivity: string | null;
  onActivityChange: (activity: SimpleActivityType, details?: string) => void;
  disabled?: boolean;
  isOnBreak?: boolean;
  breakLabel?: string;
  isLoading?: boolean;
}

const ACTIVITY_OPTIONS: { 
  type: SimpleActivityType; 
  icon: React.ReactNode; 
  color: string;
  description: string;
}[] = [
  { 
    type: 'data_collection', 
    icon: <Database className="w-6 h-6" />, 
    color: 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10',
    description: 'Collecting and organizing data'
  },
  { 
    type: 'calling', 
    icon: <Phone className="w-6 h-6" />, 
    color: 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10',
    description: 'Making calls to contacts'
  },
  { 
    type: 'followup', 
    icon: <UserCheck className="w-6 h-6" />, 
    color: 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10',
    description: 'Following up with leads'
  },
  { 
    type: 'meeting_in_office', 
    icon: <Users className="w-6 h-6" />, 
    color: 'border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10',
    description: 'Attending in-office meetings'
  },
  { 
    type: 'market_visit', 
    icon: <MapPin className="w-6 h-6" />, 
    color: 'border-red-500/50 bg-red-500/5 hover:bg-red-500/10',
    description: 'Will log you out'
  },
  { 
    type: 'others', 
    icon: <MoreHorizontal className="w-6 h-6" />, 
    color: 'border-gray-500/50 bg-gray-500/5 hover:bg-gray-500/10',
    description: 'Other activities (describe below)'
  },
];

export const SimpleActivityPicker: React.FC<SimpleActivityPickerProps> = ({
  currentActivity,
  onActivityChange,
  disabled = false,
  isOnBreak = false,
  breakLabel = 'Break',
  isLoading = false,
}) => {
  const [selectedForDetails, setSelectedForDetails] = useState<SimpleActivityType | null>(null);
  const [details, setDetails] = useState('');

  if (isOnBreak) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Coffee className="w-6 h-6 text-amber-500" />
        <div>
          <span className="font-medium text-amber-600">{breakLabel}</span>
          <p className="text-sm text-muted-foreground">Activity selection is locked during breaks</p>
        </div>
        <Badge variant="outline" className="ml-auto border-amber-500/50 text-amber-600">
          System Enforced
        </Badge>
      </div>
    );
  }

  const getCurrentActivityLabel = () => {
    if (!currentActivity) return null;
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

  const handleSelect = (type: SimpleActivityType) => {
    if (type === 'others' || type === 'market_visit') {
      setSelectedForDetails(type);
      setDetails('');
    } else {
      onActivityChange(type);
    }
  };

  const handleConfirmWithDetails = () => {
    if (selectedForDetails && details.trim()) {
      onActivityChange(selectedForDetails, details);
      setSelectedForDetails(null);
      setDetails('');
    }
  };

  const currentLabel = getCurrentActivityLabel();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Select Your Activity</span>
          {currentLabel && (
            <Badge variant="secondary" className="text-sm">
              Current: {currentLabel}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activity Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIVITY_OPTIONS.map(({ type, icon, color, description }) => {
            const isActive = currentActivity === type || 
              (type === 'calling' && currentActivity?.startsWith('calling_')) ||
              (type === 'followup' && currentActivity === 'customer_followup') ||
              (type === 'meeting_in_office' && currentActivity === 'client_meeting');

            return (
              <Button
                key={type}
                variant="outline"
                className={cn(
                  "h-auto flex-col gap-2 p-4 border-2 transition-all",
                  color,
                  isActive && "ring-2 ring-primary ring-offset-2",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handleSelect(type)}
                disabled={disabled || isLoading}
              >
                <div className="flex items-center gap-2">
                  {icon}
                  {type === 'market_visit' && (
                    <Badge variant="destructive" className="text-xs px-1">
                      Logout
                    </Badge>
                  )}
                </div>
                <span className="font-medium">{SIMPLE_ACTIVITY_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {description}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Details input for Others/Market Visit */}
        {selectedForDetails && (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-4 space-y-3">
              <Label htmlFor="activity-details" className="flex items-center gap-2">
                {selectedForDetails === 'market_visit' 
                  ? <MapPin className="w-4 h-4 text-red-500" />
                  : <MoreHorizontal className="w-4 h-4" />
                }
                {selectedForDetails === 'market_visit' 
                  ? 'Location/Purpose (required)' 
                  : 'Description (required)'}
              </Label>
              <Textarea
                id="activity-details"
                placeholder={selectedForDetails === 'market_visit' 
                  ? 'Enter location and purpose of your market visit...' 
                  : 'Describe what you are working on...'}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="min-h-[80px]"
              />
              
              {selectedForDetails === 'market_visit' && (
                <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Selecting Market Visit will log you out immediately
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedForDetails(null);
                    setDetails('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className={cn(
                    "flex-1",
                    selectedForDetails === 'market_visit' && "bg-red-600 hover:bg-red-700"
                  )}
                  onClick={handleConfirmWithDetails}
                  disabled={!details.trim() || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {selectedForDetails === 'market_visit' ? 'Confirm & Logout' : 'Confirm'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};