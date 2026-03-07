-- ============================================================
-- Migration 003: Allow authenticated users to read alias_name
-- for community features (The Show Ring)
-- ============================================================

-- NOTE: Since PostgreSQL RLS operates at the row level (not column level),
-- we add a policy allowing any authenticated user to SELECT any users row.
-- Column-level privacy (e.g., hiding full_name) is enforced at the app layer
-- by never selecting full_name in public queries.

CREATE POLICY "users_select_public_alias"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');
