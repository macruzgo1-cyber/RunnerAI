import { useState, useEffect, useCallback } from 'react';
import { supabase, type TrainingPlan, type PlanSession, type Profile, type Workout } from '@/lib/supabase';
import { computeStats, formatPace, type ComputedStats } from '@/lib/metrics';
import { generatePlan } from '@/lib/planner';
import { Card, Button, Pill } from '@/components/ui';
import { sessionColor } from '@/lib/planner';
import { Calendar, Check, ChevronRight, Loader2, RefreshCw, Zap, Activity, Moon, Mountain, Wind, HeartPulse, Dumbbell, Gauge } from 'lucide-react';

const iconMap: Record<string, typeof Zap> = {
  easy: Wind,
  intervals: Zap,
  tempo: Gauge,
  long: Mountain,
  recovery: HeartPulse,
  rest: Moon,
  strength: Dumbbell,
};

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function PlanScreen({ profile }: { profile: Profile }) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [sessions, setSessions] = useState<PlanSession[]>([]);
  const [stats, setStats] = useState<ComputedStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'week' | 'all'>('week');

  const load = useCallback(async () => {
    const { data: plans } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    const p = (plans?.[0] as TrainingPlan) ?? null;
    setPlan(p);
    if (p) {
      const { data: sess } = await supabase
        .from('plan_sessions')
        .select('*')
        .eq('plan_id', p.id)
        .order('week_number', { ascending: true })
        .order('day_of_week', { ascending: true });
      setSessions((sess as PlanSession[]) ?? []);
    }
    const { data: w } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', profile.id)
      .order('started_at', { ascending: false })
      .limit(80);
    if (w?.length) setStats(computeStats(w as Workout[], profile));
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const regenerate = async () => {
    if (!stats) return;
    setBusy(true);
    try {
      const generated = generatePlan(profile, stats);
      // mark old plan paused
      if (plan) {
        await supabase.from('training_plans').update({ status: 'paused' }).eq('id', plan.id);
      }
      const { data: newPlan } = await supabase
        .from('training_plans')
        .insert({
          user_id: profile.id,
          name: generated.name,
          goal: generated.goal,
          target_race_date: null,
          target_time_sec: generated.target_time_sec,
          weeks: generated.weeks,
          status: 'active',
          current_week: 1,
          generated_context: { reason: 'manual_regenerate', recovery: stats.recoveryScore },
        })
        .select()
        .single();
      if (newPlan) {
        const sessRows = generated.sessions.map((s, i) => ({
          plan_id: newPlan.id,
          user_id: profile.id,
          week_number: 1 + Math.floor(i / 7),
          day_of_week: s.day_of_week,
          date: s.date,
          session_type: s.session_type,
          title: s.title,
          description: s.description,
          distance_km: s.distance_km,
          duration_min: s.duration_min,
          target_pace_sec_per_km: s.target_pace_sec_per_km,
          intensity: s.intensity,
          status: 'pending' as const,
        }));
        await supabase.from('plan_sessions').insert(sessRows);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const markSession = async (s: PlanSession, status: 'completed' | 'skipped') => {
    await supabase.from('plan_sessions').update({ status }).eq('id', s.id);
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));
  };

  if (!plan) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Calendar className="h-10 w-10 text-zinc-600" />
        <div>
          <h2 className="text-lg font-bold text-white">Aún no tienes un plan</h2>
          <p className="mt-1 text-sm text-zinc-400">Genera tu plan personalizado con IA.</p>
        </div>
        <Button onClick={regenerate} disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-4 w-4" />}
          Generar plan
        </Button>
      </div>
    );
  }

  const currentWeek = plan.current_week;
  const weekSessions = sessions.filter((s) => s.week_number === currentWeek);
  const shownSessions = view === 'week' ? weekSessions : sessions;
  const completedCount = weekSessions.filter((s) => s.status === 'completed').length;
  const weekProgress = weekSessions.filter((s) => s.session_type !== 'rest').length
    ? Math.round((completedCount / weekSessions.filter((s) => s.session_type !== 'rest').length) * 100)
    : 0;

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Plan de entrenamiento</h1>
          <p className="text-sm text-zinc-400">{plan.name}</p>
        </div>
        <button
          onClick={regenerate}
          disabled={busy}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-zinc-300 ring-1 ring-white/10 transition-all hover:bg-white/10 disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Plan summary */}
      <Card className="p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Semana {currentWeek} de {plan.weeks}</p>
            <p className="mt-1 text-2xl font-bold text-white">{weekProgress}%<span className="ml-1 text-sm font-normal text-zinc-500">completado</span></p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
            <Calendar className="h-7 w-7 text-brand-400" />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700" style={{ width: `${weekProgress}%` }} />
        </div>
        <div className="mt-4 flex gap-2">
          <Pill color="emerald">{completedCount} completadas</Pill>
          <Pill color="amber">{weekSessions.filter((s) => s.status === 'pending' && s.session_type !== 'rest').length} pendientes</Pill>
        </div>
      </Card>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['week', 'all'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-2xl py-2.5 text-sm font-medium transition-all ${view === v ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {v === 'week' ? 'Esta semana' : 'Todo el plan'}
          </button>
        ))}
      </div>

      {/* Week navigation (week view) */}
      {view === 'week' && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => currentWeek > 1 && supabase.from('training_plans').update({ current_week: currentWeek - 1 }).eq('id', plan.id).then(() => setPlan({ ...plan, current_week: currentWeek - 1 }))}
            disabled={currentWeek <= 1}
            className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 disabled:opacity-30"
          >‹ Semana anterior</button>
          <span className="text-xs font-medium text-zinc-500">Semana {currentWeek}</span>
          <button
            onClick={() => currentWeek < plan.weeks && supabase.from('training_plans').update({ current_week: currentWeek + 1 }).eq('id', plan.id).then(() => setPlan({ ...plan, current_week: currentWeek + 1 }))}
            disabled={currentWeek >= plan.weeks}
            className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 disabled:opacity-30"
          >Siguiente ›</button>
        </div>
      )}

      {/* Sessions */}
      <div className="space-y-2">
        {shownSessions.map((s) => {
          const Icon = iconMap[s.session_type] ?? Activity;
          const colors = sessionColor(s.session_type);
          const date = new Date(s.date + 'T00:00:00');
          const isPast = date.getTime() < Date.now() - 86400000;
          const isToday = s.date === new Date().toISOString().slice(0, 10);
          return (
            <Card
              key={s.id}
              className={`p-4 ${isToday ? 'ring-2 ring-brand-500/40' : ''} ${s.status === 'completed' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* date block */}
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="text-[10px] font-medium uppercase text-zinc-500">{dayNames[s.day_of_week]}</span>
                  <span className="text-lg font-bold text-white">{date.getDate()}</span>
                </div>
                {/* icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
                  <Icon className="h-5 w-5" />
                </div>
                {/* content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate text-sm font-bold ${s.status === 'completed' ? 'text-zinc-400 line-through' : 'text-white'}`}>{s.title}</h3>
                    {isToday && <Pill color="brand" className="!py-0">Hoy</Pill>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {s.distance_km && <span>{s.distance_km} km</span>}
                    {s.duration_min && <span>{s.duration_min} min</span>}
                    {s.target_pace_sec_per_km && <span>· {formatPace(s.target_pace_sec_per_km)}/km</span>}
                    {s.intensity && <span className="capitalize">· {s.intensity}</span>}
                  </div>
                </div>
                {/* status */}
                {s.status === 'pending' && s.session_type !== 'rest' && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => markSession(s, 'completed')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 transition-all hover:bg-emerald-500/20" title="Completar">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {s.status === 'completed' && <Check className="h-5 w-5 shrink-0 text-emerald-400" />}
                {s.status === 'skipped' && <span className="text-xs text-zinc-600">omitida</span>}
              </div>
              {s.description && s.session_type !== 'rest' && (
                <p className="mt-3 pl-[88px] text-xs leading-relaxed text-zinc-500">{s.description}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
