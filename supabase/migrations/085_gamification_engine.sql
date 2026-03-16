-- ============================================================
-- Migration 085: Gamification Engine — Badges & User Achievements
-- ============================================================

-- 1. The Badge Dictionary
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    tier INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Earned Badges
CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

-- 3. RLS Policies
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_select_all" ON badges FOR SELECT USING (true);
CREATE POLICY "user_badges_select_all" ON user_badges FOR SELECT USING (true);

-- 4. Indexes
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);

-- 5. Seed the initial badge dictionary
INSERT INTO badges (id, name, description, icon, category, tier) VALUES
  -- ══ EXCLUSIVE ══
  ('beta_vanguard',        'Beta Vanguard',          'One of the founding members of Model Horse Hub.',                      '🏅', 'exclusive',  5),

  -- ══ COLLECTION ══
  ('herd_builder_1',       'Herd Builder I',         'Cataloged 10 models in your digital stable.',                          '🐴', 'collection', 1),
  ('herd_builder_2',       'Herd Builder II',        'Cataloged 50 models in your digital stable.',                          '🐴', 'collection', 2),
  ('herd_builder_3',       'Herd Builder III',       'Cataloged 100 models in your digital stable.',                         '🐴', 'collection', 3),
  ('shutterbug_1',         'Shutterbug I',           'Uploaded 25 photos across your collection.',                           '📸', 'collection', 1),
  ('shutterbug_2',         'Shutterbug II',          'Uploaded 100 photos across your collection.',                          '📸', 'collection', 2),
  ('shutterbug_3',         'Shutterbug III',         'Uploaded 250 photos across your collection.',                          '📸', 'collection', 3),
  ('triple_crown',         'Triple Crown',           'Own horses in all three finish types: OF, Custom, and Artist Resin.',  '👑', 'collection', 3),
  ('conga_line',           'Conga Line',             'Own 5 or more horses on the exact same mold.',                         '🎠', 'collection', 2),

  -- ══ SOCIAL ══
  ('social_butterfly_1',   'Social Butterfly I',     'Made 10 posts or replies in the community feed.',                      '🦋', 'social',     1),
  ('social_butterfly_2',   'Social Butterfly II',    'Made 50 posts or replies in the community feed.',                      '🦋', 'social',     2),
  ('popular_kid',          'Popular Kid',            'Received 25 likes across your posts.',                                 '❤️', 'social',     2),
  ('first_follower',       'First Follower',         'Gained your first follower.',                                          '👤', 'social',     1),

  -- ══ COMMERCE ══
  ('first_sale',           'First Sale',             'Completed your first marketplace transaction.',                        '💰', 'commerce',   1),
  ('trusted_trader_1',     'Trusted Trader I',       'Completed 5 marketplace transactions.',                                '🤝', 'commerce',   2),
  ('trusted_trader_2',     'Trusted Trader II',      'Completed 25 marketplace transactions.',                               '🤝', 'commerce',   3),
  ('five_star_seller',     'Five Star Seller',       'Maintained a perfect 5.0 rating with 5+ reviews.',                     '⭐', 'commerce',   4),

  -- ══ SHOWS ══
  ('show_debut',           'Show Debut',             'Entered your first photo show.',                                       '📷', 'shows',      1),
  ('ribbon_collector_1',   'Ribbon Collector I',     'Earned placings in 5 different show classes.',                          '🎀', 'shows',      2),
  ('ribbon_collector_2',   'Ribbon Collector II',    'Earned placings in 25 different show classes.',                         '🎀', 'shows',      3)

ON CONFLICT (id) DO NOTHING;
