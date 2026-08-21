-- ══════════════════════════════════════════════════════════════
-- Migration 177: anon-safe Hoofprint (marketing plan §1.3)
--
-- ADDITIVE ONLY. One new function. Nothing existing is touched —
-- v_horse_hoofprint keeps its grants, its security_invoker setting
-- and its seven branches exactly as 159 left them.
--
-- THE PROBLEM. docs/MARKETING_PLAN_2026.md §1.3 calls this "the
-- single highest-value marketing unblock on the list": the public
-- passport's provenance timeline renders NOTHING for a logged-out
-- visitor. getHoofprint() reads v_horse_hoofprint, which is granted
-- TO authenticated only (050), so the read returns empty and the
-- section silently disappears. A skeptical buyer following a seller's
-- link lands on a passport with no provenance on it and no
-- explanation why — on the page whose entire job is to convince them.
--
-- THE FIX. One SECURITY DEFINER function returning the public-safe
-- subset, granted to anon. Same stance as get_public_passport (135):
-- explicit field lists, never SELECT *, guarded before it reads.
--
-- WHAT IT WILL NOT SHOW, and why each one was excluded:
--
--   · PRIVATE HORSES. The guard is visibility = 'public' AND
--     deleted_at IS NULL. Note this is STRICTER than
--     get_public_passport, which also allows 'unlisted'. Deliberate:
--     every underlying table's own SELECT policy keys on
--     user_horses.is_public, which is (visibility = 'public') and
--     excludes unlisted by design (150). Matching that predicate
--     exactly is what guarantees this function can never show an
--     anonymous visitor a row a signed-in member could not see. An
--     unlisted horse's anon passport therefore renders no provenance
--     section at all — the same as today, not a regression. If the
--     owner later wants unlisted included, it is a one-word change
--     here plus a decision about the four branches below.
--
--   · CONDITION HISTORY (view branch 3). condition_history is
--     SELECT TO authenticated (092) — the grade trail is a members'
--     view, and the anon passport already shows the CURRENT grade.
--     The change history is the one branch whose RLS was never
--     written as public record, so it stays out.
--
--   · FOLLOWERS-ONLY NOTES. posts.visibility is 'public' or
--     'followers' (166), and posts_select enforces it. The view
--     hardcodes is_public = true on that branch and leans entirely on
--     RLS to filter — which a SECURITY DEFINER function bypasses. So
--     the visibility check is re-stated HERE, explicitly. Without
--     that one line this function would publish a member's
--     followers-only note to the open internet. It is the single most
--     important line in the file.
--
--   · NON-PUBLIC SALE PRICES. Carried over from the view: a price
--     appears only where is_price_public is true.
--
--   · EMAILS, NAMES, IDS OF ANY KIND beyond what the passport
--     already shows. Aliases only, which are already public pages.
--
-- WHAT IT SHOWS: the creation event, the ownership transfers, show
-- results, customization work, public owner notes and MHH titles —
-- with the owner aliases resolved inline, because users has no anon
-- SELECT policy and a second round trip would return nothing.
--
-- After applying: run `npm run gen-types`.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_public_hoofprint(p_horse_id UUID)
RETURNS TABLE (
  timeline   JSONB,
  ownership  JSONB,
  life_stage TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH horse AS (
    SELECT uh.id, uh.owner_id, uh.custom_name, uh.life_stage, uh.created_at
    FROM public.user_horses uh
    WHERE uh.id = p_horse_id
      AND uh.visibility = 'public'
      AND uh.deleted_at IS NULL
  ),

  -- The same UNION ALL the member view builds, minus branch 3
  -- (condition history), with branch 6 re-guarded. Field names match
  -- v_horse_hoofprint so the TypeScript mapper is shared.
  events AS (
    -- 1. Creation
    SELECT
      h.id                                                        AS source_id,
      'acquired'                                                  AS event_type,
      'Added to stable'                                           AS title,
      h.custom_name || ' was registered on Model Horse Hub.'      AS description,
      h.created_at::date                                          AS event_date,
      jsonb_build_object('life_stage', COALESCE(h.life_stage, 'completed')) AS metadata,
      h.created_at                                                AS created_at,
      h.owner_id                                                  AS user_id,
      'user_horses'                                               AS source_table
    FROM horse h

    UNION ALL

    -- 2. Ownership transfers
    SELECT
      oh.id,
      CASE WHEN oh.released_at IS NOT NULL THEN 'transferred' ELSE 'acquired' END,
      CASE WHEN oh.released_at IS NOT NULL
           THEN 'Transferred to new owner'
           ELSE 'Acquired by ' || oh.owner_alias END,
      oh.notes,
      COALESCE(oh.released_at, oh.acquired_at)::date,
      jsonb_build_object(
        'acquisition_type', oh.acquisition_type,
        'sale_price', CASE WHEN oh.is_price_public THEN oh.sale_price ELSE NULL END
      ),
      COALESCE(oh.released_at, oh.acquired_at),
      oh.owner_id,
      'horse_ownership_history'
    FROM public.horse_ownership_history oh
    JOIN horse h ON h.id = oh.horse_id
    WHERE oh.acquisition_type <> 'original'

    UNION ALL

    -- 4. Show results
    SELECT
      sr.id,
      'show_result',
      COALESCE(sr."placing", 'Competed') || ' at ' || sr.show_name,
      CASE WHEN sr.class_name IS NOT NULL THEN 'Class: ' || sr.class_name ELSE NULL END,
      sr.show_date,
      jsonb_build_object(
        'show_name', sr.show_name,
        'placing', sr."placing",
        'show_type', sr.show_type,
        'is_nan_qualifying', sr.is_nan_qualifying,
        'verification_tier', sr.verification_tier
      ),
      sr.created_at,
      sr.user_id,
      'show_records'
    FROM public.show_records sr
    JOIN horse h ON h.id = sr.horse_id

    UNION ALL

    -- 5. Customization work
    SELECT
      cl.id,
      'customization',
      cl.work_type || COALESCE(' by ' || cl.artist_alias, ''),
      cl.materials_used,
      cl.date_completed,
      jsonb_build_object(
        'work_type', cl.work_type,
        'artist_alias', cl.artist_alias,
        'image_urls', COALESCE(cl.image_urls, '{}')
      ),
      COALESCE(cl.date_completed::timestamptz, now()),
      h.owner_id,
      'customization_logs'
    FROM public.customization_logs cl
    JOIN horse h ON h.id = cl.horse_id

    UNION ALL

    -- 6. Owner-authored notes — PUBLIC ONES ONLY.
    --    p.visibility = 'public' is the line that keeps a
    --    followers-only note off the open internet; RLS is not doing
    --    it for us inside a DEFINER function. See the header.
    SELECT
      p.id,
      'note',
      LEFT(p.content, 80),
      p.content,
      p.created_at::date,
      '{}'::jsonb,
      p.created_at,
      p.author_id,
      'posts'
    FROM public.posts p
    JOIN horse h ON h.id = p.horse_id
    WHERE p.parent_id IS NULL
      AND p.author_id = h.owner_id
      AND p.visibility = 'public'

    UNION ALL

    -- 7. MHH titles (already anon-readable via horse_titles, 159)
    SELECT
      ht.id,
      'title_granted',
      'Title earned: ' || CASE ht.title_code
                            WHEN 'CH'  THEN 'Champion'
                            WHEN 'ROM' THEN 'Register of Merit'
                            WHEN 'SUP' THEN 'Superior'
                            ELSE ht.title_code END,
      h.custom_name || ' earned the MHH ' || CASE ht.title_code
                            WHEN 'CH'  THEN 'Champion (CH)'
                            WHEN 'ROM' THEN 'Register of Merit (ROM)'
                            WHEN 'SUP' THEN 'Superior (SUP)'
                            ELSE ht.title_code END || ' title.',
      ht.granted_at::date,
      jsonb_build_object('title_code', ht.title_code, 'evidence', ht.evidence),
      ht.granted_at,
      h.owner_id,
      'horse_titles'
    FROM public.horse_titles ht
    JOIN horse h ON h.id = ht.horse_id
  ),

  -- Aliases resolved here: users has no anon SELECT policy, so a
  -- second query from the client would come back empty. Only the
  -- alias crosses — never the email, the full name or the row.
  enriched AS (
    SELECT
      jsonb_build_object(
        'source_id',    e.source_id,
        'event_type',   e.event_type,
        'title',        e.title,
        'description',  e.description,
        'event_date',   e.event_date,
        'metadata',     e.metadata,
        'is_public',    true,
        'created_at',   e.created_at,
        'user_id',      e.user_id,
        'user_alias',   COALESCE(u.alias_name, 'Unknown'),
        'source_table', e.source_table
      ) AS row_json,
      e.event_date,
      e.created_at
    FROM events e
    LEFT JOIN public.users u ON u.id = e.user_id
  ),

  -- Bounded: this is an anon-callable endpoint, so the payload has a
  -- ceiling. Newest first, the same order getHoofprint() renders.
  capped AS (
    SELECT en.row_json, en.event_date, en.created_at
    FROM enriched en
    ORDER BY en.event_date DESC NULLS LAST, en.created_at DESC
    LIMIT 200
  ),

  -- The chain of custody, oldest first — the shape the timeline
  -- component's "→" chain expects.
  chain AS (
    SELECT
      jsonb_build_object(
        'id',               oh.id,
        'owner_alias',      oh.owner_alias,
        'owner_id',         oh.owner_id,
        'acquired_at',      oh.acquired_at,
        'released_at',      oh.released_at,
        'acquisition_type', oh.acquisition_type,
        'sale_price',       CASE WHEN oh.is_price_public THEN oh.sale_price ELSE NULL END,
        'is_price_public',  COALESCE(oh.is_price_public, false),
        'notes',            oh.notes
      ) AS row_json,
      oh.acquired_at
    FROM public.horse_ownership_history oh
    JOIN horse h ON h.id = oh.horse_id
  )

  -- Driven off `horse`, so a private, missing or deleted horse
  -- returns ZERO ROWS rather than an empty-but-present result. The
  -- caller renders nothing either way; the distinction matters for
  -- anyone reading this in psql.
  SELECT
    COALESCE(
      (SELECT jsonb_agg(c.row_json ORDER BY c.event_date DESC NULLS LAST, c.created_at DESC)
         FROM capped c),
      '[]'::jsonb
    ) AS timeline,
    COALESCE(
      (SELECT jsonb_agg(ch.row_json ORDER BY ch.acquired_at ASC) FROM chain ch),
      '[]'::jsonb
    ) AS ownership,
    COALESCE(h.life_stage, 'completed') AS life_stage
  FROM horse h;
$$;

COMMENT ON FUNCTION public.get_public_hoofprint(UUID) IS
  'The logged-out half of the Hoofprint. Returns the provenance timeline and chain of custody for a PUBLIC, non-deleted horse — creation, transfers, show results, customization, public owner notes and titles — with aliases resolved inline. Excludes condition history (authenticated-only per 092) and followers-only notes (re-checked here because SECURITY DEFINER bypasses the RLS that normally enforces it). Prices appear only where the seller marked them public. Mirrors get_public_passport (135): guarded before it reads, explicit field lists, no SELECT *.';

REVOKE ALL ON FUNCTION public.get_public_hoofprint(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_hoofprint(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- Migration 177 complete — get_public_hoofprint().
--
-- After applying: run `npm run gen-types`. Until then AnonPassport
-- calls it through an untyped cast and renders nothing on
-- 42883 / PGRST202, exactly like the show-records section does for
-- migration 146.
--
-- Verify:
--   1. As anon (anon key, no session):
--        SELECT * FROM get_public_hoofprint('<public horse uuid>');
--      → one row; timeline non-empty; ownership is the chain.
--   2. The guard:
--        SELECT * FROM get_public_hoofprint('<private horse uuid>');
--      → zero rows. Same for an unlisted horse and a deleted one.
--   3. The line that matters — as the horse's owner, post a note with
--      visibility 'followers', then re-run (1) as anon:
--        → the followers-only note is ABSENT from timeline, while the
--          member passport still shows it to a follower.
--   4. Price privacy: a transfer with is_price_public = false shows
--      "sale_price": null in both timeline metadata and ownership.
-- ══════════════════════════════════════════════════════════════
