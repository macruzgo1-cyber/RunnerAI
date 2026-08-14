import type { Profile, Workout } from './supabase';
import type { ComputedStats } from './metrics';
import { formatPace, formatRaceTime, formatDuration } from './metrics';

export type CoachContext = {
  profile: Profile;
  workouts: Workout[];
  stats: ComputedStats;
};

// Heuristic AI coach. Analyzes user data and answers natural-language questions
// with personalized, data-grounded advice. (Production: feed context to OpenAI.)
export function generateCoachReply(question: string, ctx: CoachContext): string {
  const q = question.toLowerCase();
  const { profile, stats } = ctx;
  const recent = stats.recentWorkouts[0];
  const name = profile.full_name?.split(' ')[0] ?? '';

  if (/mañana|tomorrow|hoy.*entren|qué.*entren|que.*entren|workout.*tomorrow|entrenamiento.*hoy/.test(q)) {
    if (stats.recoveryScore < 45) {
      return `${name ? name + ', t' : 'T'}u recuperación está en ${stats.recoveryScore}/100 (${stats.recoveryScore < 30 ? 'baja' : 'media-baja'}). Lo mejor hoy es un descanso activo: 20-30 min de caminata ligera o movilidad, sin impacto. Mañana, cuando estés más fresco, retomamos con calidad.`;
    }
    if (stats.fatigueScore > 70) {
      return `${name ? name + ', ' : ''}detecto fatiga elevada (${stats.fatigueScore}/100). Para mañana propongo una sesión regenerativa: 30-40 min de trote suave a ${formatPace((stats.avgPaceSecPerKm ?? 360) + 60)}/km, zona 1-2. Mantén la FC por debajo del 70% de tu máximo. Esto baja la carga sin perder adaptación.`;
    }
    const isQualityDay = (stats.recentWorkouts.length === 0) || ((recent && daysSince(recent.started_at) > 1));
    if (isQualityDay) {
      return `Para mañana, sesión de calidad:\n• Calentamiento: 15 min trote suave + drills\n• Parte principal: 6 × 800m a ritmo de 5K (${formatPace(stats.predicted5k ? stats.predicted5k / 5 : 300)}/km) con 90s de recuperación\n• Enfriagamiento: 10 min trote + estiramientos\nVolumen total ~8km. Tu VO2 estimado (${stats.vo2Max}) soporta esta carga.`;
    }
    return `Para mañana, rodaje medio: 45-50 min a ritmo cómodo (${formatPace((stats.avgPaceSecPerKm ?? 360) + 40)}/km), zona 2. Mantén cadencia ~180 y termina con 4 progresiones de 15s. Tu estado físico (${stats.fitness}) permite este volumen.`;
  }

  if (/sobreentren|overtrain|fatiga|cansad|agotad/.test(q)) {
    const ratio = stats.fatigue / Math.max(stats.fitness, 5);
    if (ratio > 1.3 || stats.injuryRisk === 'high') {
      return `Sí, hay señales de sobreentrenamiento. Tu fatiga aguda (${stats.fatigue}) supera tu fitness crónico (${stats.fitness}), ratio ${ratio.toFixed(2)}. El riesgo de lesión está ${stats.injuryRisk.toUpperCase()} (${stats.injuryRiskScore}/100).\n\nRecomendación: 2 días de descanso activo o completo, hidratación extra (35ml/kg), y prioriza 8h+ de sueño. Reanuda con una sesión regenerativa cuando la recuperación supere 60.`;
    }
    return `No pareces sobreentrenado. Fatiga ${stats.fatigue} vs fitness ${stats.fitness} (ratio ${ratio.toFixed(2)}), riesgo de lesión ${stats.injuryRisk}. Mantén la consistencia y asegúrate de dormir bien. Tu cuerpo está asimilando la carga correctamente.`;
  }

  if (/descans|rest|recuper|rest day|día libre/.test(q)) {
    if (stats.recoveryScore < 50) {
      return `Sí, hoy deberías descansar. Tu recuperación es ${stats.recoveryScore}/100 y la fatiga está en ${stats.fatigueScore}/100. Un descanso estratégico ahora previene lesiones y mejora la adaptación. Mañana volverás más fuerte.`;
    }
    return `No necesitas descanso completo hoy. Tu recuperación (${stats.recoveryScore}/100) es buena. Si quieres, haz una sesión suave de 30-40 min en zona 2. Escucha a tu cuerpo y reduce si notas pesadez muscular.`;
  }

  if (/50.*min.*10k|bajar.*10k|10k.*tiempo|mejorar.*10k/.test(q)) {
    const current10k = stats.predicted10k ?? 3300;
    const diff = current10k - 3000;
    if (diff <= 0) {
      return `¡Ya estás en forma para bajar de 50' en 10K! Tu predicción actual es ${formatRaceTime(stats.predicted10k)}. Enfócate en ejecutar un 10K controlado: primeros 5K a 5:02/km, segundos 5K a 4:58/km. haz un trabajo de umbral 1-2 veces por semana.`;
    }
    return `Para bajar de 50' en 10K necesitas un pace promedio de 5:00/km. Tu predicción actual es ${formatRaceTime(stats.predicted10k)} (${formatPace(current10k / 10)}/km). Faltan ${Math.round(diff / 60)} min.\n\nPlan de 6-8 semanas:\n• 1 sesión de series largas: 4-5 × 1km a 4:45-4:50/km\n• 1 rodaje tempo continuo: 20-25 min a 5:05/km\n• 2 rodajes suaves zona 2\n• 1 tiro largo de 12-14km\nCon tu VO2 (${stats.vo2Max}) y consistencia, es alcanzable.`;
  }

  if (/vo2|estado físico|fitness|forma/.test(q)) {
    return `Tu estado físico actual:\n• Fitness (CTL): ${stats.fitness}\n• Fatiga (ATL): ${stats.fatigue}\n• Recuperación: ${stats.recoveryScore}/100\n• VO2 máx estimado: ${stats.vo2Max}\n• Progreso reciente: ${stats.progressPct > 0 ? '+' : ''}${stats.progressPct}%\n\n${stats.progressPct >= 0 ? 'Vas en mejora, sigue así.' : 'Tu ritmo ha bajado ligeramente — revisa sueño y carga.'}`;
  }

  if (/lesion|injur|dolor|pain|rodilla|tendón|muslo/.test(q)) {
    return `Tu riesgo de lesión actual es ${stats.injuryRisk.toUpperCase()} (${stats.injuryRiskScore}/100).\n\nFactores evaluados:\n• Incremento de carga semanal\n• Nivel de fatiga (${stats.fatigueScore}/100)\n• Relación fitness/fatiga\n\n${stats.injuryRisk === 'high'
      ? 'Detente 2-3 días. Si el dolor persiste, consulta a un fisioterapeuta. No corras through pain.'
      : stats.injuryRisk === 'medium'
        ? 'Reduce el volumen 20% esta semana, añade 10 min de movilidad diaria y estiramientos post-run.'
        : 'Mantén tu rutina, incluye 2 sesiones de fuerza/semana y calienta bien antes de series.'}`;
  }

  if (/predic|tiempo.*meta|objetivo.*tiempo|cuánto.*tarde|rapido|rápido/.test(q)) {
    return `Tus predicciones de tiempo basadas en entrenamientos recientes:\n• 5K: ${formatRaceTime(stats.predicted5k)}\n• 10K: ${formatRaceTime(stats.predicted10k)}\n• Media Maratón: ${formatRaceTime(stats.predictedHalf)}\n• Maratón: ${formatRaceTime(stats.predictedFull)}\n\n${stats.progressPct > 0 ? `Estás mejorando un ${stats.progressPct}% respecto a hace 4 semanas.` : 'Mantén la consistencia para ver progreso.'}`;
  }

  if (/recuperación después|post.*run|después.*correr|nutric|comer|proteína|hidrat/.test(q)) {
    const weight = profile.weight_kg ?? 70;
    return `Después de tu último entrenamiento${recent ? ` (${formatDuration(recent.duration_sec)}, ${recent.distance_km}km)` : ''}:\n\n• Hidratación: ${Math.round(weight * 0.5)} ml extra hoy\n• Proteína: ${Math.round(weight * 0.3)}g en los próximos 30-60 min\n• Carbohidratos: ${Math.round(weight * 1)}g para reponer glucógeno\n• Movilidad: 10 min foam roller + estiramientos de cadena posterior\n• Sueño: apunta a 8h+ esta noche\n• Próxima sesión: espera al menos ${stats.recoveryScore < 50 ? '24-36h' : '12-18h'} según tu recuperación.`;
  }

  // Default contextual summary
  return `${name ? name + ', ' : ''}basándome en tus ${stats.totalWorkouts} entrenamientos (${stats.totalDistanceKm}km totales), tu estado actual es:\n\n• Fitness: ${stats.fitness} | Fatiga: ${stats.fatigueScore}/100 | Recuperación: ${stats.recoveryScore}/100\n• VO2 máx estimado: ${stats.vo2Max}\n• Riesgo de lesión: ${stats.injuryRisk}\n• Progreso: ${stats.progressPct > 0 ? '+' : ''}${stats.progressPct}%\n\n¿Qué te gusta saber? Puedo ayudarte con el entrenamiento de mañana, prevención de lesiones, predicciones de tiempo o recuperación.`;
}

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}
