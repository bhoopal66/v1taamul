import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  team_id: string | null;
  supervisor_id: string | null;
  is_active: boolean;
  login_streak_current: number;
  login_streak_longest: number;
  phone_number: string | null;
  whatsapp_number: string | null;
  created_at: string | null;
  last_login_date: string | null;
}

interface AuthContextType {
  user: User | null;
  session: { user: User } | null;
  loading: boolean;
  userRole: string | null;
  profile: Profile | null;
  ledTeamId: string | null;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  profile: null,
  ledTeamId: null,
  refreshProfile: async () => {},
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ledTeamId, setLedTeamId] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get<{
        user: User | null;
        role: string | null;
        profile: Profile | null;
        ledTeamId: string | null;
      }>('/auth/me');

      if (response.user) {
        setUser(response.user);
        setUserRole(response.role);
        setProfile(response.profile);
        setLedTeamId(response.ledTeamId);
      } else {
        setUser(null);
        setUserRole(null);
        setProfile(null);
        setLedTeamId(null);
      }
    } catch (error) {
      setUser(null);
      setUserRole(null);
      setProfile(null);
      setLedTeamId(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    await fetchCurrentUser();
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post<{
        user: User;
        role: string | null;
        profile: Profile | null;
        ledTeamId: string | null;
      }>('/auth/login', { email, password });

      setUser(response.user);
      setUserRole(response.role);
      setProfile(response.profile);
      setLedTeamId(response.ledTeamId);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const signup = async (email: string, password: string, fullName: string) => {
    try {
      const response = await api.post<{
        user: User;
        role: string | null;
        profile: Profile | null;
      }>('/auth/signup', { email, password, fullName });

      setUser(response.user);
      setUserRole(response.role);
      setProfile(response.profile);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Signup failed' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      // Ignore logout errors
    } finally {
      setUser(null);
      setUserRole(null);
      setProfile(null);
      setLedTeamId(null);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session: user ? { user } : null,
      loading,
      userRole,
      profile,
      ledTeamId,
      refreshProfile,
      login,
      signup,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
