import { useState, useEffect, useCallback } from 'react';
import { supabase, type Workout, type Profile, type UserStats } from '@/lib/supabase';
import { computeStats, formatRaceTime, formatPace, type ComputedStats } from '@/lib/metrics';
import { Card, RingGauge, Pill, AreaChart } from '@/components/ui';
import { Shield, ShieldCheck, ShieldAlert, Trophy, TrendingUp, Droplets, Moon, Dumbbell, Apple, HeartPulse, Zap, Gauge } from 'lucide-react';

export function InsightsScreen({ profile, stats }: { profile: Profile; stats: UserStats | null }) {
  const [computed, setComputed] = useState<ComputedStats | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', profile.id)
      .order('started_at', { ascending: false })
      .limit(80);
    if (data?.length) setComputed(computeStats(data as Workout[], profile));
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!computed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Zap className="h-8 w-8 animate-pulse text-brand-500" />
      </div>
    );
  }

  const s = computed;
  const races = [
    { label: '5K', dist: '5 km', sec: s.predicted5k, color: '#22d3ee' },
    { label: '10K', dist: '10 km', sec: s.predicted10k, color: '#34d399' },
    { label: 'Media', dist: '21.1 km', sec: s.predictedHalf, color: '#fbbf24' },
    { label: 'Maratón', dist: '42.2 km', sec: s.predictedFull, color: '#fb7185' },
  ];

  const injuryColors = { low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', icon: ShieldCheck }, medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', icon: Shield }, high: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20', icon: ShieldAlert } };
  const ir = injuryColors[s.injuryRisk];
  const InjuryIcon = ir.icon;

  // recovery recommendations
  const weight = profile.weight_kg ?? 70;
  const recoveryTips = [
    { icon: Droplets, label: 'Hidratación', value: `${Math.round(weight * 0.5)} ml`, desc: 'extra hoy', color: 'text-sky-400' },
    { icon: Apple, label: 'Carbohidratos', value: `${Math.round(weight * 1)} g`, desc: 'reposición', color: 'text-emerald-400' },
    { icon: Dumbbell, label: 'Proteína', value: `${Math.round(weight * 0.3)} g`, desc: 'en 30-60 min', color: 'text-brand-400' },
    { icon: Moon, label: 'Sueño', value: '8 h+', desc: 'objetivo', color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-5 pb-6">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold tracking-tight text-white">Análisis IA</h1>
        <p className="text-sm text-zinc-400">Predicciones, riesgo de lesión y recuperación</p>
      </div>

      {/* Race predictions */}
      <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Predicción de tiempos</h2>
          {!profile.is_premium && <Pill color="amber">Premium</Pill>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {races.map((r) => (
            <Card key={r.label} className="overflow-hidden p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{r.dist}</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
              </div>
              <div className="mt-3 text-3xl font-extrabold tabular-nums text-white">{formatRaceTime(r.sec)}</div>
              <div className="mt-1 text-xs text-zinc-500">{r.sec ? `${formatPace(r.sec / (r.label === 'Media' ? 21.0975 : r.label === 'Maratón' ? 42.195 : r.label === '10K' ? 10 : 5))}/km` : 'sin datos'}</div>
            </Card>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-zinc-600">Basado en tus mejores esfuerzos recientes (modelo Riegel). Precisión mejora con más datos.</p>
      </div>

      {/* Injury risk */}
      <Card className="overflow-hidden p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <InjuryIcon className={`h-5 w-5 ${ir.text}`} />
            <h2 className="text-sm font-bold text-white">Riesgo de lesión</h2>
          </div>
          <Pill color={s.injuryRisk === 'low' ? 'emerald' : s.injuryRisk === 'medium' ? 'amber' : 'rose'}>
            {s.injuryRisk === 'low' ? 'Bajo' : s.injuryRisk === 'medium' ? 'Medio' : 'Alto'}
          </Pill>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <RingGauge value={s.injuryRiskScore} size={110} stroke={10} color={s.injuryRisk === 'low' ? '#34d399' : s.injuryRisk === 'medium' ? '#fbbf24' : '#fb7185'}>
            <span className="text-3xl font-extrabold tabular-nums text-white">{s.injuryRiskScore}</span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">/ 100</span>
          </RingGauge>
          <div className="flex-1 space-y-2">
            <RiskFactor label="Incremento de carga" value={s.trainingLoad > 200 ? 'Alto' : 'Normal'} good={s.trainingLoad <= 200} />
            <RiskFactor label="Fatiga acumulada" value={`${s.fatigueScore}/100`} good={s.fatigueScore < 60} />
            <RiskFactor label="Recuperación" value={`${s.recoveryScore}/100`} good={s.recoveryScore >= 50} />
          </div>
        </div>
        <div className={`mt-4 rounded-2xl ${ir.bg} p-4 ring-1 ${ir.ring}`}>
          <p className={`text-xs leading-relaxed ${ir.text}`}>
            {s.injuryRisk === 'high'
              ? 'Riesgo elevado. Reduce el volumen 30% esta semana, prioriza sueño y movilidad. Si hay dolor, descansa 2-3 días.'
              : s.injuryRisk === 'medium'
                ? 'Riesgo moderado. Mantén el volumen, añade 2 sesiones de fuerza y 10 min de movilidad diaria.'
                : 'Riesgo bajo. Tu carga es equilibrada. Continúa con tu plan e incluye trabajo de fuerza preventivo.'}
          </p>
        </div>
      </Card>

      {/* Fitness trend */}
      <Card className="p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Tendencia de forma</h2>
          </div>
          <span className={`text-sm font-bold ${s.progressPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{s.progressPct >= 0 ? '+' : ''}{s.progressPct}%</span>
        </div>
        <AreaChart data={s.weeklyTss} height={90} color="#22d3ee" />
        <div className="mt-3 flex justify-between text-xs text-zinc-600">
          <span>Hace 8 sem</span>
          <span>Hoy</span>
        </div>
      </Card>

      {/* VO2 + Fitness breakdown */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">VO2 máx</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{s.vo2Max}</div>
          <div className="mt-1 text-xs text-zinc-500">ml/kg/min estimado</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Forma/Fatiga</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{s.fitness - s.fatigue > 0 ? '+' : ''}{s.fitness - s.fatigue}</div>
          <div className="mt-1 text-xs text-zinc-500">TSB ( readiness)</div>
        </Card>
      </div>

      {/* Recovery recommendations */}
      <div className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <div className="mb-3 flex items-center gap-2">
          <Moon className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-bold text-white">Recuperación post-entreno</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {recoveryTips.map((t) => (
            <Card key={t.label} className="p-4">
              <div className={`flex items-center gap-2 ${t.color}`}>
                <t.icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t.label}</span>
              </div>
              <div className="mt-2 text-xl font-bold text-white">{t.value}</div>
              <div className="text-xs text-zinc-500">{t.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Mobility & stretching */}
      <Card className="p-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <div className="mb-3 flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Movilidad recomendada</h2>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Foam roller cadena posterior', time: '5 min' },
            { name: 'Isquiotibiales + gemelos', time: '3 min' },
            { name: 'Movilidad de cadera', time: '3 min' },
            { name: 'Fuerza core (plancha)', time: '2 min' },
          ].map((m) => (
            <div key={m.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
              <span className="text-sm text-zinc-300">{m.name}</span>
              <span className="text-xs font-medium text-zinc-500">{m.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RiskFactor({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-xs font-semibold ${good ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</span>
    </div>
  );
}
