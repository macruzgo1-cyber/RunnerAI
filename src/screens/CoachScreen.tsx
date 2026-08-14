import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, type Workout, type AiMessage, type Profile, type UserStats } from '@/lib/supabase';
import { computeStats } from '@/lib/metrics';
import { generateCoachReply, type CoachContext } from '@/lib/coach';
import { Send, Activity, Sparkles, Loader2, ChevronRight } from 'lucide-react';

const SUGGESTIONS = [
  '¿Qué entrenamiento hago mañana?',
  '¿Estoy sobreentrenando?',
  '¿Cómo bajo de 50 minutos en 10K?',
  '¿Debo descansar hoy?',
  '¿Cuál es mi VO2 máx?',
  'Predice mis tiempos',
];

export function CoachScreen({ profile }: { profile: Profile }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [w, m] = await Promise.all([
      supabase.from('workouts').select('*').eq('user_id', profile.id).order('started_at', { ascending: false }).limit(80),
      supabase.from('ai_messages').select('*').eq('user_id', profile.id).order('created_at', { ascending: true }).limit(50),
    ]);
    setWorkouts((w.data as Workout[]) ?? []);
    setMessages((m.data as AiMessage[]) ?? []);
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput('');
    setBusy(true);

    // optimistic user message
    const tempUser: AiMessage = {
      id: crypto.randomUUID(),
      user_id: profile.id,
      role: 'user',
      content: text,
      context: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    await supabase.from('ai_messages').insert({ user_id: profile.id, role: 'user', content: text });

    // compute reply locally (heuristic engine; production would call OpenAI edge fn)
    const stats = computeStats(workouts, profile);
    const ctx: CoachContext = { profile, workouts, stats };
    let reply = '';
    const chunks = generateCoachReply(text, ctx).split('');
    // streaming effect
    for (let i = 0; i < chunks.length; i += 2) {
      reply += chunks.slice(0, i + 2).join('');
      // this is expensive; just build full then animate reveal
      break;
    }
    reply = generateCoachReply(text, ctx);

    await new Promise((r) => setTimeout(r, 500 + Math.random() * 600));

    const assistantMsg: AiMessage = {
      id: crypto.randomUUID(),
      user_id: profile.id,
      role: 'assistant',
      content: reply,
      context: { fitness: stats.fitness, recovery: stats.recoveryScore, vo2: stats.vo2Max },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    await supabase.from('ai_messages').insert({
      user_id: profile.id,
      role: 'assistant',
      content: reply,
      context: { fitness: stats.fitness, recovery: stats.recoveryScore, vo2: stats.vo2Max },
    });
    setBusy(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600">
            <Activity className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white">Coach IA</h1>
          <p className="text-xs text-emerald-400">En línea · conoce tu progreso</p>
        </div>
        {!profile.is_premium && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">3/10 hoy</span>}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 no-scrollbar">
        {isEmpty && (
          <div className="flex flex-col items-center py-10 text-center animate-fade-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400/20 to-brand-600/10 ring-1 ring-brand-500/20">
              <Sparkles className="h-8 w-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Tu entrenador inteligente</h2>
            <p className="mt-2 max-w-xs text-sm text-zinc-400">
              Pregúntame sobre entrenamientos, lesiones, tiempos o recuperación. Analizo tus datos en tiempo real.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {busy && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
              <Activity className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-3 ring-1 ring-white/5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {isEmpty && (
        <div className="px-5 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.03] px-3.5 py-3 text-left text-xs text-zinc-300 ring-1 ring-white/5 transition-all hover:bg-white/[0.06] hover:ring-brand-500/20"
              >
                {s}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10 focus-within:ring-brand-500/40">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            placeholder="Pregúntale a tu coach..."
            className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || busy}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-ink-950 transition-all hover:bg-brand-400 active:scale-95 disabled:opacity-30"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
          <Activity className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
        </div>
      )}
      <div className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'rounded-tr-md bg-brand-500 text-ink-950' : 'rounded-tl-md bg-white/[0.04] text-zinc-200 ring-1 ring-white/5'}`}>
        {message.content}
      </div>
    </div>
  );
}
