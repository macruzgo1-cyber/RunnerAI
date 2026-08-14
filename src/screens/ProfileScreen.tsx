import { useState } from 'react';
import { type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Pill } from '@/components/ui';
import { User, Zap, Crown, Check, LogOut, Watch, Bell, Shield, HelpCircle, ChevronRight, Activity, Target, MapPin, TrendingUp, Star } from 'lucide-react';

export function ProfileScreen({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [isPremium, setIsPremium] = useState(profile.is_premium);

  const upgrade = async () => {
    setUpgrading(true);
    // Simulated premium upgrade (production: Stripe checkout via edge function)
    await new Promise((r) => setTimeout(r, 1400));
    setIsPremium(true);
    setUpgrading(false);
  };

  const integrations = [
    { name: 'Strava', connected: true, color: 'bg-orange-500' },
    { name: 'Garmin', connected: true, color: 'bg-blue-500' },
    { name: 'Apple Health', connected: false, color: 'bg-rose-500' },
    { name: 'Google Fit', connected: false, color: 'bg-emerald-500' },
    { name: 'Coros', connected: false, color: 'bg-zinc-600' },
    { name: 'Polar', connected: false, color: 'bg-rose-600' },
  ];

  const premiumFeatures = [
    'Digital Runner Twin™ — tu gemelo digital con IA',
    'AI Coach ilimitado (sin límite diario)',
    'Simulador de escenarios y temporadas',
    'Mapa de evolución y predicciones con confianza',
    'Planes personalizados con IA',
    'Análisis avanzado de prevención de lesiones',
    'Notificaciones inteligentes proactivas',
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* Profile header */}
      <Card className="overflow-hidden p-6 animate-slide-up">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
            <span className="text-2xl font-extrabold text-ink-950">{profile.full_name?.[0]?.toUpperCase() ?? 'R'}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{profile.full_name ?? 'Runner'}</h1>
            <p className="text-sm text-zinc-400">{profile.email}</p>
            <div className="mt-1.5 flex gap-2">
              {isPremium ? (
                <Pill color="amber"><Crown className="h-3 w-3" /> Premium</Pill>
              ) : (
                <Pill color="zinc">Plan gratis</Pill>
              )}
              <Pill color="brand">Nivel {profile.level}</Pill>
            </div>
          </div>
        </div>
      </Card>

      {/* Premium upsell */}
      {!isPremium && (
        <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="relative bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 ring-1 ring-amber-500/20">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">RunnerAI Premium</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-300">Desbloquea todo el potencial de tu entrenamiento con IA.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$9.99</span>
                <span className="text-sm text-zinc-400">/mes</span>
              </div>
              <div className="mt-4 space-y-2">
                {premiumFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                      <Check className="h-3 w-3 text-amber-400" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-zinc-300">{f}</span>
                  </div>
                ))}
              </div>
              <Button onClick={upgrade} disabled={upgrading} className="mt-5 w-full bg-gradient-to-r from-amber-400 to-orange-500 text-ink-950 hover:from-amber-300 hover:to-orange-400">
                {upgrading ? 'Procesando...' : 'Suscribirme'}
              </Button>
              <p className="mt-2 text-center text-xs text-zinc-500">Cancela cuando quieras · Sin compromiso</p>
            </div>
          </div>
        </Card>
      )}

      {isPremium && (
        <Card className="overflow-hidden p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500">
              <Crown className="h-6 w-6 text-ink-950" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white">Premium activo</h2>
              <p className="text-xs text-zinc-400">Disfrutas todas las funciones</p>
            </div>
            <Pill color="amber">Activo</Pill>
          </div>
        </Card>
      )}

      {/* Sports profile */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="mb-3 text-sm font-bold text-white">Perfil deportivo</h2>
        <Card className="divide-y divide-white/5">
          <Row icon={<User className="h-4 w-4" />} label="Edad" value={`${profile.age ?? '--'} años`} />
          <Row icon={<Activity className="h-4 w-4" />} label="Altura / Peso" value={`${profile.height_cm ?? '--'} cm · ${profile.weight_kg ?? '--'} kg`} />
          <Row icon={<MapPin className="h-4 w-4" />} label="Ubicación" value={`${profile.city ?? '--'}, ${profile.country ?? '--'}`} />
          <Row icon={<TrendingUp className="h-4 w-4" />} label="Experiencia" value={expLabel(profile.experience)} />
          <Row icon={<Target className="h-4 w-4" />} label="Objetivo" value={goalLabel(profile.goal)} />
          <Row icon={<Activity className="h-4 w-4" />} label="Km semanales" value={`${profile.weekly_km} km`} />
        </Card>
      </div>

      {/* Integrations */}
      <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="mb-3 flex items-center gap-2">
          <Watch className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-bold text-white">Integraciones</h2>
        </div>
        <Card className="divide-y divide-white/5">
          {integrations.map((i) => (
            <div key={i.name} className="flex items-center gap-3 px-5 py-3.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${i.color}/20`}>
                <span className={`text-xs font-bold ${i.color === 'bg-orange-500' ? 'text-orange-400' : i.color === 'bg-blue-500' ? 'text-blue-400' : i.color === 'bg-rose-500' ? 'text-rose-400' : i.color === 'bg-emerald-500' ? 'text-emerald-400' : 'text-zinc-400'}`}>{i.name[0]}</span>
              </div>
              <span className="flex-1 text-sm font-medium text-white">{i.name}</span>
              {i.connected ? (
                <Pill color="emerald"><Check className="h-3 w-3" /> Conectado</Pill>
              ) : (
                <button className="text-xs font-semibold text-brand-400 hover:text-brand-300">Conectar</button>
              )}
            </div>
          ))}
        </Card>
      </div>

      {/* Settings */}
      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="mb-3 text-sm font-bold text-white">Ajustes</h2>
        <Card className="divide-y divide-white/5">
          <SettingRow icon={<Bell className="h-4 w-4" />} label="Notificaciones" toggle defaultOn />
          <SettingRow icon={<Zap className="h-4 w-4" />} label="Notificaciones inteligentes IA" toggle defaultOn />
          <SettingRow icon={<Shield className="h-4 w-4" />} label="Privacidad y datos" />
          <SettingRow icon={<HelpCircle className="h-4 w-4" />} label="Ayuda y soporte" />
        </Card>
      </div>

      {/* Sign out */}
      <Button variant="danger" onClick={signOut} className="w-full">
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>

      <p className="text-center text-xs text-zinc-600">RunnerAI v1.0 · Tu entrenador inteligente</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-zinc-500">{icon}</span>
      <span className="flex-1 text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function SettingRow({ icon, label, toggle, defaultOn }: { icon: React.ReactNode; label: string; toggle?: boolean; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false);
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-zinc-500">{icon}</span>
      <span className="flex-1 text-sm font-medium text-white">{label}</span>
      {toggle ? (
        <button onClick={() => setOn(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-white/10'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 text-zinc-600" />
      )}
    </div>
  );
}

function expLabel(e: string): string {
  return { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado', elite: 'Elite' }[e] ?? e;
}
function goalLabel(g: string | null): string {
  return { '5k': '5K', '10k': '10K', half_marathon: 'Media Maratón', marathon: 'Maratón', ultramarathon: 'Ultramaratón', weight_loss: 'Bajar de peso', endurance: 'Resistencia' }[g ?? ''] ?? '—';
}
