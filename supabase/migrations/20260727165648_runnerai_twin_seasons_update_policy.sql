/*
# Fix: add missing update policy for twin_seasons

1. Security
- Adds the missing owner-scoped UPDATE policy for twin_seasons (the original
  migration omitted it). The insert/select/delete policies already exist.
*/

CREATE POLICY "update_own_twin_seasons" ON twin_seasons FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
