import type { Profile, PlanSession, GoalType } from './supabase';
import type { ComputedStats } from './metrics';
import { formatPace } from './metrics';

export type GeneratedSession = {
  day_of_week: number;
  date: string;
  session_type: string;
  title: string;
  description: string;
  distance_km: number | null;
  duration_min: number | null;
  target_pace_sec_per_km: number | null;
  intensity: string;
};

export type GeneratedPlan = {
  name: string;
  weeks: number;
  goal: GoalType;
  target_time_sec: number | null;
  sessions: GeneratedSession[];
};

const goalTargets: Record<GoalType, { weeks: number; basePace: number; longRunMax: number }> = {
  '5k': { weeks: 8, basePace: 300, longRunMax: 10 },
  '10k': { weeks: 10, basePace: 330, longRunMax: 16 },
  half_marathon: { weeks: 12, basePace: 360, longRunMax: 24 },
  marathon: { weeks: 16, basePace: 390, longRunMax: 32 },
  ultramarathon: { weeks: 20, basePace: 420, longRunMax: 50 },
  weight_loss: { weeks: 12, basePace: 420, longRunMax: 14 },
  endurance: { weeks: 12, basePace: 390, longRunMax: 22 },
};

const goalNames: Record<GoalType, string> = {
  '5k': '5K',
  '10k': '10K',
  half_marathon: 'Media Maratón',
  marathon: 'Maratón',
  ultramarathon: 'Ultramaratón',
  weight_loss: 'Pérdida de peso',
  endurance: 'Resistencia',
};

export function generatePlan(profile: Profile, stats: ComputedStats): GeneratedPlan {
  const goal = profile.goal ?? '10k';
  const cfg = goalTargets[goal];
  const weeks = cfg.weeks;
  const currentPace = stats.avgPaceSecPerKm ?? cfg.basePace;
  // Adjust pace by experience
  const paceOffset =
    profile.experience === 'beginner' ? 60 :
    profile.experience === 'intermediate' ? 30 :
    profile.experience === 'advanced' ? 0 : -15;
  const basePace = Math.max(currentPace, cfg.basePace) + paceOffset;

  const sessions: GeneratedSession[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let w = 1; w <= weeks; w++) {
    const progress = (w - 1) / weeks; // 0..1
    // Weekly structure: Mon easy, Tue intervals, Wed rest, Thu tempo, Fri rest, Sat long, Sun recovery
    const longDist = Math.round((8 + progress * (cfg.longRunMax - 8)) * 10) / 10;
    const intervalPace = basePace - 30;
    const tempoPace = basePace - 10;
    const easyPace = basePace + 45;
    const recoveryPace = basePace + 70;

    const weekOffset = (w - 1) * 7;
    const sessionDefs = [
      { dow: 1, type: 'easy', title: 'Rodaje suave', dist: Math.round((5 + progress * 3) * 10) / 10, pace: easyPace, min: 35, intensity: 'easy', desc: 'Trote continuo en zona 2, mantener conversación. Cadencia 178-182.' },
      { dow: 2, type: 'intervals', title: w % 2 === 0 ? 'Series largas' : 'Series cortas', dist: null, pace: intervalPace, min: 50, intensity: 'vo2max', desc: w % 2 === 0 ? '5 × 1000m a ritmo 5K con 90s recuperación. 15 min calentamiento + 10 min enfriamiento.' : '8 × 400m a ritmo 5K-3K con 60s recuperación. 15 min calentamiento + 10 min enfriamiento.' },
      { dow: 3, type: 'rest', title: 'Descanso o fuerza', dist: null, pace: null, min: 30, intensity: 'rest', desc: 'Sesión de fuerza core/glúteos 20-30 min, o descanso completo. Movilidad 10 min.' },
      { dow: 4, type: 'tempo', title: 'Tempo continuo', dist: Math.round((6 + progress * 4) * 10) / 10, pace: tempoPace, min: 45, intensity: 'threshold', desc: '15 min calentamiento + 20-25 min a ritmo umbral + 10 min enfriamiento. Ritto de carrera.' },
      { dow: 5, type: 'rest', title: 'Descanso', dist: null, pace: null, min: 0, intensity: 'rest', desc: 'Día de descanso. Hidratación y sueño prioritarios.' },
      { dow: 6, type: 'long', title: 'Tiro largo', dist: longDist, pace: easyPace - 10, min: Math.round(longDist * 6.5), intensity: 'easy', desc: `${longDist}km a ritmo cómodo. Practica hidratación cada 20 min. Últimos 2km progresivos si te sientes fuerte.` },
      { dow: 0, type: 'recovery', title: 'Recuperación activa', dist: Math.round((4 + progress * 2) * 10) / 10, pace: recoveryPace, min: 30, intensity: 'recovery', desc: 'Trote muy suave zona 1, bajísimo impacto. Alternar con caminata. Estiramientos después.' },
    ];

    for (const def of sessionDefs) {
      const date = new Date(today);
      date.setDate(today.getDate() + weekOffset + ((def.dow - today.getDay() + 7) % 7));
      sessions.push({
        day_of_week: def.dow,
        date: date.toISOString().slice(0, 10),
        session_type: def.type,
        title: def.title,
        description: def.desc,
        distance_km: def.dist,
        duration_min: def.min > 0 ? def.min : null,
        target_pace_sec_per_km: def.pace,
        intensity: def.intensity,
      });
    }
  }

  return {
    name: `Plan ${goalNames[goal]} ${weeks} semanas`,
    weeks,
    goal,
    target_time_sec: goal === '10k' ? 3000 : goal === '5k' ? 1500 : goal === 'half_marathon' ? 6300 : null,
    sessions,
  };
}

export function sessionColor(type: string): { bg: string; text: string; ring: string } {
  const map: Record<string, { bg: string; text: string; ring: string }> = {
    easy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    intervals: { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/30' },
    tempo: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/30' },
    long: { bg: 'bg-sky-500/10', text: 'text-sky-400', ring: 'ring-sky-500/30' },
    recovery: { bg: 'bg-teal-500/10', text: 'text-teal-400', ring: 'ring-teal-500/30' },
    rest: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', ring: 'ring-zinc-500/30' },
    strength: { bg: 'bg-violet-500/10', text: 'text-violet-400', ring: 'ring-violet-500/30' },
  };
  return map[type] ?? map.easy;
}

export function sessionIcon(type: string): string {
  const map: Record<string, string> = {
    easy: 'Wind',
    intervals: 'Zap',
    tempo: 'Gauge',
    long: 'Mountain',
    recovery: 'HeartPulse',
    rest: 'Moon',
    strength: 'Dumbbell',
  };
  return map[type] ?? 'Activity';
}

export { formatPace };
