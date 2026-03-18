-- ============================================================
-- Migration 091: Catalog Curation — Suggestions, Voting, Discussion, Changelog
-- ============================================================

-- 1. Suggestions
CREATE TABLE IF NOT EXISTS catalog_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('correction', 'addition', 'removal', 'photo')),
    field_changes JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL CHECK (char_length(reason) <= 2000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'auto_approved')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_suggestions_user ON catalog_suggestions(user_id);
CREATE INDEX idx_catalog_suggestions_item ON catalog_suggestions(catalog_item_id);
CREATE INDEX idx_catalog_suggestions_status ON catalog_suggestions(status);
CREATE INDEX idx_catalog_suggestions_created ON catalog_suggestions(created_at DESC);

ALTER TABLE catalog_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suggestions"
    ON catalog_suggestions FOR SELECT USING (true);
CREATE POLICY "Auth users can create suggestions"
    ON catalog_suggestions FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending suggestions"
    ON catalog_suggestions FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND status = 'pending');

-- 2. Votes (one per user per suggestion)
CREATE TABLE IF NOT EXISTS catalog_suggestion_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES catalog_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(suggestion_id, user_id)
);

CREATE INDEX idx_suggestion_votes_suggestion ON catalog_suggestion_votes(suggestion_id);

ALTER TABLE catalog_suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
    ON catalog_suggestion_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote"
    ON catalog_suggestion_votes FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own vote"
    ON catalog_suggestion_votes FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 3. Discussion Comments
CREATE TABLE IF NOT EXISTS catalog_suggestion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES catalog_suggestions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_alias TEXT NOT NULL,
    body TEXT NOT NULL CHECK (char_length(body) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestion_comments_suggestion ON catalog_suggestion_comments(suggestion_id);

ALTER TABLE catalog_suggestion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
    ON catalog_suggestion_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment"
    ON catalog_suggestion_comments FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments"
    ON catalog_suggestion_comments FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 4. Changelog (public)
CREATE TABLE IF NOT EXISTS catalog_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID REFERENCES catalog_suggestions(id),
    catalog_item_id UUID REFERENCES catalog_items(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('correction', 'addition', 'removal', 'photo')),
    change_summary TEXT NOT NULL,
    contributed_by UUID REFERENCES auth.users(id),
    contributor_alias TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_changelog_created ON catalog_changelog(created_at DESC);

ALTER TABLE catalog_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changelog"
    ON catalog_changelog FOR SELECT USING (true);

-- 5. Curator tracking on users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved_suggestions_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_trusted_curator BOOLEAN NOT NULL DEFAULT false;

-- 6. Atomic increment RPC for approved_suggestions_count
CREATE OR REPLACE FUNCTION increment_approved_suggestions(target_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET approved_suggestions_count = approved_suggestions_count + 1
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Curator badge seeds (append to existing badges table)
INSERT INTO badges (id, name, description, icon, category, tier) VALUES
    ('catalog_contributor', 'Catalog Contributor', 'Had your first catalog suggestion approved.', '📘', 'community', 1),
    ('bronze_curator',      'Bronze Curator',      'Had 10 catalog suggestions approved.',       '🥉', 'community', 2),
    ('silver_curator',      'Silver Curator',      'Had 50 catalog suggestions approved. Your simple corrections are auto-approved!', '🥈', 'community', 3),
    ('gold_curator',        'Gold Curator',        'Had 200 catalog suggestions approved. All your corrections are auto-approved!',   '🥇', 'community', 4)
ON CONFLICT (id) DO NOTHING;
