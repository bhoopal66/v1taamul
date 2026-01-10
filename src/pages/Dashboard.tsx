import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Target, ThumbsUp, ThumbsDown, PhoneOff, MessageSquare } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  const stats = [
    { label: 'Calls Today', value: 42, icon: Phone, color: 'bg-primary text-primary-foreground' },
    { label: 'Interested', value: 8, icon: ThumbsUp, color: 'bg-success text-success-foreground' },
    { label: 'Not Interested', value: 12, icon: ThumbsDown, color: 'bg-destructive text-destructive-foreground' },
    { label: 'Not Answered', value: 22, icon: PhoneOff, color: 'bg-warning text-warning-foreground' },
    { label: 'Leads Generated', value: 8, icon: Target, color: 'bg-accent text-accent-foreground' },
    { label: 'WhatsApp Sent', value: 8, icon: MessageSquare, color: 'bg-info text-info-foreground' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] || 'Agent'}!</h1>
        <p className="text-muted-foreground mt-1">Here's your performance overview for today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <a href="/call-list" className="feedback-btn-interested">
            <Phone className="w-5 h-5" /> Start Calling
          </a>
          <a href="/upload" className="feedback-btn bg-primary text-primary-foreground hover:bg-primary/90">
            Upload Contacts
          </a>
        </CardContent>
      </Card>
    </div>
  );
};
