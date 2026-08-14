import { useState } from 'react';
import { supabase, type GoalType } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { seedUserData } from '@/lib/seed';
import { Activity, Target, MapPin, User as UserIcon, Loader2, ChevronRight, Flame, Mountain, Heart, Gauge, Zap, TrendingDown } from 'lucide-react';

const goals: { id: GoalType; label: string; icon: typeof Target; desc: string }[] = [
  { id: '5k', label: '5K', icon: Zap, desc: 'Velocidad explosiva' },
  { id: '10k', label: '10K', icon: Gauge, desc: 'Ritmo sostenido' },
  { id: 'half_marathon', label: 'Media Maratón', icon: Flame, desc: '21K de resistencia' },
  { id: 'marathon', label: 'Maratón', icon: Mountain, desc: '42K legendario' },
  { id: 'ultramarathon', label: 'Ultramaratón', icon: Mountain, desc: 'Más allá del límite' },
  { id: 'weight_loss', label: 'Bajar de peso', icon: TrendingDown, desc: 'Salud y composición' },
  { id: 'endurance', label: 'Resistencia', icon: Heart, desc: 'Aguante y constancia' },
];

const experiences = [
  { id: 'beginner', label: 'Principiante', desc: 'Menos de 6 meses' },
  { id: 'intermediate', label: 'Intermedio', desc: '6 meses – 2 años' },
  { id: 'advanced', label: 'Avanzado', desc: '2 – 5 años' },
  { id: 'elite', label: 'Elite', desc: 'Más de 5 años' },
] as const;

export function Onboarding() {
  const { session, refreshProfile, refreshStats } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState<(typeof experiences)[number]['id']>('beginner');
  const [weeklyKm, setWeeklyKm] = useState('');
  const [goal, setGoal] = useState<GoalType | null>(null);

  const totalSteps = 4;
  const canNext = () => {
    if (step === 0) return age && height && weight;
    if (step === 1) return country && city;
    if (step === 2) return experience && weeklyKm;
    if (step === 3) return goal !== null;
    return false;
  };

  const finish = async () => {
    if (!session?.user?.id || !goal) return;
    setBusy(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      await supabase.from('profiles').update({
        age: Number(age),
        sex,
        height_cm: Number(height),
        weight_kg: Number(weight),
        country,
        city,
        experience,
        weekly_km: Number(weeklyKm),
        goal,
        onboarded: true,
      }).eq('id', session.user.id);

      if (profile) {
        const fullProfile = { ...profile, age: Number(age), sex, height_cm: Number(height), weight_kg: Number(weight), country, city, experience, weekly_km: Number(weeklyKm), goal, onboarded: true } as typeof profile;
        await seedUserData(fullProfile);
      }
      await refreshProfile();
      await refreshStats();
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600">
            <Activity className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-brand-500' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          <span className="text-xs font-medium text-zinc-500">{step + 1}/{totalSteps}</span>
        </div>

        {/* Step content */}
        <div className="mt-8 flex-1 animate-slide-up" key={step}>
          {step === 0 && (
            <Step title="Cuéntanos sobre ti" subtitle="Para personalizar tu entrenamiento">
              <div className="space-y-3">
                <SelectField label="Edad" value={age} onChange={setAge} type="number" suffix="años" />
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">Sexo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['male', 'female', 'other'] as const).map((s) => (
                      <button key={s} onClick={() => setSex(s)} className={`rounded-2xl px-3 py-3 text-sm font-medium transition-all ${sex === s ? 'bg-brand-500 text-ink-950' : 'bg-white/5 text-zinc-300 ring-1 ring-white/10'}`}>
                        {s === 'male' ? 'Hombre' : s === 'female' ? 'Mujer' : 'Otro'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Altura" value={height} onChange={setHeight} type="number" suffix="cm" />
                  <SelectField label="Peso" value={weight} onChange={setWeight} type="number" suffix="kg" />
                </div>
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step title="¿Dónde vives?" subtitle="Adaptamos por clima y altitud">
              <div className="space-y-3">
                <SelectField label="País" value={country} onChange={setCountry} placeholder="Ej. España" />
                <SelectField label="Ciudad" value={city} onChange={setCity} placeholder="Ej. Madrid" />
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-4 ring-1 ring-white/5">
                  <MapPin className="h-5 w-5 text-brand-400" />
                  <p className="text-xs text-zinc-400">Usamos tu ubicación para ajustar recomendaciones según el clima y altitud.</p>
                </div>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title="Tu experiencia" subtitle="Para calibrar tu plan">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {experiences.map((e) => (
                    <button key={e.id} onClick={() => setExperience(e.id)} className={`rounded-2xl p-4 text-left transition-all ${experience === e.id ? 'bg-brand-500/10 ring-2 ring-brand-500' : 'bg-white/5 ring-1 ring-white/10'}`}>
                      <div className={`text-sm font-bold ${experience === e.id ? 'text-brand-400' : 'text-white'}`}>{e.label}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{e.desc}</div>
                    </button>
                  ))}
                </div>
                <SelectField label="Kilómetros semanales" value={weeklyKm} onChange={setWeeklyKm} type="number" suffix="km/semana" />
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="¿Cuál es tu objetivo?" subtitle="La IA orientará todo a esta meta">
              <div className="space-y-2">
                {goals.map((g) => (
                  <button key={g.id} onClick={() => setGoal(g.id)} className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all ${goal === g.id ? 'bg-brand-500/10 ring-2 ring-brand-500' : 'bg-white/5 ring-1 ring-white/10 hover:ring-white/20'}`}>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${goal === g.id ? 'bg-brand-500 text-ink-950' : 'bg-white/5 text-zinc-400'}`}>
                      <g.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${goal === g.id ? 'text-brand-400' : 'text-white'}`}>{g.label}</div>
                      <div className="text-xs text-zinc-500">{g.desc}</div>
                    </div>
                    {goal === g.id && <ChevronRight className="h-5 w-5 text-brand-400" />}
                  </button>
                ))}
              </div>
            </Step>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-4">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>Atrás</Button>
          )}
          <Button onClick={next} disabled={!canNext() || busy} className="flex-1">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : step === totalSteps - 1 ? 'Generar mi plan' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, placeholder, type = 'text', suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suffix?: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/10 transition-all focus-within:ring-brand-500/40">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
        {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
      </div>
    </div>
  );
}
