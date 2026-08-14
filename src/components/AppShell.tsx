import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Dashboard } from '@/screens/Dashboard';
import { CoachScreen } from '@/screens/CoachScreen';
import { PlanScreen } from '@/screens/PlanScreen';
import { InsightsScreen } from '@/screens/InsightsScreen';
import { CommunityScreen } from '@/screens/CommunityScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { TwinScreen } from '@/screens/TwinScreen';
import { Activity, MessageCircle, Calendar, BarChart3, Users, User, Orbit } from 'lucide-react';

const tabs = [
  { id: 'dashboard', label: 'Inicio', icon: Activity },
  { id: 'plan', label: 'Plan', icon: Calendar },
  { id: 'twin', label: 'Twin', icon: Orbit, featured: true },
  { id: 'coach', label: 'Coach', icon: MessageCircle },
  { id: 'insights', label: 'Análisis', icon: BarChart3 },
] as const;

const secondaryTabs = [
  { id: 'community', label: 'Comunidad', icon: Users },
  { id: 'profile', label: 'Perfil', icon: User },
] as const;

type TabId = (typeof tabs)[number]['id'] | (typeof secondaryTabs)[number]['id'];

export function AppShell() {
  const { profile, stats } = useAuth();
  const [tab, setTab] = useState<TabId>('dashboard');

  if (!profile) return null;

  const isCoach = tab === 'coach';
  const isTwin = tab === 'twin';
  const fullScreen = isCoach;

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col bg-ink-950">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto no-scrollbar ${fullScreen ? '' : 'px-5 pt-6'}`}>
        {tab === 'dashboard' && <Dashboard profile={profile} stats={stats} onNavigate={(t) => setTab(t as TabId)} />}
        {tab === 'coach' && <CoachScreen profile={profile} />}
        {tab === 'plan' && <PlanScreen profile={profile} />}
        {tab === 'twin' && <TwinScreen profile={profile} />}
        {tab === 'insights' && <InsightsScreen profile={profile} stats={stats} />}
        {tab === 'community' && <CommunityScreen profile={profile} />}
        {tab === 'profile' && <ProfileScreen profile={profile} />}
      </div>

      {/* Bottom navigation */}
      {!fullScreen && (
        <nav className="glass border-t border-white/5 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          <div className="flex items-center justify-between">
            {/* Left tabs */}
            {tabs.slice(0, 2).map((t) => (
              <NavButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
            {/* Center featured Twin button */}
            <NavButton t={tabs[2]} active={tab === tabs[2].id} onClick={() => setTab(tabs[2].id)} />
            {/* Right tabs */}
            {tabs.slice(3).map((t) => (
              <NavButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
          {/* Secondary row */}
          <div className="mt-1 flex items-center justify-center gap-8 border-t border-white/5 pt-1.5">
            {secondaryTabs.map((t) => (
              <NavButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} compact />
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({
  t,
  active,
  onClick,
  compact,
}: {
  t: { id: string; label: string; icon: typeof Activity; featured?: boolean };
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const featured = t.featured;
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-1 flex-col items-center gap-1 py-1.5"
    >
      <div
        className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 ${
          featured ? 'h-11 w-11 -mt-4 shadow-lg' : 'h-9 w-9'
        } ${
          active
            ? featured
              ? 'bg-gradient-to-br from-violet-400 via-brand-400 to-emerald-400 shadow-brand-500/30 scale-110'
              : 'bg-brand-500/15 scale-110'
            : featured
              ? 'bg-gradient-to-br from-violet-500/30 via-brand-500/30 to-emerald-500/30 ring-1 ring-brand-500/20'
              : ''
        }`}
      >
        <t.icon
          className={`${featured ? 'h-5 w-5' : 'h-5 w-5'} transition-all duration-300 ${
            active
              ? featured
                ? 'text-ink-950'
                : 'text-brand-400'
              : featured
                ? 'text-brand-300'
                : 'text-zinc-500 group-hover:text-zinc-300'
          }`}
          strokeWidth={active || featured ? 2.5 : 2}
        />
        {active && !featured && (
          <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand-400 animate-pulse-ring" />
        )}
      </div>
      <span
        className={`text-[10px] font-medium transition-colors ${
          compact ? 'text-[9px]' : ''
        } ${active ? (featured ? 'text-brand-400 font-bold' : 'text-brand-400') : 'text-zinc-600'}`}
      >
        {t.label}
      </span>
    </button>
  );
}
