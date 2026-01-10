import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { SupervisorDashboard } from "./pages/SupervisorDashboard";
import { AgentProfile } from "./pages/AgentProfile";
import { Leaderboard } from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<AgentProfile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/call-list" element={<Dashboard />} />
              <Route path="/upload" element={<Dashboard />} />
              <Route path="/leads" element={<Dashboard />} />
              <Route path="/contacts" element={<Dashboard />} />
              <Route path="/supervisor" element={<SupervisorDashboard />} />
              <Route path="/team" element={<SupervisorDashboard />} />
              <Route path="/reports" element={<Dashboard />} />
              <Route path="/messages" element={<Dashboard />} />
              <Route path="/settings" element={<Dashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
