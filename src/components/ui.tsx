import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className, onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'rounded-3xl bg-ink-850/80 ring-1 ring-white/5 backdrop-blur-sm',
        onClick && 'cursor-pointer transition-all duration-200 hover:ring-white/10 hover:bg-ink-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-lg font-bold tracking-tight text-white', className)}>{children}</h2>
  );
}

export function Pill({ children, color = 'zinc', className }: { children: ReactNode; color?: string; className?: string }) {
  const colors: Record<string, string> = {
    zinc: 'bg-white/5 text-zinc-300 ring-white/10',
    emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
    sky: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
    brand: 'bg-brand-500/10 text-brand-400 ring-brand-500/20',
    violet: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
    teal: 'bg-teal-500/10 text-teal-400 ring-teal-500/20',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', colors[color] ?? colors.zinc, className)}>
      {children}
    </span>
  );
}

// Circular progress gauge (Apple Fitness style)
export function RingGauge({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = '#22d3ee',
  trackColor = 'rgba(255,255,255,0.08)',
  label,
  sublabel,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circ * (1 - pct);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="text-2xl font-bold tabular-nums text-white">{label}</span>
            {sublabel && <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}

// Linear mini bar chart
export function BarChart({ data, height = 60, color = '#22d3ee', labels }: { data: number[]; height?: number; color?: string; labels?: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end justify-between gap-1" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.5 + (i / data.length) * 0.5, minHeight: 2 }}
            />
          </div>
          {labels && <span className="text-[9px] font-medium text-zinc-600">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

// Smooth area line chart (sparkline)
export function AreaChart({ data, height = 80, color = '#22d3ee', fillOpacity = 0.15 }: { data: number[]; height?: number; color?: string; fillOpacity?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  const area = `${path} L ${w} ${height} L 0 ${height} Z`;
  const id = `grad-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

export function StatTile({ label, value, sub, icon, accent = 'text-white' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        {icon && <span className="text-zinc-600">{icon}</span>}
      </div>
      <div className={cn('mt-2 text-2xl font-bold tabular-nums', accent)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

export function Button({ children, onClick, variant = 'primary', className, type = 'button', disabled }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  const variants = {
    primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400 font-semibold shadow-lg shadow-brand-500/20',
    secondary: 'bg-white/5 text-white hover:bg-white/10 ring-1 ring-white/10',
    ghost: 'text-zinc-300 hover:text-white hover:bg-white/5',
    danger: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 ring-1 ring-rose-500/20',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
