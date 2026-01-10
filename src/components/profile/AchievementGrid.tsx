import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Award, 
  Star, 
  Share2,
  Trophy,
  Lock
} from 'lucide-react';
import { Achievement } from '@/hooks/useAgentProfile';
import { ShareAchievementDialog } from './ShareAchievementDialog';

interface AchievementGridProps {
  earnedAchievements: Achievement[];
  inProgressAchievements: Achievement[];
  agentName: string;
}

export const AchievementGrid: React.FC<AchievementGridProps> = ({
  earnedAchievements,
  inProgressAchievements,
  agentName,
}) => {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleShare = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setShareDialogOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earned Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Earned Achievements
              <Badge variant="secondary" className="ml-2">{earnedAchievements.length}</Badge>
            </CardTitle>
            <CardDescription>Milestones you've achieved - click to share!</CardDescription>
          </CardHeader>
          <CardContent>
            {earnedAchievements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No achievements yet</p>
                <p className="text-sm">Start making calls to earn achievements!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {earnedAchievements.map((achievement) => (
                  <button
                    key={achievement.id}
                    onClick={() => handleShare(achievement)}
                    className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center transition-all hover:scale-105 hover:shadow-lg hover:border-primary/40 cursor-pointer"
                  >
                    <div className="relative">
                      <span className="text-3xl mb-2 block">{achievement.icon}</span>
                      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Share2 className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <h4 className="font-semibold text-sm">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{achievement.description}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* In Progress Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-warning" />
              In Progress
              <Badge variant="outline" className="ml-2">{inProgressAchievements.length}</Badge>
            </CardTitle>
            <CardDescription>Keep going to unlock these</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inProgressAchievements.slice(0, 5).map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border"
                >
                  <div className="relative">
                    <span className="text-2xl opacity-50">{achievement.icon}</span>
                    <Lock className="w-3 h-3 absolute -bottom-1 -right-1 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{achievement.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {achievement.progress}/{achievement.target}
                      </span>
                    </div>
                    <Progress 
                      value={(achievement.progress / achievement.target) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                  </div>
                </div>
              ))}
              {inProgressAchievements.length > 5 && (
                <p className="text-center text-sm text-muted-foreground">
                  +{inProgressAchievements.length - 5} more achievements to unlock
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ShareAchievementDialog
        achievement={selectedAchievement}
        agentName={agentName}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </>
  );
};
