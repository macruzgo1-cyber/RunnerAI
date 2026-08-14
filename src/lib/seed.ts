import { supabase, type Workout, type GoalType } from './supabase';
import type { ComputedStats } from './metrics';
import { computeStats } from './metrics';
import { generatePlan } from './planner';
import type { Profile } from './supabase';

// Generates realistic seeded workout history and an initial plan so the app
// feels alive immediately after onboarding. Uses deterministic-ish randomness.
export async function seedUserData(profile: Profile): Promise<{ stats: ComputedStats }> {
  const workouts = generateWorkoutHistory(profile);
  const { error } = await supabase.from('workouts').insert(
    workouts.map((w) => ({ ...w, user_id: profile.id })),
  );
  if (error) {
    console.warn('seed workouts error', error.message);
  }

  const stats = computeStats(workouts as Workout[], profile);
  await persistStats(profile.id, stats);

  // Generate and persist an initial plan
  const plan = generatePlan(profile, stats);
  const { data: planRow, error: planErr } = await supabase
    .from('training_plans')
    .insert({
      user_id: profile.id,
      name: plan.name,
      goal: plan.goal,
      target_race_date: null,
      target_time_sec: plan.target_time_sec,
      weeks: plan.weeks,
      status: 'active',
      current_week: 1,
    })
    .select()
    .single();
  if (!planErr && planRow) {
    await supabase.from('plan_sessions').insert(
      plan.sessions.map((s) => ({
        plan_id: planRow.id,
        user_id: profile.id,
        week_number: 1 + Math.floor(plan.sessions.indexOf(s) / 7),
        day_of_week: s.day_of_week,
        date: s.date,
        session_type: s.session_type,
        title: s.title,
        description: s.description,
        distance_km: s.distance_km,
        duration_min: s.duration_min,
        target_pace_sec_per_km: s.target_pace_sec_per_km,
        intensity: s.intensity,
        status: 'pending',
      })),
    );
  }

  // Seed achievements + notifications
  await seedAchievements(profile.id, stats);
  await seedNotifications(profile.id, stats);

  return { stats };
}

export async function persistStats(userId: string, stats: ComputedStats): Promise<void> {
  const payload = {
    user_id: userId,
    fitness: stats.fitness,
    fatigue: stats.fatigue,
    recovery: stats.recovery,
    training_load: stats.trainingLoad,
    vo2_max: stats.vo2Max,
    fatigue_score: stats.fatigueScore,
    recovery_score: stats.recoveryScore,
    injury_risk: stats.injuryRisk,
    injury_risk_score: stats.injuryRiskScore,
    total_distance_km: stats.totalDistanceKm,
    total_workouts: stats.totalWorkouts,
    weekly_distance_km: stats.weeklyDistanceKm,
    avg_pace_sec_per_km: stats.avgPaceSecPerKm,
    predicted_5k_sec: stats.predicted5k,
    predicted_10k_sec: stats.predicted10k,
    predicted_half_sec: stats.predictedHalf,
    predicted_full_sec: stats.predictedFull,
    progress_pct: stats.progressPct,
  };
  const { error } = await supabase.from('user_stats').upsert(payload, { onConflict: 'user_id' });
  if (error) console.warn('persist stats error', error.message);
}

function generateWorkoutHistory(profile: Profile): Omit<Workout, 'id' | 'user_id'>[] {
  const workouts: Omit<Workout, 'id' | 'user_id'>[] = [];
  const basePace =
    profile.experience === 'beginner' ? 390 :
    profile.experience === 'intermediate' ? 345 :
    profile.experience === 'advanced' ? 300 : 270;

  const now = Date.now();
  // 9 weeks of history, ~4-5 workouts/week
  for (let d = 63; d >= 0; d--) {
    const dow = new Date(now - d * 86400000).getDay();
    const isRunDay = [1, 2, 4, 6, 0].includes(dow);
    if (!isRunDay) continue;
    // Random skip ~10%
    if (pseudoRandom(d) < 0.1) continue;

    const isLong = dow === 6;
    const isIntervals = dow === 2;
    const isTempo = dow === 4;
    const isRecovery = dow === 0;
    const isEasy = dow === 1;

    let distance = 6;
    let pace = basePace + 40;
    let effort = 4;
    let duration = 30 * 60;

    if (isLong) {
      distance = 10 + Math.round(pseudoRandom(d + 1) * 8);
      pace = basePace + 60;
      effort = 5;
    } else if (isIntervals) {
      distance = 8;
      pace = basePace - 20;
      effort = 8;
      duration = 45 * 60;
    } else if (isTempo) {
      distance = 8;
      pace = basePace + 5;
      effort = 7;
      duration = 40 * 60;
    } else if (isRecovery) {
      distance = 5;
      pace = basePace + 80;
      effort = 3;
    } else if (isEasy) {
      distance = 6 + Math.round(pseudoRandom(d + 3) * 2);
      pace = basePace + 50;
      effort = 4;
    }

    // Gradual improvement over time: earlier days slightly slower
    const improvement = (63 - d) / 63 * 15;
    pace = Math.max(220, Math.round(pace - improvement));
    duration = Math.round(distance * pace);

    const maxHr = 208 - 0.7 * (profile.age ?? 30);
    const intensityFactor = effort / 10;
    const avgHr = Math.round(maxHr * (0.55 + intensityFactor * 0.35));

    workouts.push({
      source: ['strava', 'garmin', 'coros', 'polar'][Math.floor(pseudoRandom(d + 5) * 4)],
      external_id: `seed_${d}`,
      activity_type: 'run',
      title: isLong ? 'Tiro largo' : isIntervals ? 'Series' : isTempo ? 'Tempo' : isRecovery ? 'Recuperación' : 'Rodaje',
      distance_km: distance,
      duration_sec: duration,
      avg_pace_sec_per_km: pace,
      avg_heart_rate: avgHr,
      max_heart_rate: Math.min(Math.round(maxHr), avgHr + 12),
      cadence: 174 + Math.round(pseudoRandom(d + 7) * 10),
      elevation_gain_m: Math.round(pseudoRandom(d + 8) * 80),
      calories: Math.round(distance * 65),
      avg_power: profile.experience === 'elite' ? Math.round(280 + pseudoRandom(d + 9) * 40) : null,
      effort,
      started_at: new Date(now - d * 86400000 - 8 * 3600000).toISOString(),
    });
  }
  return workouts;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

async function seedAchievements(userId: string, stats: ComputedStats): Promise<void> {
  const badges = [
    { badge_id: 'first_run', title: 'Primer paso', description: 'Completa tu primer entrenamiento', icon: 'Footprints', xp: 50 },
    { badge_id: 'week_streak', title: 'En racha', description: 'Entrena 7 días seguidos', icon: 'Flame', xp: 100 },
    { badge_id: 'distance_100', title: 'Centenario', description: 'Acumula 100 km', icon: 'Medal', xp: 150 },
    { badge_id: 'early_bird', title: 'Madrugador', description: 'Entrena antes de las 7 AM', icon: 'Sunrise', xp: 75 },
  ];
  const earned = badges.filter((b) => {
    if (b.badge_id === 'first_run') return stats.totalWorkouts >= 1;
    if (b.badge_id === 'week_streak') return stats.totalWorkouts >= 7;
    if (b.badge_id === 'distance_100') return stats.totalDistanceKm >= 100;
    if (b.badge_id === 'early_bird') return stats.totalWorkouts >= 3;
    return false;
  });
  if (!earned.length) return;
  await supabase.from('achievements').insert(
    earned.map((b) => ({ ...b, user_id: userId })),
  );
}

async function seedNotifications(userId: string, stats: ComputedStats): Promise<void> {
  const notifs: { type: 'recovery' | 'workout' | 'achievement' | 'insight' | 'plan'; title: string; body: string }[] = [
    { type: 'workout', title: 'Entrenamiento listo', body: 'Mañana es un buen día para hacer series. Tu recuperación está óptima.' },
    { type: 'insight', title: stats.progressPct >= 0 ? `Has mejorado un ${stats.progressPct}%` : 'Ajusta tu carga', body: stats.progressPct >= 0 ? 'Tu ritmo medio ha mejorado respecto a hace 4 semanas.' : 'Tu ritmo ha bajado ligeramente. Revisa sueño y descanso.' },
    { type: 'recovery', title: 'Recuperación', body: `Tu recuperación está en ${stats.recoveryScore}/100. ${stats.recoveryScore < 50 ? 'Considera un descanso activo hoy.' : 'Listo para entrenar.'}` },
  ];
  await supabase.from('notifications').insert(
    notifs.map((n) => ({ ...n, user_id: userId })),
  );
}
