import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type Profile, type UserStats } from '@/lib/supabase';

type AuthContextValue = {
  session: { user: { id: string; email: string } } | null;
  profile: Profile | null;
  stats: UserStats | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshStats: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
  };

  const refreshStats = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    setStats(data as UserStats | null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setStats(null);
    setSession(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(
        data.session
          ? { user: { id: data.session.user.id, email: data.session.user.email ?? '' } }
          : null,
      );
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      (async () => {
        setSession(
          sbSession
            ? { user: { id: sbSession.user.id, email: sbSession.user.email ?? '' } }
            : null,
        );
        if (!sbSession) {
          setProfile(null);
          setStats(null);
        }
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      Promise.all([refreshProfile(), refreshStats()]).finally(() => setLoading(false));
    }
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, profile, stats, loading, refreshProfile, refreshStats, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
