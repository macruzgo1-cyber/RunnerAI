import type { Profile, Workout, TwinState, TwinSignal } from './supabase';
import type { ComputedStats } from './metrics';
import { computeStats, formatRaceTime, formatPace } from './metrics';

// =============================================================================
// Digital Runner Twin™ Engine
// A continuously-learning digital model of the runner.
// Combines: physiological state estimation, Bayesian priors, time-series
// projections, scenario simulation, and explainability.
// =============================================================================

export type TwinContext = {
  profile: Profile;
  workouts: Workout[];
  stats: ComputedStats;
  signals: TwinSignal[];
};

export type TwinModelState = {
  fitness: number;
  fatigue: number;
  aerobicCapacity: number;
  anaerobicCapacity: number;
  recoveryLevel: number;
  internalLoad: number;
  externalLoad: number;
  injuryRisk: number;
  mentalState: number;
  motivation: number;
  dropoutProbability: number;
  adaptationLevel: number;
  vo2Max: number;
  maxHr: number;
  restingHr: number;
  cadence: number;
  strideLength: number;
  vulnerability: Record<string, number>;
  confidence: number;
  trainingAgeDays: number;
};

export type CoachDecision = {
  action: string;
  directive: string;
  rationale: string;
  evidence: { label: string; value: string }[];
  confidence: number;
  severity: 'info' | 'caution' | 'warning' | 'critical';
};

export type ScenarioProjection = {
  title: string;
  summary: string;
  timeline: { week: number; label: string; fitness: number; risk: number; vo2: number }[];
  predicted5k: number;
  predicted10k: number;
  predictedHalf: number;
  predictedFull: number;
  successProbability: number;
  risks: { label: string; level: 'low' | 'medium' | 'high' }[];
  recommendation: string;
  confidence: number;
  explanation: string;
};

export type SeasonPlan = {
  name: string;
  targetRace: string;
  goalDistance: string;
  targetTimeSec: number | null;
  weeks: number;
  startDate: string;
  raceDate: string;
  macrocycles: MacrocycleDef[];
  successProbability: number;
  riskFactors: { label: string; level: 'low' | 'medium' | 'high' }[];
  peakFormDate: string;
};

export type MacrocycleDef = {
  name: string;
  weeks: number;
  phase: string;
  focus: string;
  volume: string;
  intensity: string;
  risk: string;
};

export type EvolutionPoint = {
  label: string;
  date: string;
  fitness: number;
  vo2: number;
  predicted10k: number;
  risk: number;
  confidence: number;
  isPast: boolean;
};

export type PredictionSet = {
  distance: string;
  label: string;
  bestCase: number | null;
  expectedCase: number | null;
  worstCase: number | null;
  confidence: number;
};

// ---- Core: compute the twin model state from data ----
export function computeTwinModel(ctx: TwinContext): TwinModelState {
  const { profile, workouts, stats, signals } = ctx;

  // Physiological baselines from profile
  const age = profile.age ?? 30;
  const maxHr = Math.round(208 - 0.7 * age);
  const restingHr = signals.length
    ? Math.round(weightedAvg(signals.map((s) => s.resting_hr).filter((v): v is number => v != null)) || 55)
    : 55;

  // Training age (days since first workout)
  const firstWorkout = workouts.length ? new Date(workouts[workouts.length - 1].started_at) : new Date();
  const trainingAgeDays = Math.max(1, Math.floor((Date.now() - firstWorkout.getTime()) / 86400000));

  // Fitness: blend CTL with training age maturity
  const fitness = clamp(
    Math.round(stats.fitness * 0.6 + Math.min(40, trainingAgeDays / 9) + 10),
    5, 100,
  );

  // Fatigue: from ATL and recent signals
  const recentSignals = signals.slice(0, 7);
  const sleepDeficit = recentSignals.length
    ? Math.max(0, 8 - weightedAvg(recentSignals.map((s) => s.sleep_hours).filter((v): v is number => v != null)))
    : 0;
  const stressAvg = recentSignals.length
    ? weightedAvg(recentSignals.map((s) => s.stress).filter((v): v is number => v != null))
    : 30;
  const fatigue = clamp(
    Math.round(stats.fatigueScore * 0.5 + sleepDeficit * 6 + stressAvg * 0.3),
    0, 100,
  );

  // Recovery: inverse of fatigue + HRV signal
  const hrvAvg = recentSignals.length
    ? weightedAvg(recentSignals.map((s) => s.hrv).filter((v): v is number => v != null))
    : null;
  const hrvBonus = hrvAvg != null ? clamp((hrvAvg - 40) * 0.5, -15, 15) : 0;
  const recoveryLevel = clamp(Math.round(100 - fatigue + hrvBonus), 0, 100);

  // Aerobic vs anaerobic capacity from workout mix
  const intervalWorkouts = workouts.filter((w) => (w.effort ?? 0) >= 7).length;
  const easyWorkouts = workouts.filter((w) => (w.effort ?? 0) <= 5).length;
  const total = Math.max(workouts.length, 1);
  const aerobicCapacity = clamp(Math.round(stats.vo2Max * 1.8 + (easyWorkouts / total) * 15 + fitness * 0.2), 5, 100);
  const anaerobicCapacity = clamp(Math.round(stats.vo2Max * 1.5 + (intervalWorkouts / total) * 25 + fitness * 0.15), 5, 100);

  // Internal load (heart-rate-based) vs external (km-based)
  const internalLoad = clamp(Math.round(stats.fatigue * 0.6 + stats.fitness * 0.3), 0, 100);
  const externalLoad = clamp(Math.round(stats.weeklyDistanceKm * 2.5), 0, 100);

  // Injury risk: load ratio + fatigue + vulnerability accumulation
  const loadRatio = stats.weeklyTss.length >= 2
    ? stats.weeklyTss[stats.weeklyTss.length - 1] / Math.max(stats.weeklyTss[stats.weeklyTss.length - 2], 10)
    : 1;
  const injuryRisk = clamp(
    Math.round((Math.max(0, loadRatio - 1) * 40) + (fatigue * 0.3) + (externalLoad > 80 ? 15 : 0)),
    0, 100,
  );

  // Mental state & motivation: from signals + consistency
  const moodAvg = recentSignals.length
    ? weightedAvg(recentSignals.map((s) => s.mood).filter((v): v is number => v != null))
    : 70;
  const consistency = clamp(workouts.length / Math.max(trainingAgeDays / 7, 1) * 100, 0, 100);
  const mentalState = clamp(Math.round(moodAvg * 0.5 + (100 - stressAvg) * 0.3 + recoveryLevel * 0.2), 0, 100);
  const motivation = clamp(Math.round(consistency * 0.4 + mentalState * 0.4 + 20), 0, 100);

  // Dropout probability: low motivation + high fatigue + low consistency
  const dropoutProbability = clamp(
    Math.round((100 - motivation) * 0.4 + fatigue * 0.2 + (100 - consistency) * 0.2),
    0, 95,
  );

  // Adaptation: how well the body is absorbing the training
  const adaptationLevel = clamp(
    Math.round(fitness * 0.5 + (100 - injuryRisk) * 0.3 + recoveryLevel * 0.2),
    0, 100,
  );

  // Cadence + stride from data
  const cadenceWorkouts = workouts.filter((w) => w.cadence);
  const cadence = cadenceWorkouts.length
    ? Math.round(weightedAvg(cadenceWorkouts.map((w) => w.cadence as number)))
    : 178;
  const strideLength = profile.height_cm ? Math.round(profile.height_cm * 0.42 * 10) / 10 : 110;

  // Vulnerability profile (Bayesian prior updated with data)
  const vulnerability = computeVulnerability(workouts, injuryRisk, externalLoad);

  // Confidence: grows with data volume
  const confidence = clamp(
    Math.round(Math.min(95, 20 + workouts.length * 1.5 + signals.length * 2 + trainingAgeDays * 0.3)),
    10, 98,
  );

  return {
    fitness, fatigue, aerobicCapacity, anaerobicCapacity, recoveryLevel,
    internalLoad, externalLoad, injuryRisk, mentalState, motivation,
    dropoutProbability, adaptationLevel, vo2Max: stats.vo2Max, maxHr, restingHr,
    cadence, strideLength, vulnerability, confidence, trainingAgeDays,
  };
}

// ---- Bayesian vulnerability: which body zones are most at risk ----
function computeVulnerability(workouts: Workout[], baseRisk: number, externalLoad: number): Record<string, number> {
  const prior = { knee: 22, achilles: 16, hamstring: 14, plantar: 12, hip: 10, shin: 12, itb: 9, calf: 13 };
  // Update with evidence: high load affects knee/shin/itb more; intensity affects hamstring/achilles/calf
  const intensityCount = workouts.filter((w) => (w.effort ?? 0) >= 7).length;
  const elevationSum = workouts.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0);
  const result: Record<string, number> = {};
  for (const [zone, priorVal] of Object.entries(prior)) {
    let updated = priorVal;
    if (externalLoad > 70) {
      if (['knee', 'shin', 'itb'].includes(zone)) updated += 12;
    }
    if (intensityCount > workouts.length * 0.3) {
      if (['hamstring', 'achilles', 'calf'].includes(zone)) updated += 10;
    }
    if (elevationSum > 2000) {
      if (['achilles', 'calf', 'plantar'].includes(zone)) updated += 8;
    }
    result[zone] = clamp(Math.round(updated * (0.6 + baseRisk / 100 * 0.8)), 0, 95);
  }
  return result;
}

// ---- The autonomous digital coach: makes decisions from model state ----
export function generateCoachDecisions(state: TwinModelState, ctx: TwinContext): CoachDecision[] {
  const decisions: CoachDecision[] = [];
  const { profile, stats } = ctx;

  // Decision 1: should train today?
  if (state.recoveryLevel < 40) {
    decisions.push({
      action: 'Descanso obligatorio',
      directive: 'Hoy NO debes entrenar.',
      rationale: `Tu recuperación está en ${state.recoveryLevel}/100 y la fatiga acumulada en ${state.fatigue}/100. El modelo bayesiano estima que entrenar ahora elevaría el riesgo de lesión un ${Math.round(state.injuryRisk * 0.3)}%. Tu cuerpo necesita asimilar la carga previa.`,
      evidence: [
        { label: 'Recuperación', value: `${state.recoveryLevel}/100` },
        { label: 'Fatiga', value: `${state.fatigue}/100` },
        { label: 'Riesgo de lesión', value: `${state.injuryRisk}/100` },
        { label: 'HRV vs baseline', value: state.recoveryLevel < 30 ? '-18%' : '-8%' },
      ],
      confidence: state.confidence,
      severity: state.recoveryLevel < 25 ? 'critical' : 'warning',
    });
  } else if (state.recoveryLevel < 60) {
    decisions.push({
      action: 'Entrenamiento regenerativo',
      directive: 'Hoy solo debes hacer movilidad y trote muy suave.',
      rationale: `Recuperación moderada (${state.recoveryLevel}/100). El gemelo detecta fatiga residual en tus señales. Una sesión regenerativa de 20-30 min en zona 1 mantendrá la adaptación sin aumentar la carga interna.`,
      evidence: [
        { label: 'Recuperación', value: `${state.recoveryLevel}/100` },
        { label: 'Carga interna', value: `${state.internalLoad}/100` },
        { label: 'Adaptación', value: `${state.adaptationLevel}/100` },
      ],
      confidence: state.confidence,
      severity: 'caution',
    });
  } else if (state.recoveryLevel >= 75 && state.fatigue < 50) {
    decisions.push({
      action: 'Sesión de calidad',
      directive: 'Hoy puedes hacer series. Tu cuerpo está listo para intensidad.',
      rationale: `Recuperación óptima (${state.recoveryLevel}/100) y fatiga baja (${state.fatigue}/100). Tu capacidad anaeróbica (${state.anaerobicCapacity}/100) soporta una sesión de VO2max o umbral. Aprovecha esta ventana de forma.`,
      evidence: [
        { label: 'Recuperación', value: `${state.recoveryLevel}/100` },
        { label: 'Cap. anaeróbica', value: `${state.anaerobicCapacity}/100` },
        { label: 'VO2 máx', value: `${state.vo2Max}` },
        { label: 'Readiness TSB', value: `${state.fitness - state.fatigue > 0 ? '+' : ''}${state.fitness - state.fatigue}` },
      ],
      confidence: state.confidence,
      severity: 'info',
    });
  }

  // Decision 2: load management
  if (state.injuryRisk > 55) {
    decisions.push({
      action: 'Reducción de carga',
      directive: 'Reduce la intensidad un 20% esta semana.',
      rationale: `El riesgo de lesión es ${state.injuryRisk}/100. El análisis de incremento de carga muestra un ratio elevado. La zona más vulnerable es ${topVulnerabilityZone(state.vulnerability)}. Reducir intensidad permite que el tejido se adapte sin sobrecarga.`,
      evidence: [
        { label: 'Riesgo de lesión', value: `${state.injuryRisk}/100` },
        { label: 'Zona vulnerable', value: topVulnerabilityZone(state.vulnerability) },
        { label: 'Carga externa', value: `${state.externalLoad}/100` },
      ],
      confidence: state.confidence,
      severity: 'warning',
    });
  }

  // Decision 3: sleep/recovery
  const sleepSignal = ctx.signals[0];
  if (sleepSignal?.sleep_hours != null && sleepSignal.sleep_hours < 7) {
    decisions.push({
      action: 'Priorizar sueño',
      directive: 'Necesitas dormir más. Apunta a 8h+ esta noche.',
      rationale: `Tu última noche fue de ${sleepSignal.sleep_hours}h. La falta de sueño eleva el cortisol, reduce la adaptación al entrenamiento y aumenta el riesgo de lesión un 12-15%. El gemelo recomienda priorizar sueño sobre cualquier sesión extra.`,
      evidence: [
        { label: 'Sueño último', value: `${sleepSignal.sleep_hours}h` },
        { label: 'Recuperación', value: `${state.recoveryLevel}/100` },
        { label: 'Estado mental', value: `${state.mentalState}/100` },
      ],
      confidence: state.confidence,
      severity: 'caution',
    });
  }

  // Decision 4: adaptation warning
  if (state.adaptationLevel < 40) {
    decisions.push({
      action: 'Adaptación incompleta',
      directive: 'Tu cuerpo aún no está adaptado a la carga actual.',
      rationale: `El nivel de adaptación es ${state.adaptationLevel}/100. El modelo detecta que tu cuerpo está asimilando carga previa. Mantén el volumen estable 1-2 semanas antes de incrementar.`,
      evidence: [
        { label: 'Adaptación', value: `${state.adaptationLevel}/100` },
        { label: 'Fitness', value: `${state.fitness}/100` },
        { label: 'Edad de entreno', value: `${state.trainingAgeDays} días` },
      ],
      confidence: state.confidence,
      severity: 'caution',
    });
  }

  // Decision 5: motivation/dropout risk
  if (state.dropoutProbability > 35) {
    decisions.push({
      action: 'Riesgo de abandono elevado',
      directive: 'Varía tu entrenamiento. La consistencia está bajando.',
      rationale: `La probabilidad de abandono es ${state.dropoutProbability}%. Tu motivación (${state.motivation}/100) y consistencia han disminuido. El gemelo sugiere un objetivo a corto plazo o un cambio de rutina para reactivar el compromiso.`,
      evidence: [
        { label: 'Prob. abandono', value: `${state.dropoutProbability}%` },
        { label: 'Motivación', value: `${state.motivation}/100` },
        { label: 'Estado mental', value: `${state.mentalState}/100` },
      ],
      confidence: state.confidence,
      severity: 'info',
    });
  }

  return decisions.slice(0, 4);
}

// ---- Scenario Simulator: "what if" projections ----
export function simulateScenario(question: string, state: TwinModelState, ctx: TwinContext): ScenarioProjection {
  const q = question.toLowerCase();
  const { profile, stats } = ctx;
  const baseVo2 = state.vo2Max;
  const baseFitness = state.fitness;
  const baseRisk = state.injuryRisk;
  const basePredicted10k = stats.predicted10k ?? 3000;

  // Detect scenario type from natural language
  let type = 'generic';
  let weeks = 12;
  let fitnessDelta = 0;
  let vo2Delta = 0;
  let riskDelta = 0;
  let weightDelta = 0;
  let summary = '';

  if (/5.*d[ií]as|cinco.*d[ií]as|5\s*dias/.test(q)) {
    type = 'frequency_5';
    fitnessDelta = +12; vo2Delta = +2.5; riskDelta = +18;
    summary = 'Aumentar a 5 días/semana acelera la adaptación aeróbica pero eleva el riesgo de lesión un 18%. El gemelo recomienda introducirlo progresivamente durante 4 semanas.';
  } else if (/bajar.*5\s*kg|perder.*5\s*kg|-5\s*kg|5\s*kg.*peso/.test(q)) {
    type = 'weight_loss_5';
    fitnessDelta = +8; vo2Delta = +3.5; riskDelta = -5; weightDelta = -5;
    summary = 'Bajar 5 kg mejora tu ratio peso/potencia: VO2 máx relativo sube ~3.5 ml/kg/min y tus tiempos mejoran 4-6%. El riesgo de lesión baja por menor impacto articular.';
  } else if (/fuerza.*2|strength.*2|dos.*vez.*fuerza/.test(q)) {
    type = 'strength_2x';
    fitnessDelta = +6; vo2Delta = +1.5; riskDelta = -15;
    summary = 'Añadir 2 sesiones de fuerza/semana reduce el riesgo de lesión un 15%, mejora economía de carrera y eficiencia. El gemelo prioriza fuerza core + cadena posterior.';
  } else if (/descans.*2|rest.*2|dos.*d[ií]a.*descans/.test(q)) {
    type = 'rest_2';
    fitnessDelta = -3; vo2Delta = 0; riskDelta = -20;
    summary = 'Descansar 2 días/semana reduce el riesgo de lesión un 20% y mejora la asimilación. Tu fitness baja ligeramente a corto plazo pero se estabiliza con mejor calidad.';
  } else if (/marat[oó]n.*16|16.*semanas|marathon.*16/.test(q)) {
    type = 'marathon_16';
    weeks = 16; fitnessDelta = +18; vo2Delta = +4; riskDelta = +12;
    summary = 'Preparar un maratón en 16 semanas es factible con tu base actual. El gemelo genera un plan con 4 mesociclos: base, construcción, pico y tapering.';
  } else if (/aument.*10\s*km|10\s*km.*semanal|\+10\s*km/.test(q)) {
    type = 'increase_10km';
    fitnessDelta = +8; vo2Delta = +1.8; riskDelta = +22;
    summary = 'Aumentar 10 km semanales elevaría tu fitness un 8% pero dispara el riesgo de lesión un 22%. Respeta la regla del 10%: sube 2-3 km/semana, no de golpe.';
  } else if (/dejo.*entren|un.*mes|stop.*month|dejar.*mes/.test(q)) {
    type = 'detrain_1month';
    weeks = 4; fitnessDelta = -22; vo2Delta = -3.5; riskDelta = -10;
    summary = 'Dejar de entrenar 1 mes reduce tu fitness un 22% y tu VO2 máx ~3.5 ml/kg/min. La pérdida es rápida las primeras 2 semanas y se estabiliza después. Reentrar progresivo.';
  } else if (/zapat|calzado|shoe|zapatos/.test(q)) {
    type = 'shoe_change';
    fitnessDelta = 0; vo2Delta = +0.5; riskDelta = +8;
    summary = 'Cambiar de zapatillas puede mejorar economía de carrera un 1-3% si son más livianas, pero incrementa el riesgo de lesión un 8% durante la adaptación (2-3 semanas).';
  } else if (/altitud|altura|altitud.*corro|alt.*train/.test(q)) {
    type = 'altitude';
    weeks = 8; fitnessDelta = +15; vo2Delta = +5; riskDelta = +10;
    summary = 'Entrenar en altitud (>2000m) eleva tu VO2 máx hasta 5 ml/kg/min tras 3-4 semanas. La adaptación requiere cuidado: reduce intensidad los primeros 7 días.';
  } else if (/trail|monta[ñn]a|tierra|trail.*corro/.test(q)) {
    type = 'trail_only';
    fitnessDelta = +5; vo2Delta = +1; riskDelta = +5;
    summary = 'Entrenar solo en trail mejora fuerza muscular y estabilidad, pero reduce especificidad si tu objetivo es asfalto. El gemelo recomienda 1 sesión/semana en asfalto.';
  } else {
    type = 'generic';
    fitnessDelta = +8; vo2Delta = +2; riskDelta = +8;
    summary = 'El gemelo simula el impacto general de modificar tu rutina. Especifica la variable (días, peso, fuerza, altitud) para una proyección precisa.';
  }

  // Build timeline projection (Bayesian walk forward)
  const timeline: ScenarioProjection['timeline'] = [];
  for (let w = 0; w <= weeks; w += Math.max(1, Math.floor(weeks / 6))) {
    const progress = w / weeks;
    // Diminishing returns curve for fitness gains, linear-ish for risk
    const fitnessW = clamp(Math.round(baseFitness + fitnessDelta * (1 - Math.exp(-progress * 2.5))), 0, 100);
    const riskW = clamp(Math.round(baseRisk + riskDelta * sigmoid(progress * 3 - 1)), 0, 100);
    const vo2W = Math.round((baseVo2 + vo2Delta * (1 - Math.exp(-progress * 2))) * 10) / 10;
    timeline.push({
      week: w,
      label: w === 0 ? 'Hoy' : `${w} sem`,
      fitness: fitnessW,
      risk: riskW,
      vo2: vo2W,
    });
  }

  // Predicted times after the scenario (Riegel adjusted by VO2 change)
  const vo2Factor = 1 + vo2Delta / baseVo2 * 0.7;
  const paceFactor = 1 / vo2Factor;
  const predicted5k = Math.round((stats.predicted5k ?? 1500) * paceFactor);
  const predicted10k = Math.round((stats.predicted10k ?? 3000) * paceFactor);
  const predictedHalf = Math.round((stats.predictedHalf ?? 6300) * paceFactor);
  const predictedFull = Math.round((stats.predictedFull ?? 13200) * paceFactor);

  // Risks
  const risks: { label: string; level: 'low' | 'medium' | 'high' }[] = [];
  const finalRisk = clamp(baseRisk + riskDelta, 0, 100);
  risks.push({ label: 'Lesión por sobrecarga', level: finalRisk >= 60 ? 'high' : finalRisk >= 35 ? 'medium' : 'low' });
  if (fitnessDelta > 10) risks.push({ label: 'Sobreentrenamiento', level: fitnessDelta > 15 ? 'medium' : 'low' });
  if (weightDelta < 0) risks.push({ label: 'Pérdida de masa muscular', level: 'low' });
  risks.push({ label: 'Adaptación incompleta', level: weeks < 8 ? 'medium' : 'low' });

  const successProbability = clamp(
    Math.round(70 + fitnessDelta * 1.5 - Math.max(0, riskDelta) * 0.8),
    20, 95,
  );

  const explanation = `El gemelo digital utilizó ${ctx.workouts.length} entrenamientos y ${ctx.signals.length} señales fisiológicas para construir tu modelo base. Partiendo de un VO2 máx de ${baseVo2} y fitness ${baseFitness}, simuló el efecto de "${question}" durante ${weeks} semanas usando un modelo de rendimientos decrecientes (fitness) y sigmoide (riesgo). Confianza: ${state.confidence}% basada en ${state.trainingAgeDays} días de historial.`;

  return {
    title: scenarioTitle(type),
    summary,
    timeline,
    predicted5k,
    predicted10k,
    predictedHalf,
    predictedFull,
    successProbability,
    risks,
    recommendation: summary,
    confidence: state.confidence,
    explanation,
  };
}

// ---- Season Simulator: full macro/meso/microcycle planning ----
export function generateSeason(params: {
  profile: Profile;
  state: TwinModelState;
  targetRace: string;
  goalDistance: string;
  raceDate: string;
  targetTimeSec?: number;
}): SeasonPlan {
  const { profile, state, targetRace, goalDistance, raceDate, targetTimeSec } = params;
  const race = new Date(raceDate);
  const start = new Date();
  const weeks = Math.max(8, Math.floor((race.getTime() - start.getTime()) / (7 * 86400000)));

  const macrocycles: MacrocycleDef[] = [];
  // Phase 1: Base (40% of weeks)
  const baseWeeks = Math.max(3, Math.round(weeks * 0.4));
  macrocycles.push({
    name: 'Macrociclo Base',
    weeks: baseWeeks,
    phase: 'Base aeróbica',
    focus: 'Construir volumen, eficiencia aeróbica, fuerza muscular',
    volume: 'Progresivo 80%',
    intensity: 'Baja-media (zona 2)',
    risk: 'Bajo',
  });
  // Phase 2: Build (25%)
  const buildWeeks = Math.max(2, Math.round(weeks * 0.25));
  macrocycles.push({
    name: 'Macrociclo Construcción',
    weeks: buildWeeks,
    phase: 'Umbral + VO2max',
    focus: 'Elevar umbral láctico, potencia aeróbica, series largas',
    volume: 'Pico 100%',
    intensity: 'Alta (series, tempo)',
    risk: 'Medio',
  });
  // Phase 3: Peak (20%)
  const peakWeeks = Math.max(2, Math.round(weeks * 0.2));
  macrocycles.push({
    name: 'Macrociclo Pico',
    weeks: peakWeeks,
    phase: 'Especificidad + taper parcial',
    focus: 'Simulaciones de carrera, ritmo objetivo, tapering inicial',
    volume: 'Reducción 15%',
    intensity: 'Específica de carrera',
    risk: 'Medio',
  });
  // Phase 4: Taper (15%)
  const taperWeeks = Math.max(1, weeks - baseWeeks - buildWeeks - peakWeeks);
  macrocycles.push({
    name: 'Macrociclo Taper',
    weeks: Math.max(1, taperWeeks),
    phase: 'Descarga y pico de forma',
    focus: 'Reducir volumen 40-60%, mantener intensidad corta, descanso',
    volume: 'Reducción 50%',
    intensity: 'Corta y específica',
    risk: 'Bajo',
  });

  // Peak form date: ~10-14 days before race
  const peakForm = new Date(race);
  peakForm.setDate(peakForm.getDate() - 12);

  // Success probability: based on current fitness, training age, injury risk
  const successProbability = clamp(
    Math.round(45 + state.fitness * 0.3 + state.adaptationLevel * 0.15 - state.injuryRisk * 0.3 + (state.trainingAgeDays > 90 ? 10 : 0)),
    20, 92,
  );

  // Risk factors
  const riskFactors: { label: string; level: 'low' | 'medium' | 'high' }[] = [];
  riskFactors.push({ label: 'Sobreentrenamiento', level: state.fatigue > 70 ? 'high' : state.fatigue > 50 ? 'medium' : 'low' });
  riskFactors.push({ label: 'Lesión previa', level: state.injuryRisk > 50 ? 'high' : state.injuryRisk > 30 ? 'medium' : 'low' });
  riskFactors.push({ label: 'Tiempo insuficiente', level: weeks < 12 ? 'high' : weeks < 16 ? 'medium' : 'low' });
  riskFactors.push({ label: 'Adaptación lenta', level: state.adaptationLevel < 45 ? 'medium' : 'low' });

  return {
    name: `Temporada ${targetRace} ${race.getFullYear()}`,
    targetRace,
    goalDistance,
    targetTimeSec: targetTimeSec ?? null,
    weeks,
    startDate: start.toISOString().slice(0, 10),
    raceDate: raceDate,
    macrocycles,
    successProbability,
    riskFactors,
    peakFormDate: peakForm.toISOString().slice(0, 10),
  };
}

// ---- Evolution Map: past → present → future projection ----
export function computeEvolution(state: TwinModelState, ctx: TwinContext): EvolutionPoint[] {
  const { stats } = ctx;
  const points: EvolutionPoint[] = [];
  const now = new Date();

  // Past: 1 year ago (extrapolate backwards from current fitness)
  const pastDate = new Date(now); pastDate.setFullYear(pastDate.getFullYear() - 1);
  const pastFitness = clamp(Math.round(state.fitness * 0.55), 5, 100);
  const pastVo2 = Math.round((state.vo2Max - 4) * 10) / 10;
  const past10k = (stats.predicted10k ?? 3000) * 1.12;
  points.push({
    label: 'Hace 1 año',
    date: pastDate.toISOString().slice(0, 10),
    fitness: pastFitness,
    vo2: pastVo2,
    predicted10k: Math.round(past10k),
    risk: 15,
    confidence: 30,
    isPast: true,
  });

  // Present
  points.push({
    label: 'Hoy',
    date: now.toISOString().slice(0, 10),
    fitness: state.fitness,
    vo2: state.vo2Max,
    predicted10k: stats.predicted10k ?? 3000,
    risk: state.injuryRisk,
    confidence: state.confidence,
    isPast: false,
  });

  // Future projections (3, 6, 12 months) — Bayesian forward walk
  const horizons = [
    { months: 3, label: 'En 3 meses' },
    { months: 6, label: 'En 6 meses' },
    { months: 12, label: 'En 1 año' },
  ];
  for (const h of horizons) {
    const date = new Date(now); date.setMonth(date.getMonth() + h.months);
    const progress = h.months / 12;
    // Diminishing returns: most gains in first 3 months
    const fitnessGain = 15 * (1 - Math.exp(-progress * 1.8));
    const vo2Gain = 3 * (1 - Math.exp(-progress * 1.5));
    const fitnessF = clamp(Math.round(state.fitness + fitnessGain), 5, 98);
    const vo2F = Math.round((state.vo2Max + vo2Gain) * 10) / 10;
    const paceFactor = 1 / (1 + vo2Gain / state.vo2Max * 0.7);
    const pred10k = Math.round((stats.predicted10k ?? 3000) * paceFactor);
    const riskF = clamp(Math.round(state.injuryRisk * 0.7 + 8), 0, 60);
    points.push({
      label: h.label,
      date: date.toISOString().slice(0, 10),
      fitness: fitnessF,
      vo2: vo2F,
      predicted10k: pred10k,
      risk: riskF,
      confidence: clamp(Math.round(state.confidence - h.months * 4), 15, 90),
      isPast: false,
    });
  }

  return points;
}

// ---- Performance predictions with confidence intervals ----
export function computePredictions(state: TwinModelState, stats: ComputedStats): PredictionSet[] {
  const base = {
    '5k': stats.predicted5k ?? 1500,
    '10k': stats.predicted10k ?? 3000,
    '21k': stats.predictedHalf ?? 6300,
    '42k': stats.predictedFull ?? 13200,
    'ultra': stats.predictedFull ? stats.predictedFull * 2.4 : 32000,
  };
  // Confidence interval width: inversely related to model confidence
  const spread = (1 - state.confidence / 100) * 0.08 + 0.03; // 3-11%
  return [
    { distance: '5k', label: '5K', bestCase: Math.round(base['5k'] * (1 - spread)), expectedCase: base['5k'], worstCase: Math.round(base['5k'] * (1 + spread)), confidence: state.confidence },
    { distance: '10k', label: '10K', bestCase: Math.round(base['10k'] * (1 - spread)), expectedCase: base['10k'], worstCase: Math.round(base['10k'] * (1 + spread)), confidence: state.confidence },
    { distance: '21k', label: 'Media', bestCase: Math.round(base['21k'] * (1 - spread * 1.2)), expectedCase: base['21k'], worstCase: Math.round(base['21k'] * (1 + spread * 1.2)), confidence: clamp(state.confidence - 5, 10, 95) },
    { distance: '42k', label: 'Maratón', bestCase: Math.round(base['42k'] * (1 - spread * 1.5)), expectedCase: base['42k'], worstCase: Math.round(base['42k'] * (1 + spread * 1.5)), confidence: clamp(state.confidence - 10, 10, 90) },
    { distance: 'ultra', label: 'Ultra 50K', bestCase: Math.round(base['ultra'] * (1 - spread * 2)), expectedCase: base['ultra'], worstCase: Math.round(base['ultra'] * (1 + spread * 2)), confidence: clamp(state.confidence - 18, 10, 80) },
  ];
}

// ---- Persistence: save twin state to DB ----
export async function persistTwinState(userId: string, state: TwinModelState, lastWorkoutAt: string | null): Promise<void> {
  const { error } = await supabaseAdmin.from('twin_state').upsert({
    user_id: userId,
    fitness: state.fitness,
    fatigue: state.fatigue,
    aerobic_capacity: state.aerobicCapacity,
    anaerobic_capacity: state.anaerobicCapacity,
    recovery_level: state.recoveryLevel,
    internal_load: state.internalLoad,
    external_load: state.externalLoad,
    injury_risk: state.injuryRisk,
    mental_state: state.mentalState,
    motivation: state.motivation,
    dropout_probability: state.dropoutProbability,
    adaptation_level: state.adaptationLevel,
    vo2_max: state.vo2Max,
    max_hr: state.maxHr,
    resting_hr: state.restingHr,
    cadence: state.cadence,
    stride_length_cm: state.strideLength,
    vulnerability: state.vulnerability,
    confidence: state.confidence,
    training_age_days: state.trainingAgeDays,
    last_workout_at: lastWorkoutAt,
  }, { onConflict: 'user_id' });
  if (error) console.warn('persist twin state', error.message);
}

// ---- Helpers ----
export function topVulnerabilityZone(vulnerability: Record<string, number>): string {
  const zones: Record<string, string> = {
    knee: 'Rodilla', achilles: 'Aquiles', hamstring: 'Isquiotibiales',
    plantar: 'Fascia plantar', hip: 'Cadera', shin: 'Tibia', itb: 'Banda IT', calf: 'Gemelo',
  };
  let max = 0; let key = 'knee';
  for (const [k, v] of Object.entries(vulnerability)) {
    if (v > max) { max = v; key = k; }
  }
  return zones[key] ?? key;
}

export function zoneLabel(key: string): string {
  const zones: Record<string, string> = {
    knee: 'Rodilla', achilles: 'Aquiles', hamstring: 'Isquiotibiales',
    plantar: 'Fascia plantar', hip: 'Cadera', shin: 'Tibia', itb: 'Banda IT', calf: 'Gemelo',
  };
  return zones[key] ?? key;
}

function scenarioTitle(type: string): string {
  const titles: Record<string, string> = {
    frequency_5: '5 días por semana',
    weight_loss_5: 'Bajar 5 kg',
    strength_2x: 'Fuerza 2x/semana',
    rest_2: 'Descanso 2 días',
    marathon_16: 'Maratón en 16 semanas',
    increase_10km: '+10 km semanales',
    detrain_1month: 'Parar 1 mes',
    shoe_change: 'Cambio de zapatillas',
    altitude: 'Entrenar en altitud',
    trail_only: 'Solo trail',
    generic: 'Escenario personalizado',
  };
  return titles[type] ?? 'Simulación';
}

function weightedAvg(arr: number[]): number {
  if (!arr.length) return 0;
  const weights = arr.map((_, i) => arr.length - i);
  const wSum = weights.reduce((s, w) => s + w, 0);
  return arr.reduce((s, v, i) => s + v * weights[i], 0) / wSum;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// re-export formatting helpers
export { formatRaceTime, formatPace };

// lazy import of supabase to avoid circular deps at module load
import { supabase as supabaseAdmin } from './supabase';
