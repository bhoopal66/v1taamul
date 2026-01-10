import React, { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Award,
  Trophy,
  Star,
  Calendar,
  Phone,
  Target,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

interface CertificateData {
  agentName: string;
  totalCalls: number;
  totalInterested: number;
  totalLeads: number;
  conversionRate: number;
  rank: number;
  totalAgents: number;
  daysActive: number;
  earnedAchievements: number;
  bestDay: { date: string; calls: number } | null;
  longestStreak: number;
}

interface PerformanceCertificateProps {
  data: CertificateData;
}

export const PerformanceCertificate: React.FC<PerformanceCertificateProps> = ({ data }) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `${data.agentName.replace(/\s+/g, '_')}_Performance_Certificate.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const currentDate = format(new Date(), 'MMMM d, yyyy');

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Performance Certificate
          </h3>
          <Button 
            onClick={handleDownload} 
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Certificate
          </Button>
        </div>

        {/* Certificate Preview */}
        <div 
          ref={certificateRef}
          className="relative bg-white rounded-lg overflow-hidden border-4 border-primary/20"
          style={{ aspectRatio: '1.414' }}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 20px,
                currentColor 20px,
                currentColor 21px
              )`
            }} />
          </div>

          {/* Certificate Border */}
          <div className="absolute inset-4 border-2 border-primary/30 rounded-lg" />
          <div className="absolute inset-6 border border-primary/20 rounded-lg" />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-between p-8 text-center">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Trophy className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-wide uppercase">
                Certificate of Excellence
              </h1>
              <p className="text-sm text-gray-500">TeleSales Automation System</p>
            </div>

            {/* Main Content */}
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <p className="text-gray-600">This certificate is proudly presented to</p>
              <h2 className="text-3xl font-bold text-primary">{data.agentName}</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                In recognition of outstanding performance and dedication to excellence in telesales
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mt-6 max-w-lg mx-auto">
                <div className="text-center p-3 bg-primary/5 rounded-lg">
                  <Phone className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xl font-bold text-gray-800">{data.totalCalls.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Calls</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <p className="text-xl font-bold text-gray-800">{data.conversionRate}%</p>
                  <p className="text-xs text-gray-500">Conversion</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Target className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                  <p className="text-xl font-bold text-gray-800">{data.totalLeads}</p>
                  <p className="text-xs text-gray-500">Leads</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <Star className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
                  <p className="text-xl font-bold text-gray-800">#{data.rank}</p>
                  <p className="text-xs text-gray-500">Rank</p>
                </div>
              </div>

              {/* Achievements Badge */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <Badge variant="secondary" className="px-4 py-1">
                  <Award className="w-4 h-4 mr-2" />
                  {data.earnedAchievements} Achievements Earned
                </Badge>
                <Badge variant="outline" className="px-4 py-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  {data.daysActive} Days Active
                </Badge>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <div className="w-32 h-px bg-gray-300 mx-auto" />
              <p className="text-xs text-gray-500">Issued on {currentDate}</p>
              <p className="text-xs text-gray-400">Certificate ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
            </div>
          </div>

          {/* Corner Decorations */}
          <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-primary/30 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-primary/30 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-primary/30 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-primary/30 rounded-br-lg" />
        </div>
      </CardContent>
    </Card>
  );
};
