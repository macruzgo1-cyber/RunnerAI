import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  sex: 'male' | 'female' | 'other' | null;
  height_cm: number | null;
  weight_kg: number | null;
  country: string | null;
  city: string | null;
  experience: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  weekly_km: number;
  goal: GoalType | null;
  is_premium: boolean;
  premium_since: string | null;
  onboarded: boolean;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
};

export type GoalType =
  | '5k'
  | '10k'
  | 'half_marathon'
  | 'marathon'
  | 'ultramarathon'
  | 'weight_loss'
  | 'endurance';

export type Workout = {
  id: string;
  user_id: string;
  source: string | null;
  external_id: string | null;
  activity_type: string;
  title: string | null;
  distance_km: number;
  duration_sec: number;
  avg_pace_sec_per_km: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  cadence: number | null;
  elevation_gain_m: number | null;
  calories: number | null;
  avg_power: number | null;
  effort: number | null;
  started_at: string;
};

export type TrainingPlan = {
  id: string;
  user_id: string;
  name: string;
  goal: GoalType | null;
  target_race_date: string | null;
  target_time_sec: number | null;
  weeks: number;
  status: 'active' | 'completed' | 'paused';
  current_week: number;
  generated_context: Record<string, unknown> | null;
  created_at: string;
};

export type PlanSession = {
  id: string;
  plan_id: string;
  user_id: string;
  week_number: number;
  day_of_week: number;
  date: string;
  session_type: string;
  title: string;
  description: string | null;
  distance_km: number | null;
  duration_min: number | null;
  target_pace_sec_per_km: number | null;
  intensity: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'missed';
  completed_workout_id: string | null;
};

export type AiMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

export type Achievement = {
  id: string;
  user_id: string;
  badge_id: string;
  title: string;
  description: string | null;
  icon: string;
  xp_awarded: number;
  earned_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: 'recovery' | 'workout' | 'achievement' | 'insight' | 'plan';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type UserStats = {
  id: string;
  user_id: string;
  fitness: number;
  fatigue: number;
  recovery: number;
  training_load: number;
  vo2_max: number;
  fatigue_score: number;
  recovery_score: number;
  injury_risk: 'low' | 'medium' | 'high';
  injury_risk_score: number;
  total_distance_km: number;
  total_workouts: number;
  weekly_distance_km: number;
  avg_pace_sec_per_km: number | null;
  predicted_5k_sec: number | null;
  predicted_10k_sec: number | null;
  predicted_half_sec: number | null;
  predicted_full_sec: number | null;
  progress_pct: number;
  computed_at: string;
};

export type TwinState = {
  id: string;
  user_id: string;
  fitness: number;
  fatigue: number;
  aerobic_capacity: number;
  anaerobic_capacity: number;
  recovery_level: number;
  internal_load: number;
  external_load: number;
  injury_risk: number;
  mental_state: number;
  motivation: number;
  dropout_probability: number;
  adaptation_level: number;
  vo2_max: number;
  max_hr: number;
  resting_hr: number;
  cadence: number;
  stride_length_cm: number;
  vulnerability: Record<string, number>;
  confidence: number;
  training_age_days: number;
  last_workout_at: string | null;
  model_version: number;
  updated_at: string;
};

export type TwinSignal = {
  id: string;
  user_id: string;
  observed_at: string;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  stress: number | null;
  resting_hr: number | null;
  body_weight_kg: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  altitude_m: number | null;
  terrain: string | null;
  shoe_id: string | null;
  daily_load: number | null;
  daily_intensity: number | null;
  recovery_signal: number | null;
  mood: number | null;
  notes: string | null;
};

export type TwinScenario = {
  id: string;
  user_id: string;
  question: string;
  scenario_type: string;
  parameters: Record<string, unknown>;
  projection: Record<string, unknown>;
  explanation: string | null;
  confidence: number;
  created_at: string;
};

export type TwinSeason = {
  id: string;
  user_id: string;
  name: string;
  target_race: string;
  goal_distance: string;
  target_time_sec: number | null;
  start_date: string;
  race_date: string;
  weeks: number;
  status: string;
  macrocycles: Macrocycle[];
  success_probability: number;
  risk_factors: { label: string; level: string }[];
  peak_form_date: string | null;
  created_at: string;
};

export type Macrocycle = {
  name: string;
  weeks: number;
  phase: string;
  focus: string;
  volume: string;
  intensity: string;
  risk: string;
};

export type TwinPrediction = {
  id: string;
  user_id: string;
  distance: string;
  best_case_sec: number | null;
  expected_case_sec: number | null;
  worst_case_sec: number | null;
  confidence: number;
  projected_at: string;
  horizon_days: number;
};
