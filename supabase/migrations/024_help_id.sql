-- ============================================================
-- Migration 024: Help Me ID This Model
-- Community-powered model identification with upvoting
-- ============================================================

CREATE TABLE id_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  accepted_suggestion_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE id_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view requests"
  ON id_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner inserts requests"
  ON id_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own requests"
  ON id_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_id_requests_status ON id_requests (status, created_at DESC);

-- ────────────────────────────────────────

CREATE TABLE id_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES id_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_release_id UUID REFERENCES reference_releases(id),
  artist_resin_id UUID REFERENCES artist_resins(id),
  free_text TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT at_least_one_suggestion CHECK (
    reference_release_id IS NOT NULL OR artist_resin_id IS NOT NULL OR free_text IS NOT NULL
  )
);

ALTER TABLE id_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suggestions"
  ON id_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can suggest"
  ON id_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own suggestions"
  ON id_suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_id_suggestions_request ON id_suggestions (request_id, upvotes DESC);

-- ── Upvote RPC to prevent race conditions ──

CREATE OR REPLACE FUNCTION upvote_suggestion(p_suggestion_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE id_suggestions
  SET upvotes = upvotes + 1
  WHERE id = p_suggestion_id;
END;
$$;
