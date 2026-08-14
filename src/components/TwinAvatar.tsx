import { useEffect, useState } from 'react';
import type { TwinModelState } from '@/lib/twin';

// Living digital twin avatar — a minimalist humanoid figure whose visual state
// (color, glow, posture, pulsing) reflects the runner's current physiological state.
export function TwinAvatar({ state, size = 200 }: { state: TwinModelState; size?: number }) {
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((p) => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Derive visual state
  const health = state.recoveryLevel;
  const fatigue = state.fatigue;
  const injuryRisk = state.injuryRisk;
  const fitness = state.fitness;

  // Color: green (recovered) → amber (moderate) → red (fatigued/injured)
  const color =
    injuryRisk > 60 ? '#fb7185' :
    fatigue > 70 ? '#fbbf24' :
    health > 65 ? '#34d399' :
    health > 45 ? '#22d3ee' :
    '#fbbf24';

  // Glow intensity: stronger when fit and recovered
  const glowStrength = (health / 100) * (fitness / 100) * 0.8 + 0.2;
  const glowOpacity = 0.3 + glowStrength * 0.4 + (Math.sin(pulsePhase / 100 * Math.PI * 2) * 0.1);

  // Posture: slumped when fatigued, upright when fresh
  const slouch = fatigue > 65 ? 6 : fatigue > 45 ? 3 : 0;
  // Heart pulse rate: faster when fatigued
  const pulseSpeed = fatigue > 60 ? 1.6 : fatigue > 40 ? 1.2 : 1;
  const heartScale = 1 + Math.sin((pulsePhase * pulseSpeed) / 100 * Math.PI * 2) * 0.12;

  // Injury marker: show on vulnerable zone
  const vulnZone = topZone(state.vulnerability);

  const cx = 100;
  const headCy = 38 - slouch;
  const bodyTop = 58 - slouch;
  const bodyBottom = 115;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-all duration-1000"
        style={{ backgroundColor: color, opacity: glowOpacity * 0.3 }}
      />
      <svg viewBox="0 0 200 200" className="relative" style={{ width: size, height: size }}>
        <defs>
          <radialGradient id="twinGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle cx={cx} cy={100} r={90} fill="url(#twinGlow)" />
        <circle cx={cx} cy={100} r={85} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {/* Pulsing readiness ring */}
        <circle
          cx={cx}
          cy={100}
          r={82}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity={0.4 + Math.sin(pulsePhase / 100 * Math.PI * 2) * 0.15}
          strokeDasharray="4 6"
          className="transition-all"
        />

        {/* Head */}
        <circle cx={cx} cy={headCy} r={14} fill="url(#bodyGrad)" stroke={color} strokeWidth="1.5" />

        {/* Body (torso) — narrows/slouches with fatigue */}
        <path
          d={`M${cx} ${bodyTop} L${cx - 16} ${bodyTop + 8} L${cx - 14} ${bodyBottom} L${cx + 14} ${bodyBottom} L${cx + 16} ${bodyTop + 8} Z`}
          fill="url(#bodyGrad)"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity={0.9}
        />

        {/* Heart (pulsing) */}
        <g transform={`translate(${cx} ${bodyTop + 18}) scale(${heartScale})`} style={{ transformOrigin: `${cx}px ${bodyTop + 18}px` }}>
          <path
            d="M0 -2 C -3 -6 -8 -6 -8 -1 C -8 3 0 8 0 8 C 0 8 8 3 8 -1 C 8 -6 3 -6 0 -2 Z"
            fill={injuryRisk > 50 ? '#fb7185' : '#f43f5e'}
            opacity={0.85}
          />
        </g>

        {/* Arms */}
        <path d={`M${cx - 16} ${bodyTop + 8} L${cx - 28} ${bodyTop + 35 + slouch} L${cx - 26} ${bodyBottom - 5}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.8} />
        <path d={`M${cx + 16} ${bodyTop + 8} L${cx + 28} ${bodyTop + 35 + slouch} L${cx + 26} ${bodyBottom - 5}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.8} />

        {/* Legs */}
        <path d={`M${cx - 10} ${bodyBottom} L${cx - 12} ${bodyBottom + 32} L${cx - 10} ${bodyBottom + 52}`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity={0.85} />
        <path d={`M${cx + 10} ${bodyBottom} L${cx + 12} ${bodyBottom + 32} L${cx + 14} ${bodyBottom + 52}`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity={0.85} />

        {/* Injury marker on vulnerable zone */}
        {injuryRisk > 45 && (
          <g className="animate-pulse">
            <circle cx={vulnZone.x} cy={vulnZone.y} r="6" fill="#fb7185" opacity="0.3" />
            <circle cx={vulnZone.x} cy={vulnZone.y} r="3" fill="#fb7185" opacity="0.7" />
          </g>
        )}

        {/* Data points around avatar */}
        {[health, fitness, state.adaptationLevel, 100 - fatigue].map((val, i) => {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const r = 70;
          const x = cx + Math.cos(angle) * r;
          const y = 100 + Math.sin(angle) * r;
          return (
            <g key={i}>
              <line x1={cx + Math.cos(angle) * 85} y1={100 + Math.sin(angle) * 85} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx={x} cy={y} r="3" fill={color} opacity={val / 100 * 0.7 + 0.1} />
            </g>
          );
        })}
      </svg>

      {/* Status label */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{statusLabel(health, fatigue, injuryRisk)}</span>
        </div>
      </div>
    </div>
  );
}

function statusLabel(health: number, fatigue: number, injuryRisk: number): string {
  if (injuryRisk > 60) return 'En riesgo';
  if (fatigue > 70) return 'Fatigado';
  if (health > 70) return 'En forma';
  if (health > 45) return 'Activo';
  return 'En carga';
}

function topZone(vulnerability: Record<string, number>): { x: number; y: number } {
  let max = 0; let key = 'knee';
  for (const [k, v] of Object.entries(vulnerability)) {
    if (v > max) { max = v; key = k; }
  }
  const positions: Record<string, { x: number; y: number }> = {
    knee: { x: 88, y: 150 },
    achilles: { x: 92, y: 170 },
    hamstring: { x: 92, y: 140 },
    plantar: { x: 90, y: 175 },
    hip: { x: 92, y: 120 },
    shin: { x: 88, y: 155 },
    itb: { x: 86, y: 145 },
    calf: { x: 92, y: 155 },
  };
  return positions[key] ?? positions.knee;
}
