import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { SupervisorDashboard } from "./pages/SupervisorDashboard";
import { AgentProfile } from "./pages/AgentProfile";
import { TeamLeaderDashboard } from "./pages/TeamLeaderDashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { UploadPage } from "./pages/UploadPage";
import UploadHistoryPage from "./pages/UploadHistoryPage";
import { CallListPage } from "./pages/CallListPage";
import { LeadsPage } from "./pages/LeadsPage";
import { SettingsPage } from "./pages/SettingsPage";
import UserManagementPage from "./pages/UserManagementPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import AlertHistoryPage from "./pages/AlertHistoryPage";
import ReportsPage from "./pages/ReportsPage";
import ProfileVisibilityTest from "./pages/ProfileVisibilityTest";
import PermissionsPage from "./pages/PermissionsPage";
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
              {/* Dashboard - Supervisors, Admins, Management only */}
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Profile & Leaderboard - All authenticated users */}
              <Route path="/profile" element={<AgentProfile />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              
              {/* Core agent features - All authenticated users */}
              <Route path="/call-list" element={<CallListPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/upload-history" element={<UploadHistoryPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/contacts" element={<Dashboard />} />
              
              {/* Supervisor Dashboard - Supervisors and above */}
              <Route path="/supervisor" element={
                <ProtectedRoute allowedRoles={['supervisor', 'operations_head', 'admin', 'super_admin']}>
                  <SupervisorDashboard />
                </ProtectedRoute>
              } />
              
              {/* Team Leader Dashboard - Team leaders (any role) */}
              <Route path="/my-team" element={
                <ProtectedRoute requiresTeamLeader>
                  <TeamLeaderDashboard />
                </ProtectedRoute>
              } />
              
              {/* Reports - Supervisors and above */}
              <Route path="/reports" element={
                <ProtectedRoute allowedRoles={['supervisor', 'operations_head', 'admin', 'super_admin']}>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              
              <Route path="/messages" element={<Dashboard />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* User Management - Admins, Super Admins, and Supervisor team leaders */}
              <Route path="/user-management" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'supervisor']}>
                  <UserManagementPage />
                </ProtectedRoute>
              } />
              
              {/* Team Management - Admins and Super Admins only */}
              <Route path="/team-management" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <TeamManagementPage />
                </ProtectedRoute>
              } />
              
              {/* Alert History - Supervisors and above */}
              <Route path="/alert-history" element={
                <ProtectedRoute allowedRoles={['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller']}>
                  <AlertHistoryPage />
                </ProtectedRoute>
              } />
              
              {/* Permissions Overview - Admins only */}
              <Route path="/permissions" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <PermissionsPage />
                </ProtectedRoute>
              } />
              
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
