-- ============================================================
-- 163: Career-point ledgers (season-felt wave, foundation).
--
-- buildCareerTotals already computes every horse's and exhibitor's
-- raw career points at each publish — and threw them away. These
-- two small ledgers persist the totals so passports, profiles, and
-- progress ladders ("3 points from ROM") have a cheap read path.
--
-- Written by grantTitlesForShow (service role) on every results
-- publish; world-readable with the same visibility posture as
-- titles (160): a horse's career shows only while the horse does.
-- ============================================================

CREATE TABLE horse_career (
  horse_id UUID PRIMARY KEY REFERENCES user_horses(id) ON DELETE CASCADE,
  career_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_career ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Career readable for visible horses"
  ON horse_career FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses uh
      WHERE uh.id = horse_career.horse_id
        AND uh.deleted_at IS NULL
        AND (
          uh.visibility IN ('public', 'unlisted')
          OR uh.owner_id = (SELECT auth.uid())
        )
    )
  );

CREATE TABLE exhibitor_career (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  career_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exhibitor_career ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exhibitor career is public record"
  ON exhibitor_career FOR SELECT
  TO authenticated, anon
  USING (true);
-- No client write policies on either table: service-role only.
