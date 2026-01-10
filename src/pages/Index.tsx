import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Phone, BarChart3, Upload, Users, ArrowRight, Headphones } from 'lucide-react';

const Index: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20">
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Headphones className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-white">TeleSales</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" className="text-white hover:bg-white/10" asChild>
            <a href="/login">Sign In</a>
          </Button>
          <Button className="bg-white text-sidebar hover:bg-white/90" asChild>
            <a href="/signup">Get Started</a>
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Supercharge Your <span className="text-primary">Telesales</span> Operations
          </h1>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            Manage 200+ agents, eliminate duplicate calls, track performance in real-time, and convert more leads with our intelligent automation platform.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="h-12 px-8 text-lg" asChild>
              <a href="/signup">Start Free Trial <ArrowRight className="ml-2 w-5 h-5" /></a>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mt-24">
          {[
            { icon: Upload, title: 'Smart Upload', desc: 'Auto-detect duplicates, validate contacts instantly' },
            { icon: Phone, title: 'Call Management', desc: 'Organized call lists with one-click feedback' },
            { icon: BarChart3, title: 'Real-time Analytics', desc: 'Live dashboards for agents & supervisors' },
            { icon: Users, title: 'Team Oversight', desc: 'Monitor 200+ agents from one screen' },
          ].map((f, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-white/60 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
