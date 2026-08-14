import type { Workout, Profile } from './supabase';

export type ComputedStats = {
  fitness: number; // CTL
  fatigue: number; // ATL
  recovery: number; // form = CTL - ATL normalized 0-100
  trainingLoad: number;
  vo2Max: number;
  fatigueScore: number; // 0-100 (higher = more fatigued)
  recoveryScore: number; // 0-100 (higher = more recovered)
  injuryRisk: 'low' | 'medium' | 'high';
  injuryRiskScore: number; // 0-100
  totalDistanceKm: number;
  totalWorkouts: number;
  weeklyDistanceKm: number;
  avgPaceSecPerKm: number | null;
  predicted5k: number | null;
  predicted10k: number | null;
  predictedHalf: number | null;
  predictedFull: number | null;
  progressPct: number;
  weeklyTss: number[];
  recentWorkouts: Workout[];
};

// Estimate training stress score per workout (simplified Riegel-based intensity)
function workoutTss(w: Workout, profile: Profile | null): number {
  if (w.duration_sec <= 0) return 0;
  const hours = w.duration_sec / 3600;
  // intensity factor from effort or heart rate
  let intensity = 0.7;
  if (w.effort && w.effort > 0) {
    intensity = 0.5 + (w.effort / 10) * 0.6; // 0.5 - 1.1
  } else if (w.avg_heart_rate && profile && profile.age) {
    const maxHr = 208 - 0.7 * profile.age;
    const ratio = w.avg_heart_rate / maxHr;
    intensity = Math.min(1.2, Math.max(0.4, (ratio - 0.4) / 0.5));
  }
  return Math.round(hours * 100 * intensity * intensity);
}

// Riegel race time prediction from a recent benchmark
function riegelPredict(benchmarkSec: number, benchmarkKm: number, targetKm: number): number {
  const fatigueFactor = 1.06;
  const time = benchmarkSec * Math.pow(targetKm / benchmarkKm, fatigueFactor);
  return Math.round(time);
}

export function computeStats(workouts: Workout[], profile: Profile | null): ComputedStats {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  const now = Date.now();
  const last42 = sorted.filter((w) => now - new Date(w.started_at).getTime() <= 42 * 86400000);
  const last7 = sorted.filter((w) => now - new Date(w.started_at).getTime() <= 7 * 86400000);
  const last28 = sorted.filter((w) => now - new Date(w.started_at).getTime() <= 28 * 86400000);

  // CTL = avg daily TSS over 42 days; ATL = avg daily TSS over 7 days
  const tss42 = last42.map((w) => workoutTss(w, profile));
  const tss7 = last7.map((w) => workoutTss(w, profile));
  const ctl = tss42.length ? tss42.reduce((s, t) => s + t, 0) / 42 : 0;
  const atl = tss7.length ? tss7.reduce((s, t) => s + t, 0) / 7 : 0;

  // form / recovery from TSB = CTL - ATL
  const tsb = ctl - atl;
  const recoveryRaw = 50 + (tsb / Math.max(ctl + atl, 20)) * 100;
  const recoveryScore = Math.round(Math.min(100, Math.max(0, recoveryRaw)));

  const fitness = Math.round(ctl);
  const fatigue = Math.round(atl);
  const fatigueScore = Math.round(Math.min(100, (atl / Math.max(ctl + 5, 10)) * 60 + atl * 0.4));

  const totalDistanceKm = sorted.reduce((s, w) => s + w.distance_km, 0);
  const weeklyDistanceKm = last7.reduce((s, w) => s + w.distance_km, 0);

  // VO2 max estimate via distance/time (very simplified Jack Daniels proxy)
  let vo2Max = 40;
  if (last28.length && profile) {
    const recent = last28.filter((w) => w.distance_km >= 3 && w.duration_sec > 0);
    if (recent.length) {
      const best = recent.reduce((b, w) => {
        const speed = w.distance_km / (w.duration_sec / 3600);
        return speed > (b.distance_km / (b.duration_sec / 3600)) ? w : b;
      });
      const speedMs = (best.distance_km * 1000) / best.duration_sec;
      const vo2 = 0.000104 * Math.pow(speedMs, 2) + 0.182258 * speedMs + 3.9;
      const pct = best.duration_sec < 1800 ? 0.9 : best.duration_sec < 3600 ? 0.92 : 0.94;
      vo2Max = Math.round((vo2 / pct) * (profile.sex === 'female' ? 1 : 1));
    }
  }

  // Injury risk: rapid load increase + high fatigue
  const week1 = tss7.reduce((s, t) => s + t, 0);
  const prev7 = sorted.filter(
    (w) =>
      now - new Date(w.started_at).getTime() > 7 * 86400000 &&
      now - new Date(w.started_at).getTime() <= 14 * 86400000,
  );
  const week2 = prev7.reduce((s, w) => s + workoutTss(w, profile), 0);
  const loadRatio = week2 > 0 ? week1 / week2 : week1 > 0 ? 1.5 : 0;
  let injuryScore = Math.round((Math.max(0, loadRatio - 1) * 45) + (fatigueScore * 0.4));
  injuryScore = Math.min(100, Math.max(0, injuryScore));
  const injuryRisk: 'low' | 'medium' | 'high' =
    injuryScore >= 60 ? 'high' : injuryScore >= 30 ? 'medium' : 'low';

  // Predictions from best recent effort
  let predicted5k: number | null = null;
  let predicted10k: number | null = null;
  let predictedHalf: number | null = null;
  let predictedFull: number | null = null;
  const benchmark = last28
    .filter((w) => w.distance_km >= 1 && w.duration_sec > 0 && (w.effort ?? 5) >= 6)
    .sort((a, b) => b.distance_km - a.distance_km)[0];
  if (benchmark) {
    const paceSec = benchmark.avg_pace_sec_per_km ?? benchmark.duration_sec / benchmark.distance_km;
    predicted5k = riegelPredict(paceSec * benchmark.distance_km, benchmark.distance_km, 5);
    predicted10k = riegelPredict(paceSec * benchmark.distance_km, benchmark.distance_km, 10);
    predictedHalf = riegelPredict(paceSec * benchmark.distance_km, benchmark.distance_km, 21.0975);
    predictedFull = riegelPredict(paceSec * benchmark.distance_km, benchmark.distance_km, 42.195);
  } else if (last28.length) {
    const easy = last28[last28.length - 1];
    const paceSec = easy.avg_pace_sec_per_km ?? easy.duration_sec / easy.distance_km;
    predicted5k = riegelPredict(paceSec * easy.distance_km, easy.distance_km, 5);
    predicted10k = riegelPredict(paceSec * easy.distance_km, easy.distance_km, 10);
    predictedHalf = riegelPredict(paceSec * easy.distance_km, easy.distance_km, 21.0975);
    predictedFull = riegelPredict(paceSec * easy.distance_km, easy.distance_km, 42.195);
  }

  // Progress: compare avg pace last 7 days vs 21-28 days ago
  let progressPct = 0;
  const recent7Pace = avgPace(last7);
  const old7 = sorted.filter(
    (w) =>
      now - new Date(w.started_at).getTime() > 21 * 86400000 &&
      now - new Date(w.started_at).getTime() <= 28 * 86400000,
  );
  const old7Pace = avgPace(old7);
  if (recent7Pace && old7Pace && old7Pace > 0) {
    progressPct = Math.round(((old7Pace - recent7Pace) / old7Pace) * 1000) / 10;
  }

  // weekly TSS series for last 8 weeks
  const weeklyTss: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400000;
    const end = now - i * 7 * 86400000;
    const wk = sorted.filter((w) => {
      const t = new Date(w.started_at).getTime();
      return t > start && t <= end;
    });
    weeklyTss.push(wk.reduce((s, w) => s + workoutTss(w, profile), 0));
  }

  const allPace = avgPace(sorted);
  return {
    fitness,
    fatigue,
    recovery: recoveryScore,
    trainingLoad: Math.round(week1),
    vo2Max,
    fatigueScore,
    recoveryScore,
    injuryRisk,
    injuryRiskScore: injuryScore,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalWorkouts: sorted.length,
    weeklyDistanceKm: Math.round(weeklyDistanceKm * 10) / 10,
    avgPaceSecPerKm: allPace,
    predicted5k,
    predicted10k,
    predictedHalf,
    predictedFull,
    progressPct,
    weeklyTss,
    recentWorkouts: [...sorted].reverse().slice(0, 6),
  };
}

function avgPace(workouts: Workout[]): number | null {
  const valid = workouts.filter((w) => w.distance_km > 0 && w.duration_sec > 0);
  if (!valid.length) return null;
  const totalSec = valid.reduce((s, w) => s + w.duration_sec, 0);
  const totalKm = valid.reduce((s, w) => s + w.distance_km, 0);
  return totalKm > 0 ? Math.round(totalSec / totalKm) : null;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return '--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatRaceTime(sec: number | null): string {
  if (!sec || sec <= 0) return '--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
