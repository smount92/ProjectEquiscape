-- ============================================================
-- Migration 076: Event Judges
-- Allows event creators to assign expert judges by user
-- ============================================================

CREATE TABLE IF NOT EXISTS event_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, user_id)
);

ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;

-- Anyone can see who's judging
CREATE POLICY "Anyone can view event judges"
    ON event_judges FOR SELECT TO authenticated USING (true);

-- Only the event creator can manage judges
CREATE POLICY "Event creator manages judges"
    ON event_judges FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_judges.event_id
        AND e.created_by = (SELECT auth.uid())
    ));

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_event_judges_event ON event_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_user ON event_judges(user_id);
