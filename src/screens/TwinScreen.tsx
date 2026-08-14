import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type Workout, type TwinSignal, type TwinState, type TwinSeason } from '@/lib/supabase';
import { computeStats } from '@/lib/metrics';
import { formatRaceTime, formatPace } from '@/lib/metrics';
import {
  computeTwinModel, generateCoachDecisions, computeEvolution, computePredictions,
  simulateScenario, generateSeason, persistTwinState, topVulnerabilityZone, zoneLabel,
  type TwinModelState, type CoachDecision, type ScenarioProjection, type EvolutionPoint, type PredictionSet,
} from '@/lib/twin';
import { TwinAvatar } from '@/components/TwinAvatar';
import { Card, Pill, Button, RingGauge, AreaChart } from '@/components/ui';
import {
  Activity, Brain, Cpu, TrendingUp, Shield, Sparkles, ChevronRight, Loader2,
  FlaskConical, Calendar, AlertTriangle, Check, Info, Zap, HeartPulse, Gauge,
  Moon, Dumbbell, Target, Trophy, Waves, Beaker, Microscope, Orbit, Mountain,
} from 'lucide-react';

type SubView = 'overview' | 'coach' | 'simulator' | 'season' | 'evolution';

export function TwinScreen({ profile }: { profile: Profile }) {
  const [view, setView] = useState<SubView>('overview');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [signals, setSignals] = useState<TwinSignal[]>([]);
  const [state, setState] = useState<TwinModelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(profile.is_premium);

  const load = useCallback(async () => {
    const [w, sig] = await Promise.all([
      supabase.from('workouts').select('*').eq('user_id', profile.id).order('started_at', { ascending: false }).limit(80),
      supabase.from('twin_signals').select('*').eq('user_id', profile.id).order('observed_at', { ascending: false }).limit(30),
    ]);
    const workoutData = (w.data as Workout[]) ?? [];
    const signalData = (sig.data as TwinSignal[]) ?? [];
    setWorkouts(workoutData);
    setSignals(signalData);

    if (workoutData.length) {
      const stats = computeStats(workoutData, profile);
      const twinState = computeTwinModel({ profile, workouts: workoutData, stats, signals: signalData });
      setState(twinState);
      if (signalData.length === 0) {
        await seedDefaultSignals(profile.id, twinState);
        const { data: refreshed } = await supabase.from('twin_signals').select('*').eq('user_id', profile.id).order('observed_at', { ascending: false }).limit(30);
        setSignals((refreshed as TwinSignal[]) ?? []);
      }
      await persistTwinState(profile.id, twinState, workoutData[0]?.started_at ?? null);
    }
    setLoading(false);
  }, [profile.id, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const upgrade = async () => {
    await supabase.from('profiles').update({ is_premium: true, premium_since: new Date().toISOString() }).eq('id', profile.id);
    setIsPremium(true);
  };

  if (loading || !state) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="relative">
          <Orbit className="h-12 w-12 text-brand-500 animate-spin" style={{ animationDuration: '2s' }} />
          <Cpu className="absolute inset-0 m-auto h-5 w-5 text-brand-400" />
        </div>
        <p className="text-sm text-zinc-400">Construyendo tu gemelo digital...</p>
        <p className="text-xs text-zinc-600">Analizando {workouts.length} entrenamientos y {signals.length} señales</p>
      </div>
    );
  }

  // Premium gate: non-premium users see a preview + upgrade prompt
  if (!isPremium) {
    return <TwinPreview state={state} onUpgrade={upgrade} />;
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Premium badge header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-brand-400 to-emerald-400 shadow-lg shadow-brand-500/20">
            <Orbit className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Digital Runner Twin</h1>
            <p className="text-[11px] font-medium text-brand-400">Twin™ · aprende contigo</p>
          </div>
        </div>
        <Pill color="violet"><Sparkles className="h-3 w-3" /> Premium</Pill>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-white/[0.03] p-1 ring-1 ring-white/5 animate-fade-in">
        {([
          ['overview', 'Vital'],
          ['coach', 'Coach IA'],
          ['simulator', 'Simulador'],
          ['season', 'Temporada'],
          ['evolution', 'Evolución'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id as SubView)}
            className={`flex-1 whitespace-nowrap rounded-xl py-2 text-xs font-semibold transition-all ${view === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'overview' && <TwinOverview state={state} />}
      {view === 'coach' && <TwinCoach state={state} profile={profile} workouts={workouts} signals={signals} />}
      {view === 'simulator' && <TwinSimulator state={state} profile={profile} workouts={workouts} signals={signals} />}
      {view === 'season' && <TwinSeasonPlanner state={state} profile={profile} />}
      {view === 'evolution' && <TwinEvolution state={state} profile={profile} workouts={workouts} signals={signals} />}
    </div>
  );
}

// =============================================================================
// PREVIEW — shown to non-premium users
// =============================================================================
function TwinPreview({ state, onUpgrade }: { state: TwinModelState; onUpgrade: () => void }) {
  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-brand-400 to-emerald-400 shadow-lg shadow-brand-500/20">
            <Orbit className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Digital Runner Twin</h1>
            <p className="text-[11px] font-medium text-brand-400">Twin™ · la función estrella</p>
          </div>
        </div>
        <Pill color="amber"><Sparkles className="h-3 w-3" /> Premium</Pill>
      </div>

      {/* Blurred preview of the avatar */}
      <Card className="overflow-hidden p-6">
        <div className="relative flex flex-col items-center">
          <div className="relative blur-sm opacity-60">
            <TwinAvatar state={state} size={200} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/20 ring-1 ring-brand-500/30">
              <Sparkles className="h-6 w-6 text-brand-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* Feature pitch */}
      <Card className="overflow-hidden p-6 ring-1 ring-violet-500/20">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-lg font-bold text-white">Tu gemelo digital con IA</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            El Digital Runner Twin™ aprende continuamente de tus entrenamientos, sueño, HRV y señales fisiológicas.
            Construye un modelo de ti, simula escenarios futuros y toma decisiones como un científico deportivo.
          </p>
          <div className="mt-5 space-y-2.5">
            {[
              { icon: Orbit, text: 'Avatar vivo que refleja tu estado real' },
              { icon: Cpu, text: 'Coach autónomo que decide por ti' },
              { icon: FlaskConical, text: 'Simulador de escenarios "¿qué pasa si...?"' },
              { icon: Calendar, text: 'Planificador de temporadas completas' },
              { icon: TrendingUp, text: 'Mapa de evolución pasado → futuro' },
              { icon: Shield, text: 'Mapa de vulnerabilidad por zonas' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 ring-1 ring-brand-500/20">
                  <f.icon className="h-4 w-4 text-brand-400" />
                </div>
                <span className="text-sm text-zinc-300">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Upgrade CTA */}
      <Card className="overflow-hidden p-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-extrabold text-white">$9.99</span>
          <span className="text-sm text-zinc-400">/mes</span>
        </div>
        <Button onClick={onUpgrade} className="mt-4 w-full bg-gradient-to-r from-violet-500 via-brand-500 to-emerald-500 text-ink-950">
          <Sparkles className="h-4 w-4" /> Desbloquear el Twin
        </Button>
        <p className="mt-3 text-center text-xs text-zinc-500">El activo más valioso de tu entrenamiento</p>
      </Card>
    </div>
  );
}

// =============================================================================
// OVERVIEW — the living avatar + twin vitals
// =============================================================================
function TwinOverview({ state }: { state: TwinModelState }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Living avatar */}
      <Card className="overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
        <div className="relative flex flex-col items-center">
          <TwinAvatar state={state} size={220} />
          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            <VitalMini label="Forma" value={state.fitness} color="#34d399" icon={<TrendingUp className="h-3 w-3" />} />
            <VitalMini label="Fatiga" value={state.fatigue} color="#fbbf24" icon={<Activity className="h-3 w-3" />} />
            <VitalMini label="Recup." value={state.recoveryLevel} color="#22d3ee" icon={<HeartPulse className="h-3 w-3" />} />
          </div>
        </div>
      </Card>

      {/* Confidence + model info */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-bold text-white">Confianza del modelo</span>
          </div>
          <span className="text-lg font-bold text-brand-400">{state.confidence}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-emerald-400 transition-all duration-700" style={{ width: `${state.confidence}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Aprende de {state.trainingAgeDays} días de historial · Modelo Twin™ v1</p>
      </Card>

      {/* Twin vitals grid */}
      <div className="grid grid-cols-2 gap-3">
        <TwinVitalCard icon={<Gauge className="h-4 w-4" />} label="VO2 máx" value={`${state.vo2Max}`} sub="ml/kg/min" color="text-brand-400" />
        <TwinVitalCard icon={<HeartPulse className="h-4 w-4" />} label="FC máx / repo" value={`${state.maxHr}/${state.restingHr}`} sub="bpm" color="text-rose-400" />
        <TwinVitalCard icon={<Activity className="h-4 w-4" />} label="Cap. aeróbica" value={`${state.aerobicCapacity}`} sub="/100" color="text-emerald-400" />
        <TwinVitalCard icon={<Zap className="h-4 w-4" />} label="Cap. anaeróbica" value={`${state.anaerobicCapacity}`} sub="/100" color="text-amber-400" />
        <TwinVitalCard icon={<Waves className="h-4 w-4" />} label="Carga interna" value={`${state.internalLoad}`} sub="/100" color="text-sky-400" />
        <TwinVitalCard icon={<Mountain className="h-4 w-4" />} label="Carga externa" value={`${state.externalLoad}`} sub="/100" color="text-violet-400" />
        <TwinVitalCard icon={<Brain className="h-4 w-4" />} label="Estado mental" value={`${state.mentalState}`} sub="/100" color="text-teal-400" />
        <TwinVitalCard icon={<Sparkles className="h-4 w-4" />} label="Adaptación" value={`${state.adaptationLevel}`} sub="/100" color="text-emerald-400" />
      </div>

      {/* Vulnerability map */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Mapa de vulnerabilidad</h2>
          <Pill color={state.injuryRisk > 50 ? 'rose' : state.injuryRisk > 30 ? 'amber' : 'emerald'}>
            {state.injuryRisk > 50 ? 'Alto' : state.injuryRisk > 30 ? 'Medio' : 'Bajo'} · {state.injuryRisk}%
          </Pill>
        </div>
        <div className="space-y-2.5">
          {Object.entries(state.vulnerability)
            .sort(([, a], [, b]) => b - a)
            .map(([zone, risk]) => (
              <div key={zone}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{zoneLabel(zone)}</span>
                  <span className={`font-semibold ${risk > 50 ? 'text-rose-400' : risk > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>{risk}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${risk > 50 ? 'bg-rose-500' : risk > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${risk}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Zona más vulnerable: <span className="font-semibold text-amber-400">{topVulnerabilityZone(state.vulnerability)}</span> · Modelo bayesiano actualizado con cada entrenamiento
        </p>
      </Card>

      {/* Psychological state */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-violet-400">
            <Brain className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Motivación</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{state.motivation}<span className="text-sm text-zinc-500">/100</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Prob. abandono</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{state.dropoutProbability}<span className="text-sm text-zinc-500">%</span></div>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// COACH — autonomous data-driven decisions
// =============================================================================
function TwinCoach({ state, profile, workouts, signals }: { state: TwinModelState; profile: Profile; workouts: Workout[]; signals: TwinSignal[] }) {
  const [decisions, setDecisions] = useState<CoachDecision[]>([]);

  useEffect(() => {
    const stats = computeStats(workouts, profile);
    setDecisions(generateCoachDecisions(state, { profile, workouts, stats, signals }));
  }, [state, profile, workouts, signals]);

  const severityStyle = (s: CoachDecision['severity']) => ({
    critical: { ring: 'ring-rose-500/30', bg: 'bg-rose-500/5', icon: AlertTriangle, color: 'text-rose-400' },
    warning: { ring: 'ring-amber-500/30', bg: 'bg-amber-500/5', icon: AlertTriangle, color: 'text-amber-400' },
    caution: { ring: 'ring-sky-500/30', bg: 'bg-sky-500/5', icon: Info, color: 'text-sky-400' },
    info: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/5', icon: Check, color: 'text-emerald-400' },
  }[s]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-brand-400" />
        <p className="text-sm text-zinc-400">El gemelo analiza tus datos y <span className="text-white font-semibold">toma decisiones automáticamente</span>. Cada recomendación explica por qué.</p>
      </div>

      {decisions.map((d, i) => {
        const st = severityStyle(d.severity);
        const Icon = st.icon;
        return (
          <Card key={i} className={`overflow-hidden ${st.ring} ring-1 animate-slide-up`} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className={`${st.bg} p-5`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${st.bg} ${st.color} ring-1 ${st.ring}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{d.action}</h3>
                    <Pill color={d.confidence > 70 ? 'emerald' : d.confidence > 50 ? 'amber' : 'zinc'}>{d.confidence}% confianza</Pill>
                  </div>
                  <p className={`mt-1.5 text-base font-semibold ${st.color}`}>{d.directive}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 p-5">
              <div className="mb-3 flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Por qué · explicabilidad</span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">{d.rationale}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {d.evidence.map((e) => (
                  <div key={e.label} className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-600">{e.label}</div>
                    <div className="text-sm font-bold text-white">{e.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}

      {decisions.length === 0 && (
        <Card className="p-8 text-center">
          <Check className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <p className="text-sm text-zinc-300">Todo en orden. El gemelo no detecta alertas.</p>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// SIMULATOR — what-if scenario projections
// =============================================================================
function TwinSimulator({ state, profile, workouts, signals }: { state: TwinModelState; profile: Profile; workouts: Workout[]; signals: TwinSignal[] }) {
  const [question, setQuestion] = useState('');
  const [projection, setProjection] = useState<ScenarioProjection | null>(null);
  const [busy, setBusy] = useState(false);

  const presets = [
    '¿Qué pasa si entreno 5 días por semana?',
    '¿Qué pasa si bajo 5 kg?',
    '¿Qué pasa si hago fuerza dos veces por semana?',
    '¿Qué pasa si descanso dos días?',
    '¿Qué pasa si preparo un maratón en 16 semanas?',
    '¿Qué pasa si aumento 10 km semanales?',
    '¿Qué pasa si dejo de entrenar un mes?',
    '¿Qué pasa si cambio mis zapatillas?',
    '¿Qué pasa si corro en altura?',
    '¿Qué pasa si entreno únicamente en trail?',
  ];

  const run = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setProjection(null);
    await new Promise((r) => setTimeout(r, 900)); // simulate model compute
    const stats = computeStats(workouts, profile);
    const result = simulateScenario(q, state, { profile, workouts, stats, signals });
    setProjection(result);
    // persist scenario
    await supabase.from('twin_scenarios').insert({
      user_id: profile.id,
      question: q,
      scenario_type: result.title,
      parameters: { question: q },
      projection: {
        timeline: result.timeline,
        predicted: { p5k: result.predicted5k, p10k: result.predicted10k, pHalf: result.predictedHalf, pFull: result.predictedFull },
        successProbability: result.successProbability,
        risks: result.risks,
      },
      explanation: result.explanation,
      confidence: result.confidence,
    });
    setBusy(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Beaker className="h-4 w-4 text-brand-400" />
        <p className="text-sm text-zinc-400">El gemelo <span className="text-white font-semibold">simula tu futuro</span> según distintos escenarios. No responde con texto genérico: proyecta datos.</p>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10 focus-within:ring-brand-500/40">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(question); }}
          placeholder="¿Qué pasa si...?"
          className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          onClick={() => run(question)}
          disabled={busy || !question.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-ink-950 transition-all hover:bg-brand-400 active:scale-95 disabled:opacity-30"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => { setQuestion(p); run(p); }}
            disabled={busy}
            className="rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/5 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Results */}
      {busy && (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Orbit className="h-10 w-10 text-brand-500 animate-spin" style={{ animationDuration: '1.5s' }} />
              <Cpu className="absolute inset-0 m-auto h-4 w-4 text-brand-400" />
            </div>
            <p className="text-sm text-zinc-400">Simulando escenario...</p>
            <p className="text-xs text-zinc-600">Modelo bayesiano proyectando {state.trainingAgeDays} días de datos</p>
          </div>
        </Card>
      )}

      {projection && !busy && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <Card className="overflow-hidden p-5 ring-1 ring-brand-500/20">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-brand-400" />
              <h2 className="text-base font-bold text-white">{projection.title}</h2>
              <Pill color="brand">{projection.confidence}% confianza</Pill>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{projection.summary}</p>
          </Card>

          {/* Success probability */}
          <Card className="flex items-center gap-5 p-5">
            <RingGauge value={projection.successProbability} size={100} stroke={9} color="#34d399" label={`${projection.successProbability}%`} sublabel="Éxito">
              <span className="text-2xl font-extrabold text-emerald-400">{projection.successProbability}%</span>
              <span className="text-[9px] uppercase text-zinc-500">prob. éxito</span>
            </RingGauge>
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-bold text-white">Proyección de éxito</h3>
              {projection.risks.map((r) => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{r.label}</span>
                  <Pill color={r.level === 'low' ? 'emerald' : r.level === 'medium' ? 'amber' : 'rose'}>
                    {r.level === 'low' ? 'Bajo' : r.level === 'medium' ? 'Medio' : 'Alto'}
                  </Pill>
                </div>
              ))}
            </div>
          </Card>

          {/* Timeline chart */}
          <Card className="p-5">
            <h3 className="mb-1 text-sm font-bold text-white">Evolución proyectada</h3>
            <p className="mb-4 text-xs text-zinc-500">Fitness · riesgo · VO2 máx a lo largo del tiempo</p>
            <AreaChart data={projection.timeline.map((t) => t.fitness)} height={90} color="#22d3ee" />
            <div className="mt-2 flex justify-between text-xs text-zinc-600">
              {projection.timeline.map((t) => (
                <span key={t.week}>{t.label}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {projection.timeline.slice(-1)[0] && (
                <>
                  <ProjStat label="Fitness final" value={projection.timeline.slice(-1)[0].fitness} color="text-emerald-400" />
                  <ProjStat label="VO2 final" value={projection.timeline.slice(-1)[0].vo2} color="text-brand-400" />
                  <ProjStat label="Riesgo final" value={`${projection.timeline.slice(-1)[0].risk}%`} color="text-amber-400" />
                </>
              )}
            </div>
          </Card>

          {/* Predicted times */}
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-white">Tiempos proyectados tras el escenario</h3>
            <div className="grid grid-cols-2 gap-3">
              <ProjTime label="5K" time={formatRaceTime(projection.predicted5k)} />
              <ProjTime label="10K" time={formatRaceTime(projection.predicted10k)} />
              <ProjTime label="Media" time={formatRaceTime(projection.predictedHalf)} />
              <ProjTime label="Maratón" time={formatRaceTime(projection.predictedFull)} />
            </div>
          </Card>

          {/* Explainability */}
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Microscope className="h-4 w-4 text-zinc-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cómo se calculó</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">{projection.explanation}</p>
          </Card>
        </div>
      )}

      {!projection && !busy && (
        <Card className="p-8 text-center">
          <FlaskConical className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <p className="text-sm text-zinc-400">Selecciona un escenario o escribe tu propia pregunta para ver la proyección.</p>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// SEASON PLANNER — full macro/meso/microcycle planning
// =============================================================================
function TwinSeasonPlanner({ state, profile }: { state: TwinModelState; profile: Profile }) {
  const [targetRace, setTargetRace] = useState('Maratón de Berlín');
  const [goalDistance, setGoalDistance] = useState('42k');
  const [raceDate, setRaceDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [season, setSeason] = useState<ReturnType<typeof generateSeason> | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedSeasons, setSavedSeasons] = useState<TwinSeason[]>([]);

  useEffect(() => {
    // default race date ~16 weeks out
    const d = new Date(); d.setDate(d.getDate() + 16 * 7);
    setRaceDate(d.toISOString().slice(0, 10));
    loadSeasons();
  }, []);

  const loadSeasons = async () => {
    const { data } = await supabase.from('twin_seasons').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setSavedSeasons((data as TwinSeason[]) ?? []);
  };

  const generate = async () => {
    if (!raceDate) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    const targetTimeSec = goalDistance === '42k' && targetTime ? parseTimeToSec(targetTime) : undefined;
    const result = generateSeason({ profile, state, targetRace, goalDistance, raceDate, targetTimeSec });
    setSeason(result);
    setBusy(false);
  };

  const save = async () => {
    if (!season) return;
    await supabase.from('twin_seasons').insert({
      user_id: profile.id,
      name: season.name,
      target_race: season.targetRace,
      goal_distance: season.goalDistance,
      target_time_sec: season.targetTimeSec,
      start_date: season.startDate,
      race_date: season.raceDate,
      weeks: season.weeks,
      status: 'active',
      macrocycles: season.macrocycles,
      success_probability: season.successProbability,
      risk_factors: season.riskFactors,
      peak_form_date: season.peakFormDate,
    });
    await loadSeasons();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-brand-400" />
        <p className="text-sm text-zinc-400">El gemelo genera <span className="text-white font-semibold">temporadas completas</span>: macrociclos, mesociclos, picos de forma y riesgos.</p>
      </div>

      {/* Config */}
      <Card className="space-y-3 p-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Carrera objetivo</label>
          <input value={targetRace} onChange={(e) => setTargetRace(e.target.value)} placeholder="Ej. Maratón de Berlín" className="w-full rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-500/40" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Distancia</label>
            <select value={goalDistance} onChange={(e) => setGoalDistance(e.target.value)} className="w-full rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-500/40">
              {['5k', '10k', '21k', '42k', 'ultra'].map((d) => (
                <option key={d} value={d} className="bg-ink-850">{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Fecha carrera</label>
            <input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} className="w-full rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-500/40" />
          </div>
        </div>
        {goalDistance === '42k' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">Tiempo objetivo (opcional)</label>
            <input value={targetTime} onChange={(e) => setTargetTime(e.target.value)} placeholder="Ej. 3:45:00" className="w-full rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-brand-500/40" />
          </div>
        )}
        <Button onClick={generate} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generar temporada
        </Button>
      </Card>

      {season && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <Card className="overflow-hidden p-5 ring-1 ring-brand-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">{season.name}</h2>
                <p className="text-xs text-zinc-500">{season.weeks} semanas · {season.targetRace}</p>
              </div>
              <RingGauge value={season.successProbability} size={70} stroke={7} color="#34d399">
                <span className="text-sm font-extrabold text-emerald-400">{season.successProbability}%</span>
              </RingGauge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {season.riskFactors.map((r) => (
                <Pill key={r.label} color={r.level === 'low' ? 'emerald' : r.level === 'medium' ? 'amber' : 'rose'}>
                  {r.label}: {r.level === 'low' ? 'bajo' : r.level === 'medium' ? 'medio' : 'alto'}
                </Pill>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-brand-500/10 px-3 py-2 text-xs text-brand-400">
              Pico de forma estimado: <span className="font-bold">{new Date(season.peakFormDate).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</span>
            </div>
            <Button variant="secondary" onClick={save} className="mt-4 w-full">
              <Check className="h-4 w-4" /> Guardar temporada
            </Button>
          </Card>

          {/* Macrocycles */}
          {season.macrocycles.map((m, i) => (
            <Card key={i} className="p-5 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20">
                  <span className="text-sm font-bold">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white">{m.name}</h3>
                  <p className="text-xs text-zinc-500">{m.weeks} semanas · {m.phase}</p>
                </div>
                <Pill color={m.risk === 'Bajo' ? 'emerald' : m.risk === 'Medio' ? 'amber' : 'rose'}>{m.risk}</Pill>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <SeasonRow label="Foco" value={m.focus} />
                <SeasonRow label="Volumen" value={m.volume} />
                <SeasonRow label="Intensidad" value={m.intensity} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Saved seasons */}
      {savedSeasons.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-white">Temporadas guardadas</h3>
          <div className="space-y-2">
            {savedSeasons.map((s) => (
              <Card key={s.id} className="flex items-center gap-3 p-4">
                <Trophy className="h-5 w-5 text-amber-400" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{s.name}</div>
                  <div className="text-xs text-zinc-500">{s.weeks} sem · {s.success_probability}% éxito</div>
                </div>
                <Pill color={s.status === 'active' ? 'emerald' : 'zinc'}>{s.status === 'active' ? 'Activa' : s.status}</Pill>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EVOLUTION — past → present → future timeline
// =============================================================================
function TwinEvolution({ state, profile, workouts, signals }: { state: TwinModelState; profile: Profile; workouts: Workout[]; signals: TwinSignal[] }) {
  const [points, setPoints] = useState<EvolutionPoint[]>([]);
  const [predictions, setPredictions] = useState<PredictionSet[]>([]);

  useEffect(() => {
    const stats = computeStats(workouts, profile);
    setPoints(computeEvolution(state, { profile, workouts, stats, signals }));
    setPredictions(computePredictions(state, stats));
  }, [state, profile, workouts, signals]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <p className="text-sm text-zinc-400">El gemelo proyecta <span className="text-white font-semibold">cómo eras, cómo eres y cómo serás</span> — siempre con probabilidades.</p>
      </div>

      {/* Evolution timeline */}
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-bold text-white">Línea de evolución</h3>
        <p className="mb-4 text-xs text-zinc-500">Fitness · VO2 máx · predicción 10K</p>
        <AreaChart data={points.map((p) => p.fitness)} height={100} color="#22d3ee" />
        <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
          {points.map((p) => <span key={p.label}>{p.label}</span>)}
        </div>
      </Card>

      {/* Evolution cards */}
      <div className="space-y-3">
        {points.map((p, i) => (
          <Card key={p.label} className={`p-5 animate-slide-up ${p.isPast ? 'opacity-70' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.isPast ? 'bg-zinc-500/10 text-zinc-400' : 'bg-brand-500/10 text-brand-400'} ring-1 ${p.isPast ? 'ring-zinc-500/20' : 'ring-brand-500/20'}`}>
                  {p.isPast ? <Moon className="h-5 w-5" /> : i === 1 ? <Target className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{p.label}</h3>
                  <p className="text-xs text-zinc-500">{new Date(p.date).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <Pill color={p.confidence > 60 ? 'emerald' : p.confidence > 40 ? 'amber' : 'zinc'}>{p.confidence}%</Pill>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <EvoStat label="Fitness" value={p.fitness} />
              <EvoStat label="VO2 máx" value={p.vo2} />
              <EvoStat label="10K" value={formatRaceTime(p.predicted10k)} />
            </div>
          </Card>
        ))}
      </div>

      {/* Performance predictions with confidence */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Predicción de rendimiento</h3>
        </div>
        <div className="space-y-3">
          {predictions.map((p) => (
            <div key={p.distance} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{p.label}</span>
                <Pill color={p.confidence > 60 ? 'emerald' : p.confidence > 40 ? 'amber' : 'zinc'}>{p.confidence}%</Pill>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-500/70">Mejor</div>
                  <div className="text-sm font-bold text-emerald-400">{formatRaceTime(p.bestCase)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-400/70">Esperado</div>
                  <div className="text-base font-extrabold text-brand-400">{formatRaceTime(p.expectedCase)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-rose-500/70">Peor</div>
                  <div className="text-sm font-bold text-rose-400">{formatRaceTime(p.worstCase)}</div>
                </div>
              </div>
              {/* confidence bar */}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400" style={{ width: `${p.confidence}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// =============================================================================
// Shared sub-components
// =============================================================================
function TwinVitalCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-500">{sub}</div>
    </Card>
  );
}

function VitalMini({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 text-center ring-1 ring-white/5">
      <div className={`flex items-center justify-center gap-1 ${color}`}>{icon}<span className="text-[10px] font-medium uppercase">{label}</span></div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function ProjStat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 text-center ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ProjTime({ label, time }: { label: string; time: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 text-center ring-1 ring-white/5">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold text-white">{time}</div>
    </div>
  );
}

function EvoStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 text-center ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function SeasonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

function parseTimeToSec(t: string): number {
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// Seed initial physiological signals so the twin has richer data from the start
async function seedDefaultSignals(userId: string, state: TwinModelState): Promise<void> {
  const rows: Omit<TwinSignal, 'id' | 'user_id'>[] = [];
  for (let d = 0; d < 14; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const variability = Math.sin(d * 0.7) * 15;
    rows.push({
      observed_at: date.toISOString().slice(0, 10),
      hrv: Math.round((42 + variability) * 10) / 10,
      sleep_hours: Math.round((7.2 + Math.cos(d * 0.5) * 1) * 10) / 10,
      sleep_quality: Math.round(72 + variability * 0.5),
      stress: Math.round(35 + Math.sin(d * 0.9) * 15),
      resting_hr: Math.round(state.restingHr + Math.sin(d * 0.6) * 4),
      body_weight_kg: null,
      temperature_c: 18,
      humidity_pct: 55,
      altitude_m: 0,
      terrain: d % 3 === 0 ? 'trail' : 'asfalto',
      shoe_id: 'default',
      daily_load: Math.round(state.externalLoad * 0.8 + variability),
      daily_intensity: Math.round((0.6 + Math.sin(d) * 0.2) * 100) / 100,
      recovery_signal: Math.round(state.recoveryLevel + variability * 0.4),
      mood: Math.round(state.mentalState + variability * 0.3),
      notes: null,
    });
  }
  await supabase.from('twin_signals').insert(rows.map((r) => ({ ...r, user_id: userId })));
}
