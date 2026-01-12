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
import { UploadPage } from "./pages/UploadPage";
import { CallListPage } from "./pages/CallListPage";
import { LeadsPage } from "./pages/LeadsPage";
import { SettingsPage } from "./pages/SettingsPage";
import UserManagementPage from "./pages/UserManagementPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import AlertHistoryPage from "./pages/AlertHistoryPage";
import ReportsPage from "./pages/ReportsPage";
import ProfileVisibilityTest from "./pages/ProfileVisibilityTest";
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
              <Route path="/call-list" element={<CallListPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/contacts" element={<Dashboard />} />
              <Route path="/supervisor" element={<SupervisorDashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/messages" element={<Dashboard />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/user-management" element={<UserManagementPage />} />
              <Route path="/team-management" element={<TeamManagementPage />} />
              <Route path="/alert-history" element={<AlertHistoryPage />} />
              <Route path="/profile-visibility-test" element={<ProfileVisibilityTest />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
