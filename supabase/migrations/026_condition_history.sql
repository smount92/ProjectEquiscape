-- ============================================================
-- Migration 026: Condition History Ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS condition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  old_condition TEXT,
  new_condition TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE condition_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view condition history on public horses
CREATE POLICY "View condition history on public horses"
  ON condition_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_horses h
    WHERE h.id = condition_history.horse_id AND h.is_public = true
  ));

-- Owners can always view their own horse's history
CREATE POLICY "Owner views own condition history"
  ON condition_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_horses h
    WHERE h.id = condition_history.horse_id AND h.owner_id = auth.uid()
  ));

-- Only allow inserts from the authenticated user
CREATE POLICY "System insert condition history"
  ON condition_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

CREATE INDEX idx_condition_history_horse ON condition_history (horse_id, created_at DESC);
