import { useEffect, useState, useCallback } from 'react';
import { supabase, type Workout, type Profile, type UserStats } from '@/lib/supabase';
import { computeStats, formatDuration, formatPace, type ComputedStats } from '@/lib/metrics';
import { Card, RingGauge, AreaChart, BarChart, StatTile, Pill } from '@/components/ui';
import { Activity, Flame, HeartPulse, Gauge, TrendingUp, TrendingDown, Wind, Zap, Moon, Trophy } from 'lucide-react';

export function Dashboard({ profile, stats, onNavigate }: { profile: Profile; stats: UserStats | null; onNavigate: (tab: string) => void }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [computed, setComputed] = useState<ComputedStats | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', profile.id)
      .order('started_at', { ascending: false })
      .limit(80);
    setWorkouts(data as Workout[] ?? []);
    if (data && data.length) {
      setComputed(computeStats(data as Workout[], profile));
    }
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const s = computed;
  const firstName = profile.full_name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  if (!s) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Activity className="h-8 w-8 animate-pulse text-brand-500" />
          <p className="text-sm">Analizando tus datos...</p>
        </div>
      </div>
    );
  }

  const readiness = s.recoveryScore;
  const readinessLabel = readiness >= 70 ? 'Listo' : readiness >= 45 ? 'Moderado' : 'Fatigado';
  const readinessColor = readiness >= 70 ? '#34d399' : readiness >= 45 ? '#fbbf24' : '#fb7185';

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <p className="text-sm text-zinc-500">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">{firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile.is_premium ? (
            <Pill color="amber"><Zap className="h-3 w-3" /> Premium</Pill>
          ) : (
            <Pill color="zinc">{profile.level > 0 ? `Nivel ${profile.level}` : 'Gratis'}</Pill>
          )}
        </div>
      </div>

      {/* Readiness hero */}
      <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="relative p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative flex items-center gap-6">
            <RingGauge value={readiness} size={130} stroke={11} color={readinessColor} label={`${readiness}`} sublabel="Readiness">
              <span className="text-4xl font-extrabold tabular-nums text-white">{readiness}</span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{readinessLabel}</span>
            </RingGauge>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Estado de forma</p>
                <p className="text-lg font-bold text-white">
                  {readiness >= 70 ? 'Listo para entrenar' : readiness >= 45 ? 'Carga moderada' : 'Necesitas descanso'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniMetric icon={<Flame className="h-3.5 w-3.5" />} label="Fitness" value={s.fitness} color="text-emerald-400" />
                <MiniMetric icon={<HeartPulse className="h-3.5 w-3.5" />} label="Fatiga" value={s.fatigueScore} color="text-amber-400" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <StatTile label="VO2 máx" value={s.vo2Max} sub="estimado" icon={<Gauge className="h-4 w-4" />} accent="text-brand-400" />
        <StatTile label="Carga semanal" value={`${s.weeklyDistanceKm} km`} sub={`${s.trainingLoad} TSS`} icon={<Activity className="h-4 w-4" />} />
        <StatTile
          label="Progreso"
          value={`${s.progressPct > 0 ? '+' : ''}${s.progressPct}%`}
          sub="vs 4 semanas"
          icon={s.progressPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          accent={s.progressPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatTile label="Total" value={`${s.totalDistanceKm} km`} sub={`${s.totalWorkouts} sesiones`} icon={<Wind className="h-4 w-4" />} />
      </div>

      {/* Training load chart */}
      <Card className="p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Carga de entrenamiento</h2>
            <p className="text-xs text-zinc-500">TSS por semana · últimas 8 semanas</p>
          </div>
          <Pill color={s.injuryRisk === 'low' ? 'emerald' : s.injuryRisk === 'medium' ? 'amber' : 'rose'}>
            Riesgo {s.injuryRisk === 'low' ? 'bajo' : s.injuryRisk === 'medium' ? 'medio' : 'alto'}
          </Pill>
        </div>
        <BarChart data={s.weeklyTss} height={90} color="#22d3ee" labels={s.weeklyTss.map((_, i) => `S${i + 1}`)} />
      </Card>

      {/* Coach suggestion */}
      <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }} onClick={() => onNavigate('coach')}>
        <div className="flex items-start gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600">
            <Activity className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Sugerencia del Coach IA</h3>
              <Pill color="brand">IA</Pill>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {readiness < 45
                ? 'Hoy deberías descansar. Tu recuperación está baja — un descanso activo mejorará la adaptación.'
                : readiness >= 70
                  ? 'Estás fresco. Mañana es ideal para una sesión de calidad (series o tempo).'
                  : 'Carga moderada recomendada: 30-40 min en zona 2 para mantener adaptación sin fatiga extra.'}
            </p>
            <span className="mt-2 inline-block text-xs font-semibold text-brand-400">Pregúntale al coach →</span>
          </div>
        </div>
      </Card>

      {/* Recent workouts */}
      <div className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Últimos entrenamientos</h2>
          <span className="text-xs text-zinc-500">{workouts.length} totales</span>
        </div>
        <div className="space-y-2">
          {s.recentWorkouts.map((w) => (
            <WorkoutRow key={w.id} w={w} />
          ))}
          {s.recentWorkouts.length === 0 && (
            <Card className="p-8 text-center">
              <Trophy className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">Aún no hay entrenamientos. Conecta un reloj para empezar.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Recovery preview */}
      <Card className="p-5 animate-slide-up" style={{ animationDelay: '0.3s' }} onClick={() => onNavigate('insights')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Recuperación</h2>
          <Moon className="h-4 w-4 text-zinc-600" />
        </div>
        <div className="space-y-3">
          <RecoveryBar label="Sueño recomendado" value={8} max={10} unit="h" color="#818cf8" />
          <RecoveryBar label="Hidratación" value={2.5} max={3} unit="L" color="#22d3ee" />
          <RecoveryBar label="Proteína" value={110} max={140} unit="g" color="#34d399" />
        </div>
      </Card>
    </div>
  );
}

function MiniMetric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/5">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

function RecoveryBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-semibold tabular-nums text-white">{value} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function WorkoutRow({ w }: { w: Workout }) {
  const date = new Date(w.started_at);
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86400000);
  const dateLabel = daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : `Hace ${daysAgo}d`;
  const sourceIcon: Record<string, string> = { strava: 'Strava', garmin: 'Garmin', coros: 'Coros', polar: 'Polar', apple_health: 'Apple' };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 ring-1 ring-brand-500/20">
          <span className="text-base font-extrabold text-brand-400">{w.distance_km.toFixed(0)}</span>
          <span className="text-[8px] font-semibold uppercase text-zinc-500">km</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-bold text-white">{w.title ?? 'Entrenamiento'}</h3>
            <span className="text-xs text-zinc-500">{dateLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{formatPace(w.avg_pace_sec_per_km)}/km</span>
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{formatDuration(w.duration_sec)}</span>
            {w.avg_heart_rate && <span className="flex items-center gap-1"><HeartPulse className="h-3 w-3" />{w.avg_heart_rate} bpm</span>}
          </div>
        </div>
        {w.source && (
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{sourceIcon[w.source] ?? w.source}</span>
        )}
      </div>
    </Card>
  );
}
