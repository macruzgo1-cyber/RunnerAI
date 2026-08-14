/*
# RunnerAI Digital Runner Twin™ Schema

## Overview
Adds the data model for the Digital Runner Twin — a continuously-learning
digital model of each runner. The twin stores a living state snapshot, a
time-series of learned physiological signals, scenario simulations, full
season plans, and performance predictions with confidence intervals.

## New Tables
1. `twin_state` - the living digital model snapshot (one row per user, upserted)
   Holds the estimated physiological/psychological state the twin learns over time.
2. `twin_signals` - time-series of raw + derived signals fed into the model
   (HRV, sleep, stress, load, weather, terrain, etc.). Append-only per workout/day.
3. `twin_scenarios` - saved "what-if" scenario simulations run by the user.
4. `twin_seasons` - full season plans (macro/meso/microcycles, peaks, risks).
5. `twin_predictions` - performance predictions per distance with best/expected/worst
   cases and confidence levels.

## Security
- RLS enabled on every table.
- Owner-scoped 4-policy CRUD (select/insert/update/delete) on all tables.
- Owner column defaults to auth.uid().

## Notes
1. twin_state is unique per user (upsert on user_id).
2. twin_signals append a new row per observation; the twin recomputes state from them.
3. jsonb columns store flexible model payloads (bayesian priors, scenario projections).
4. Indexes on user_id + created_at for time-series queries.
*/

-- ===== TWIN STATE (living model snapshot) =====
CREATE TABLE IF NOT EXISTS twin_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- physiological state (0-100 normalized unless noted)
  fitness int NOT NULL DEFAULT 50,
  fatigue int NOT NULL DEFAULT 30,
  aerobic_capacity int NOT NULL DEFAULT 50,
  anaerobic_capacity int NOT NULL DEFAULT 40,
  recovery_level int NOT NULL DEFAULT 70,
  internal_load int NOT NULL DEFAULT 30,
  external_load int NOT NULL DEFAULT 30,
  injury_risk int NOT NULL DEFAULT 10,
  mental_state int NOT NULL DEFAULT 70,
  motivation int NOT NULL DEFAULT 75,
  dropout_probability int NOT NULL DEFAULT 5,
  adaptation_level int NOT NULL DEFAULT 50,
  -- derived metrics
  vo2_max numeric NOT NULL DEFAULT 40,
  max_hr int NOT NULL DEFAULT 190,
  resting_hr int NOT NULL DEFAULT 60,
  cadence int NOT NULL DEFAULT 178,
  stride_length_cm numeric NOT NULL DEFAULT 110,
  -- vulnerability profile (jsonb: per-zone injury susceptibility)
  vulnerability jsonb NOT NULL DEFAULT '{"knee":20,"achilles":15,"hamstring":12,"plantar":10,"hip":8,"shin":10,"itb":8,"calf":12}'::jsonb,
  -- model meta
  confidence int NOT NULL DEFAULT 40,
  training_age_days int NOT NULL DEFAULT 0,
  last_workout_at timestamptz,
  model_version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twin_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_twin_state" ON twin_state;
CREATE POLICY "select_own_twin_state" ON twin_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_twin_state" ON twin_state;
CREATE POLICY "insert_own_twin_state" ON twin_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_twin_state" ON twin_state;
CREATE POLICY "update_own_twin_state" ON twin_state FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_twin_state" ON twin_state;
CREATE POLICY "delete_own_twin_state" ON twin_state FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twin_state_user ON twin_state(user_id);

-- ===== TWIN SIGNALS (time-series observations) =====
CREATE TABLE IF NOT EXISTS twin_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  observed_at date NOT NULL DEFAULT CURRENT_DATE,
  -- raw inputs
  hrv numeric,
  sleep_hours numeric,
  sleep_quality int,
  stress int,
  resting_hr int,
  body_weight_kg numeric,
  temperature_c numeric,
  humidity_pct int,
  altitude_m int,
  terrain text,
  shoe_id text,
  -- derived
  daily_load int,
  daily_intensity numeric,
  recovery_signal int,
  mood int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twin_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_twin_signals" ON twin_signals;
CREATE POLICY "select_own_twin_signals" ON twin_signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_twin_signals" ON twin_signals;
CREATE POLICY "insert_own_twin_signals" ON twin_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_twin_signals" ON twin_signals;
CREATE POLICY "update_own_twin_signals" ON twin_signals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_twin_signals" ON twin_signals;
CREATE POLICY "delete_own_twin_signals" ON twin_signals FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_twin_signals_user_date ON twin_signals(user_id, observed_at DESC);

-- ===== TWIN SCENARIOS (what-if simulations) =====
CREATE TABLE IF NOT EXISTS twin_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  scenario_type text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text,
  confidence int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twin_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_twin_scenarios" ON twin_scenarios;
CREATE POLICY "select_own_twin_scenarios" ON twin_scenarios FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_twin_scenarios" ON twin_scenarios;
CREATE POLICY "insert_own_twin_scenarios" ON twin_scenarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_twin_scenarios" ON twin_scenarios;
CREATE POLICY "delete_own_twin_scenarios" ON twin_scenarios FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_twin_scenarios_user ON twin_scenarios(user_id, created_at DESC);

-- ===== TWIN SEASONS (full season plans) =====
CREATE TABLE IF NOT EXISTS twin_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_race text NOT NULL,
  goal_distance text NOT NULL,
  target_time_sec int,
  start_date date NOT NULL,
  race_date date NOT NULL,
  weeks int NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  macrocycles jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_probability int NOT NULL DEFAULT 60,
  risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  peak_form_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twin_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_twin_seasons" ON twin_seasons;
CREATE POLICY "select_own_twin_seasons" ON twin_seasons FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_twin_seasons" ON twin_state;
CREATE POLICY "insert_own_twin_seasons" ON twin_seasons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_twin_seasons" ON twin_seasons;
CREATE POLICY "delete_own_twin_seasons" ON twin_seasons FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_twin_seasons_user ON twin_seasons(user_id, created_at DESC);

-- ===== TWIN PREDICTIONS (performance predictions with confidence) =====
CREATE TABLE IF NOT EXISTS twin_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  distance text NOT NULL,
  best_case_sec int,
  expected_case_sec int,
  worst_case_sec int,
  confidence int NOT NULL DEFAULT 50,
  projected_at timestamptz NOT NULL DEFAULT now(),
  horizon_days int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twin_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_twin_predictions" ON twin_predictions;
CREATE POLICY "select_own_twin_predictions" ON twin_predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_twin_predictions" ON twin_predictions;
CREATE POLICY "insert_own_twin_predictions" ON twin_predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_twin_predictions" ON twin_predictions;
CREATE POLICY "delete_own_twin_predictions" ON twin_predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_twin_predictions_user ON twin_predictions(user_id, created_at DESC);
