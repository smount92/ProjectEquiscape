-- ============================================================
-- Migration 066: Community Moderation — User Reports
-- ============================================================

CREATE TABLE IF NOT EXISTS user_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'horse', 'user', 'comment', 'message')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
    admin_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: reporters can see their own reports, admins see all
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reports"
    ON user_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can see own reports"
    ON user_reports FOR SELECT TO authenticated
    USING (reporter_id = auth.uid());

-- Index for admin dashboard
CREATE INDEX idx_user_reports_status ON user_reports (status, created_at DESC);
CREATE INDEX idx_user_reports_target ON user_reports (target_type, target_id);

-- Prevent duplicate reports from same user on same target
CREATE UNIQUE INDEX idx_user_reports_unique
    ON user_reports (reporter_id, target_type, target_id)
    WHERE status = 'open';
