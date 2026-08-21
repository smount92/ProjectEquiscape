-- ══════════════════════════════════════════════════════════════
-- Migration 171: Profile customization ("make it theirs")
-- ══════════════════════════════════════════════════════════════
-- One jsonb bag on public.users, mirroring notification_prefs rather than
-- minting a column per knob. Everything in it is COSMETIC and PUBLIC by
-- construction — it is rendered on /profile/[alias_name], which any member
-- can read. Nothing here gates anything.
--
-- Shape (validated + clamped in app code, never trusted from the DB —
-- see sanitizeCustomization in src/lib/profile/customization.ts):
--   {
--     "theme":    "saddle" | "forest" | "oxblood" | "chestnut" | "pewter" | "ink",
--     "tagline":  string(<=80)  | null,
--     "pronouns": string(<=24)  | null,
--     "bannerPath": string      | null,   -- path in the `avatars` bucket
--     "featured": string[]      (<=6 user_horses ids, owner's own PUBLIC horses),
--     "hidden":   string[]      (section ids the member has switched off)
--   }
--
-- DELIBERATELY NOT HERE:
--   * No free-form colors. `theme` is an enum of curated leather-compatible
--     TRIM palettes; the app maps the id to CSS vars and ignores anything it
--     doesn't recognise, so a hand-crafted jsonb write can't produce unreadable
--     text or smuggle CSS into the page.
--   * No RLS change. users already carries "update own row"
--     (USING auth.uid() = id, 022) — that is exactly the owner-only write rule
--     this needs, so writes are safe with no new policy.
--   * No new bucket. Banners live in the existing `avatars` bucket under the
--     owner's uid prefix, so the avatar storage policies already cover them.
--
-- Additive + idempotent. After apply: npm run gen-types (the column is
-- hand-added to database.generated.ts in the same PR; regen keeps it honest).
-- Until it IS applied, every read degrades to "no customization" — see
-- fetchProfileCustomization, which mirrors fetchSupporterBadge (142).
-- ══════════════════════════════════════════════════════════════

-- ── Column ──
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS profile_customization JSONB DEFAULT NULL;

-- ── Column-level SELECT grant ──
-- Migration 133 revoked the TABLE-level SELECT on public.users and re-granted
-- per column, so a new column is invisible to clients until it is granted here.
-- Without this line the feature reads as "nobody has customized anything" and
-- the bug is invisible in code review — 142 hit the same trap.
--
-- Safe to expose: the payload is exactly what the member chose to publish on
-- their own public profile page. (The anon grant matches 133/142; it is inert
-- while users has no anon SELECT policy, but keeps the column from silently
-- disappearing if one is ever added.)
GRANT SELECT (profile_customization) ON public.users TO anon, authenticated;

-- ── Write path ──
-- No grant needed: users still has the default TABLE-level UPDATE grant, and
-- the "Users can update own profile" RLS policy (001, re-stated 022) already
-- restricts writes to auth.uid() = id. Unlike 142's supporter columns there is
-- no service-role-only state here, so no BEFORE trigger guard is required —
-- a member writing their own cosmetics is the intended and only use.
