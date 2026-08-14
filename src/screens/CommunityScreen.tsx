import { useState, useEffect, useCallback } from 'react';
import { supabase, type Achievement, type AppNotification, type Profile } from '@/lib/supabase';
import { Card, Pill, Button } from '@/components/ui';
import { Flame, Footprints, Medal, Sunrise, Target, Trophy, Zap, Star, Crown, Users, Bell, Activity, TrendingUp, Heart, Mountain } from 'lucide-react';

const badgeIcons: Record<string, typeof Flame> = {
  Flame, Footprints, Medal, Sunrise, Target, Trophy, Star, Crown,
};

export function CommunityScreen({ profile }: { profile: Profile }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<'logros' | 'challenges' | 'notificaciones' | 'comunidad'>('logros');

  const load = useCallback(async () => {
    const [a, n] = await Promise.all([
      supabase.from('achievements').select('*').eq('user_id', profile.id).order('earned_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setAchievements((a.data as Achievement[]) ?? []);
    setNotifications((n.data as AppNotification[]) ?? []);
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unread = notifications.filter((n) => !n.read).length;
  const xp = profile.total_xp;
  const level = profile.level;
  const nextLevelXp = level * 500;
  const levelProgress = Math.min(100, (xp % nextLevelXp) / nextLevelXp * 100);

  // mock leaderboard
  const leaderboard = [
    { name: 'Carlos M.', xp: 8420, km: 412, avatar: '🥇' },
    { name: 'Ana R.', xp: 7890, km: 389, avatar: '🥈' },
    { name: profile.full_name ?? 'Tú', xp, km: 0, avatar: '🏃', isYou: true },
    { name: 'Diego L.', xp: 5230, km: 287, avatar: '🏅' },
    { name: 'María J.', xp: 4110, km: 245, avatar: '🏃‍♀️' },
  ].sort((a, b) => b.xp - a.xp);

  const challenges = [
    { title: 'Reto 50K de marzo', desc: 'Acumula 50 km este mes', progress: 68, participants: 1240, icon: Mountain },
    { title: '7 días seguidos', desc: 'Entrena 7 días consecutivos', progress: 43, participants: 890, icon: Flame },
    { title: 'Series Warriors', desc: 'Completa 4 sesiones de series', progress: 25, participants: 560, icon: Zap },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold tracking-tight text-white">Comunidad</h1>
        <p className="text-sm text-zinc-400">Logros, retos y ránking</p>
      </div>

      {/* XP / Level card */}
      <Card className="overflow-hidden p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
            <span className="text-2xl font-extrabold text-ink-950">{level}</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Nivel {level} · {xp} XP</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${levelProgress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">{nextLevelXp - (xp % nextLevelXp)} XP para nivel {level + 1}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/[0.03] p-3 text-center ring-1 ring-white/5">
            <Flame className="mx-auto mb-1 h-5 w-5 text-orange-400" />
            <div className="text-lg font-bold text-white">{profile.current_streak}</div>
            <div className="text-[10px] uppercase text-zinc-500">Racha</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center ring-1 ring-white/5">
            <Trophy className="mx-auto mb-1 h-5 w-5 text-amber-400" />
            <div className="text-lg font-bold text-white">{achievements.length}</div>
            <div className="text-[10px] uppercase text-zinc-500">Insignias</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 text-center ring-1 ring-white/5">
            <Activity className="mx-auto mb-1 h-5 w-5 text-brand-400" />
            <div className="text-lg font-bold text-white">{profile.longest_streak}</div>
            <div className="text-[10px] uppercase text-zinc-500">Récord</div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-white/[0.03] p-1 ring-1 ring-white/5">
        {([['logros', 'Logros'], ['challenges', 'Retos'], ['notificaciones', 'Alertas'], ['comunidad', 'Ránking']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`relative flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${tab === id ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
          >
            {label}
            {id === 'notificaciones' && unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Achievements */}
      {tab === 'logros' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {achievements.map((a) => {
            const Icon = badgeIcons[a.icon] ?? Medal;
            return (
              <Card key={a.id} className="p-4 text-center animate-scale-in">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 ring-1 ring-amber-500/20">
                  <Icon className="h-7 w-7 text-amber-400" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">{a.title}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">{a.description}</p>
                <Pill color="amber" className="mt-2">+{a.xp_awarded} XP</Pill>
              </Card>
            );
          })}
          {achievements.length === 0 && (
            <Card className="col-span-2 p-8 text-center">
              <Trophy className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">Aún no has ganado insignias. ¡Entrena para desbloquearlas!</p>
            </Card>
          )}
        </div>
      )}

      {/* Challenges */}
      {tab === 'challenges' && (
        <div className="space-y-3 animate-fade-in">
          {challenges.map((c) => (
            <Card key={c.title} className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
                  <c.icon className="h-6 w-6 text-brand-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white">{c.title}</h3>
                  <p className="text-xs text-zinc-500">{c.desc}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${c.progress}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-brand-400 font-semibold">{c.progress}%</span>
                    <span className="text-zinc-500 flex items-center gap-1"><Users className="h-3 w-3" />{c.participants.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Notifications */}
      {tab === 'notificaciones' && (
        <div className="space-y-2 animate-fade-in">
          {unread > 0 && (
            <div className="flex justify-end">
              <button onClick={markAllRead} className="text-xs font-medium text-brand-400 hover:text-brand-300">Marcar todas leídas</button>
            </div>
          )}
          {notifications.map((n) => (
            <Card key={n.id} className={`p-4 ${!n.read ? 'ring-1 ring-brand-500/20' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notifColor(n.type).bg} ${notifColor(n.type).text}`}>
                  {notifIcon(n.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{n.title}</h3>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{n.body}</p>
                  <p className="mt-1.5 text-[10px] text-zinc-600">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </Card>
          ))}
          {notifications.length === 0 && (
            <Card className="p-8 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">Sin notificaciones. La IA te avisará cuando sea relevante.</p>
            </Card>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'comunidad' && (
        <div className="space-y-3 animate-fade-in">
          <Card className="overflow-hidden">
            {leaderboard.map((u, i) => (
              <div key={u.name} className={`flex items-center gap-4 px-5 py-3.5 ${u.isYou ? 'bg-brand-500/10' : ''} ${i < leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-400' : 'text-zinc-500'}`}>{i + 1}</span>
                <span className="text-xl">{u.avatar}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{u.name}{u.isYou && <span className="ml-2 text-xs text-brand-400">(tú)</span>}</div>
                  <div className="text-xs text-zinc-500">{u.km} km · {u.xp} XP</div>
                </div>
                {i === 0 && <Crown className="h-5 w-5 text-amber-400" />}
              </div>
            ))}
          </Card>
          <p className="px-1 text-center text-xs text-zinc-600">Ránking semanal entre tus amigos y grupos.</p>
        </div>
      )}
    </div>
  );
}

function notifColor(type: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    recovery: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
    workout: { bg: 'bg-brand-500/10', text: 'text-brand-400' },
    achievement: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    insight: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    plan: { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  };
  return map[type] ?? map.workout;
}

function notifIcon(type: string) {
  const icons: Record<string, typeof Bell> = {
    recovery: Heart, workout: Activity, achievement: Trophy, insight: TrendingUp, plan: Target,
  };
  const Icon = icons[type] ?? Bell;
  return <Icon className="h-4 w-4" />;
}

function timeAgo(dateStr: string): string {
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60) return 'hace un momento';
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return `hace ${Math.floor(sec / 86400)} d`;
}
