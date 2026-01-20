import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Users, 
  FileText, 
  GraduationCap, 
  Monitor, 
  Coffee, 
  Clock,
  Database,
  UserCheck,
  PhoneCall,
  PhoneOutgoing,
  List
} from 'lucide-react';
import { 
  ActivityType, 
  ACTIVITY_LABELS, 
  CALLING_ACTIVITIES 
} from '@/hooks/useActivityMonitor';

interface ActivitySelectorProps {
  currentActivity: ActivityType | null;
  onActivityChange: (activity: ActivityType) => void;
  disabled?: boolean;
  isOnBreak?: boolean;
  breakLabel?: string;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  data_collection: <Database className="w-4 h-4" />,
  customer_followup: <UserCheck className="w-4 h-4" />,
  calling_telecalling: <Phone className="w-4 h-4" />,
  calling_coldcalling: <PhoneOutgoing className="w-4 h-4" />,
  calling_calllist_movement: <List className="w-4 h-4" />,
  client_meeting: <Users className="w-4 h-4" />,
  admin_documentation: <FileText className="w-4 h-4" />,
  training: <GraduationCap className="w-4 h-4" />,
  system_bank_portal: <Monitor className="w-4 h-4" />,
  break: <Coffee className="w-4 h-4" />,
  idle: <Clock className="w-4 h-4" />,
};

// Selectable activities (exclude break and idle which are system-managed)
const SELECTABLE_ACTIVITIES: ActivityType[] = [
  'data_collection',
  'customer_followup',
  'calling_telecalling',
  'calling_coldcalling',
  'calling_calllist_movement',
  'client_meeting',
  'admin_documentation',
  'training',
  'system_bank_portal',
];

export const ActivitySelector: React.FC<ActivitySelectorProps> = ({
  currentActivity,
  onActivityChange,
  disabled = false,
  isOnBreak = false,
  breakLabel = 'Break',
}) => {
  if (isOnBreak) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Coffee className="w-5 h-5 text-amber-500" />
        <span className="font-medium text-amber-600">{breakLabel}</span>
        <Badge variant="outline" className="ml-auto border-amber-500/50 text-amber-600">
          System Enforced
        </Badge>
      </div>
    );
  }

  return (
    <Select
      value={currentActivity || ''}
      onValueChange={(value) => onActivityChange(value as ActivityType)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full h-12 text-base">
        <SelectValue placeholder="Select your current activity...">
          {currentActivity && (
            <div className="flex items-center gap-2">
              {ACTIVITY_ICONS[currentActivity]}
              <span>{ACTIVITY_LABELS[currentActivity]}</span>
              {CALLING_ACTIVITIES.includes(currentActivity) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <PhoneCall className="w-3 h-3 mr-1" />
                  Calling
                </Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {SELECTABLE_ACTIVITIES.map((activity) => (
          <SelectItem key={activity} value={activity}>
            <div className="flex items-center gap-2">
              {ACTIVITY_ICONS[activity]}
              <span>{ACTIVITY_LABELS[activity]}</span>
              {CALLING_ACTIVITIES.includes(activity) && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Calling
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
