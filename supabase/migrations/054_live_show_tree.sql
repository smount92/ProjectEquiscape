-- ============================================================
-- Migration 054: Live Show Relational Tree (Epic 3)
-- Structured divisions and classes for live/NAMHSA shows
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE event_divisions TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_divisions_event
    ON event_divisions (event_id, sort_order);

-- RLS: anyone can view divisions for public events, only creator can manage
ALTER TABLE event_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event divisions"
    ON event_divisions FOR SELECT
    USING (true);

CREATE POLICY "Event creator can manage divisions"
    ON event_divisions FOR ALL
    USING (
        event_id IN (
            SELECT id FROM events WHERE created_by = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════
-- STEP 2: CREATE event_classes TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID NOT NULL REFERENCES event_divisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class_number TEXT,
    description TEXT,
    is_nan_qualifying BOOLEAN DEFAULT false,
    max_entries INT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_classes_division
    ON event_classes (division_id, sort_order);

-- RLS: same as divisions
ALTER TABLE event_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event classes"
    ON event_classes FOR SELECT
    USING (true);

CREATE POLICY "Event creator can manage classes"
    ON event_classes FOR ALL
    USING (
        division_id IN (
            SELECT ed.id FROM event_divisions ed
            JOIN events e ON e.id = ed.event_id
            WHERE e.created_by = auth.uid()
        )
    );

-- ══════════════════════════════════════════════════════════════
-- STEP 3: ADD class_id FK TO event_entries
-- Nullable — only used when event has structured divisions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE event_entries
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES event_classes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_event_entries_class
    ON event_entries (class_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ADD class_id FK TO show_string_entries
-- When planning for a show with structured classes
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_string_entries
    ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES event_classes(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('event_divisions', 'event_classes');
-- Expected: 2 rows
