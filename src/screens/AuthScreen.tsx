import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui';
import { Activity, Mail, Lock, User, Loader2, TrendingUp, Brain, ShieldCheck } from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (err) throw err;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email,
            full_name: fullName,
          });
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute left-0 top-1/3 h-[280px] w-[280px] rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        {/* Logo */}
        <div className="flex flex-col items-center text-center animate-slide-up">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-500/30">
            <Activity className="h-8 w-8 text-ink-950" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Runner<span className="text-brand-400">AI</span></h1>
          <p className="mt-2 text-sm text-zinc-400">Tu entrenador personal inteligente</p>
        </div>

        {/* Value props */}
        <div className="mt-8 grid gap-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {[
            { icon: Brain, text: 'IA que analiza cada entrenamiento' },
            { icon: TrendingUp, text: 'Predice tus tiempos y progreso' },
            { icon: ShieldCheck, text: 'Previene lesiones antes de que pasen' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-2.5 ring-1 ring-white/5">
              <f.icon className="h-4 w-4 text-brand-400" />
              <span className="text-sm text-zinc-300">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="mt-8 space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {mode === 'signup' && (
            <Field icon={<User className="h-4 w-4" />} value={fullName} onChange={setFullName} placeholder="Nombre completo" type="text" />
          )}
          <Field icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} placeholder="Correo electrónico" type="email" required />
          <Field icon={<Lock className="h-4 w-4" />} value={password} onChange={setPassword} placeholder="Contraseña" type="password" required />

          {error && (
            <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400 ring-1 ring-rose-500/20">{error}</div>
          )}

          <Button type="submit" disabled={busy} className="w-full py-3.5 text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-sm text-zinc-500 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <span>{mode === 'signup' ? '¿Ya tienes cuenta?' : '¿Primera vez?'}</span>
          <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }} className="font-semibold text-brand-400 hover:text-brand-300">
            {mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </div>

        <p className="mt-auto pt-8 text-center text-xs text-zinc-600">
          Al continuar aceptas los Términos y la Política de Privacidad.
        </p>
      </div>
    </div>
  );
}

function Field({ icon, value, onChange, placeholder, type, required }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; type: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/10 transition-all focus-within:ring-brand-500/40">
      <span className="text-zinc-500">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
      />
    </div>
  );
}
