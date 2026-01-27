import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// If a user has multiple roles rows, pick the highest-privilege one.
// Keep this list in descending privilege order.
const ROLE_PRIORITY = [
  'super_admin',
  'admin',
  'operations_head',
  'sales_controller',
  'supervisor',
  'coordinator',
  'agent',
] as const;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  profile: any | null;
  ledTeamId: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  profile: null,
  ledTeamId: null,
  refreshProfile: async () => {},
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [ledTeamId, setLedTeamId] = useState<string | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch user roles (can be multiple rows)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.warn('Error fetching user roles:', rolesError);
      }

      const roles = (rolesData || [])
        .map((r: any) => r?.role)
        .filter(Boolean) as string[];

      const resolvedRole =
        ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? 'agent';

      setUserRole(resolvedRole);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Check if user leads a team
      const { data: teamData } = await supabase
        .from('teams')
        .select('id')
        .eq('leader_id', userId)
        .maybeSingle();
      
      if (teamData) {
        setLedTeamId(teamData.id);
      } else {
        setLedTeamId(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fail safe: don't block the app forever; default to least privilege.
      setUserRole('agent');
      setLedTeamId(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Reset derived state so layouts can safely wait for fresh role/profile
          setUserRole(null);
          setProfile(null);
          setLedTeamId(null);
          // Use setTimeout to avoid race conditions with database triggers
          setTimeout(() => fetchUserData(session.user.id), 100);
        } else {
          setUserRole(null);
          setProfile(null);
          setLedTeamId(null);
        }
        
        setLoading(false);
      }
    );

    // THEN get initial session with timeout fallback
    const sessionTimeout = setTimeout(() => {
      // If session fetch takes too long, stop loading anyway
      setLoading(false);
    }, 10000); // 10 second timeout

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setUserRole(null);
          setProfile(null);
          setLedTeamId(null);
          fetchUserData(session.user.id);
        }
        
        setLoading(false);
      })
      .catch((error) => {
        clearTimeout(sessionTimeout);
        console.error('Error getting session:', error);
        // On error, stop loading and let user access public pages
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, profile, ledTeamId, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
