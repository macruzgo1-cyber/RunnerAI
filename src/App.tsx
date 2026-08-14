import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { Onboarding } from '@/screens/Onboarding';
import { AppShell } from '@/components/AppShell';
import { Activity } from 'lucide-react';

function Root() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/30 animate-pulse">
          <Activity className="h-8 w-8 text-ink-950" strokeWidth={2.5} />
        </div>
        <p className="text-sm text-zinc-500">RunnerAI</p>
      </div>
    );
  }

  if (!session) return <AuthScreen />;
  if (!profile || !profile.onboarded) return <Onboarding />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
