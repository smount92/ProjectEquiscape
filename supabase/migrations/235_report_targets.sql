-- ============================================================
-- 235: members can report every kind of content
--
-- Release 2 (2026-10), tickets MHH-019 and MHH-025, with the fixes from
-- the Release 2 moderation review.
--
-- Until now only horse pages had a Report button, and the reports table
-- accepted five kinds of thing: post, horse, user, comment and message.
-- The button now sits on show entries and on Help ID requests and
-- suggestions too, so the table must accept those three as well.
--
-- Nothing else changes for reports: a market listing is reported as its
-- horse (the passport is the listing), and barn threads and replies are
-- posts and comments, as they always were.
--
-- It also lets a report card take content down (MHH-025) without deleting
-- anything, and makes each take-down stick:
--
--   2. Posts (feed posts, replies, barn threads and their replies) and
--      Help ID requests and suggestions get a hidden_at stamp. A row
--      policy makes a hidden row invisible to every member and visitor,
--      its author included; the row itself stays, so a mistake can be
--      undone by clearing hidden_at.
--   3. A message removed by a moderator (messages.deleted_at, 173) can no
--      longer be restored or faked by either side of the conversation.
--   4. A horse made private by a moderator is stamped
--      (user_horses.moderation_hidden_at), and its owner can't make it
--      public or put it up for sale again while the stamp is there.
--   5. A show entry scratched by a moderator is stamped
--      (show_class_entries.moderation_scratched_at), and the same horse
--      can't be entered in the same class again.
--   6. The logged-out passport's history (get_public_hoofprint, 177)
--      leaves out hidden notes.
--   7. Hidden posts take no new replies or likes, and a hidden reply
--      stops counting in its post's reply count.
--
-- Before this is pasted, reporting a show entry or a Help ID post says
-- "not switched on yet", and "Hide" on a report card says to paste this;
-- a horse or show entry take-down still works, without the stamp.
-- Everything else works as before.
--
-- Undoing a take-down stays a job for the SQL editor: clear hidden_at,
-- deleted_at, moderation_hidden_at (and set the horse's visibility) or
-- moderation_scratched_at. The SQL editor has no member session, so the
-- guards below let it through.
--
-- Safe to paste twice.
-- ============================================================

-- ── 1. What can be reported ───────────────────────────────────
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
ALTER TABLE public.user_reports ADD CONSTRAINT user_reports_target_type_check
  CHECK (target_type IN (
    'post', 'comment', 'horse', 'user', 'message',
    'show_entry', 'id_request', 'id_suggestion'
  ));

-- ── 2. Hiding, never deleting ─────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_by UUID; -- no FK: see 239
ALTER TABLE public.id_requests ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.id_requests ADD COLUMN IF NOT EXISTS hidden_by UUID; -- no FK: see 239
ALTER TABLE public.id_suggestions ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.id_suggestions ADD COLUMN IF NOT EXISTS hidden_by UUID; -- no FK: see 239

COMMENT ON COLUMN public.posts.hidden_at IS
  'Set when the site team takes a reported post down. Hidden rows are invisible to members (posts_not_hidden policy); clear it to restore.';
COMMENT ON COLUMN public.id_requests.hidden_at IS
  'Set when the site team takes a reported Help ID request down. Clear it to restore.';
COMMENT ON COLUMN public.id_suggestions.hidden_at IS
  'Set when the site team takes a reported Help ID suggestion down. Clear it to restore.';

-- RESTRICTIVE policies are ANDed with the existing ones, so nothing the
-- current policies allow is widened, and they don't need restating.
-- The service role (the admin console) is not subject to RLS and still
-- sees hidden rows. Members can't clear the stamp either: an update must
-- see the row and must leave it unhidden.
DROP POLICY IF EXISTS "posts_not_hidden" ON public.posts;
CREATE POLICY "posts_not_hidden" ON public.posts
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "posts_hidden_stay_hidden" ON public.posts;
CREATE POLICY "posts_hidden_stay_hidden" ON public.posts
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

DROP POLICY IF EXISTS "id_requests_not_hidden" ON public.id_requests;
CREATE POLICY "id_requests_not_hidden" ON public.id_requests
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "id_requests_hidden_stay_hidden" ON public.id_requests;
CREATE POLICY "id_requests_hidden_stay_hidden" ON public.id_requests
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

DROP POLICY IF EXISTS "id_suggestions_not_hidden" ON public.id_suggestions;
CREATE POLICY "id_suggestions_not_hidden" ON public.id_suggestions
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (hidden_at IS NULL);
DROP POLICY IF EXISTS "id_suggestions_hidden_stay_hidden" ON public.id_suggestions;
CREATE POLICY "id_suggestions_hidden_stay_hidden" ON public.id_suggestions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (hidden_at IS NULL) WITH CHECK (hidden_at IS NULL);

-- ── 3. A removed message stays removed ────────────────────────
-- messages_update (173) lets either side of a conversation update any
-- row in it (that is how "mark as read" works), and messages_guard (173)
-- said what may move but not deleted_at. So either side could clear a
-- moderator's removal, or stamp the other side's message "removed by a
-- moderator". Members never set deleted_at themselves (there is no
-- unsend); only the take-down does, through the service role, which has
-- no member session.
--
-- 173's body exactly, SECURITY INVOKER and search_path kept, plus the
-- deleted_at check. The trigger (trg_messages_guard) already points here.
CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  -- Service context (SQL editor, service role, crons): no user session,
  -- so the per-user rules below do not apply — this is how the backfill
  -- below runs at all. RLS keeps clients out.
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  -- Identity is fixed. A message cannot change hands or threads.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A message cannot be re-attributed or moved.';
  END IF;

  -- Removal is the site team's (235). Nobody in the conversation can
  -- remove a message or bring a removed one back.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Only the site team can remove a message or restore a removed one.';
  END IF;

  -- Deal events are the record. Nobody edits them, including their author.
  IF OLD.kind NOT IN ('chat', 'photo') THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      RAISE EXCEPTION 'This entry is part of the deal record and cannot be edited.';
    END IF;
  ELSE
    -- Chat: only the author may change their own words, and doing so
    -- stamps edited_at so the transcript stays honest.
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      IF v_uid IS DISTINCT FROM OLD.sender_id THEN
        RAISE EXCEPTION 'You cannot edit someone else''s message.';
      END IF;
      IF NEW.kind NOT IN ('chat', 'photo') THEN
        RAISE EXCEPTION 'A chat message cannot be turned into a deal entry.';
      END IF;
      NEW.edited_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. A horse made private by a moderator stays private ──────
-- The take-down makes the horse private and ends its listing. Without a
-- stamp its owner could simply set it Public or For Sale again. While
-- moderation_hidden_at is set, a member can't make the horse non-private,
-- list it, or touch the stamp. Everything else on the horse (its name,
-- photos, a transfer to a new owner) works as before, and horses without
-- the stamp are untouched.
--
-- The trigger is named so it fires after trg_sync_visibility (109), which
-- copies is_public into visibility: setting is_public = true is refused
-- the same as setting visibility = 'public'.
ALTER TABLE public.user_horses ADD COLUMN IF NOT EXISTS moderation_hidden_at TIMESTAMPTZ;
ALTER TABLE public.user_horses ADD COLUMN IF NOT EXISTS moderation_hidden_by UUID; -- no FK: see 239

COMMENT ON COLUMN public.user_horses.moderation_hidden_at IS
  'Set when the site team makes a reported horse private. While set, the owner cannot make it public or list it (trg_user_horses_moderation_guard). Clear it, from the SQL editor, to lift the hold.';

CREATE OR REPLACE FUNCTION public.user_horses_moderation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Service context (the take-down, the SQL editor): no member session.
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;

  IF NEW.moderation_hidden_at IS DISTINCT FROM OLD.moderation_hidden_at
     OR NEW.moderation_hidden_by IS DISTINCT FROM OLD.moderation_hidden_by THEN
    RAISE EXCEPTION 'This horse was made private by a moderator. Contact us to ask about it.';
  END IF;

  IF OLD.moderation_hidden_at IS NOT NULL AND (
       (NEW.visibility IS DISTINCT FROM 'private' AND NEW.visibility IS DISTINCT FROM OLD.visibility)
    OR (NEW.is_public AND NEW.is_public IS DISTINCT FROM OLD.is_public)
    OR (NEW.trade_status IN ('For Sale', 'Open to Offers') AND NEW.trade_status IS DISTINCT FROM OLD.trade_status)
  ) THEN
    RAISE EXCEPTION 'This horse was made private by a moderator. Contact us to ask about it.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_horses_moderation_guard ON public.user_horses;
CREATE TRIGGER trg_user_horses_moderation_guard
  BEFORE UPDATE ON public.user_horses
  FOR EACH ROW EXECUTE FUNCTION public.user_horses_moderation_guard();

-- ── 5. An entry scratched by a moderator stays scratched ──────
-- Scratched rows are history and a re-entry is a fresh row (117), so a
-- moderator's scratch could be undone by entering the same horse in the
-- same class again. The stamp marks the scratch as the site team's; a
-- member can't enter that horse in that class again, can't un-scratch
-- the row (hosts included), and can't set or clear the stamp.
--
-- SECURITY DEFINER so the re-entry check sees the stamped row even when
-- the entrant can't (a horse that has since changed owners).
ALTER TABLE public.show_class_entries ADD COLUMN IF NOT EXISTS moderation_scratched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.show_class_entries.moderation_scratched_at IS
  'Set when the site team scratches a reported entry. The same horse cannot be entered in the same class again (trg_show_class_entries_moderation_guard). Clear it, from the SQL editor, to allow a re-entry.';

CREATE OR REPLACE FUNCTION public.show_class_entries_moderation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Service context (the take-down, the SQL editor): no member session.
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.moderation_scratched_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only the site team can mark an entry as scratched by a moderator.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.show_class_entries e
      WHERE e.class_id = NEW.class_id
        AND e.horse_id = NEW.horse_id
        AND e.moderation_scratched_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'This horse''s entry in this class was scratched by the site team after a report, so it can''t be entered in this class again.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.moderation_scratched_at IS DISTINCT FROM OLD.moderation_scratched_at THEN
    RAISE EXCEPTION 'Only the site team can mark an entry as scratched by a moderator.';
  END IF;
  IF OLD.moderation_scratched_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This entry was scratched by the site team after a report and can''t be changed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_show_class_entries_moderation_guard ON public.show_class_entries;
CREATE TRIGGER trg_show_class_entries_moderation_guard
  BEFORE INSERT OR UPDATE ON public.show_class_entries
  FOR EACH ROW EXECUTE FUNCTION public.show_class_entries_moderation_guard();

-- ── 6. The logged-out passport leaves hidden notes out ────────
-- get_public_hoofprint (177) is SECURITY DEFINER, so the posts_not_hidden
-- policy above does not reach it, and a hidden note the owner wrote on a
-- public horse still showed on the logged-out passport. 177's body
-- exactly, grants kept, plus `AND p.hidden_at IS NULL` in branch 6.
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
    --    p.hidden_at IS NULL (235) keeps a note the site team took
    --    down off it too, for the same reason.
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
      AND p.hidden_at IS NULL

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
  'The logged-out half of the Hoofprint. Returns the provenance timeline and chain of custody for a PUBLIC, non-deleted horse — creation, transfers, show results, customization, public owner notes and titles — with aliases resolved inline. Excludes condition history (authenticated-only per 092), followers-only notes and notes hidden by the site team (re-checked here because SECURITY DEFINER bypasses the RLS that normally enforces them). Prices appear only where the seller marked them public. Mirrors get_public_passport (135): guarded before it reads, explicit field lists, no SELECT *.';

REVOKE ALL ON FUNCTION public.get_public_hoofprint(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_hoofprint(UUID) TO anon, authenticated;

-- ── 7. Hidden posts take no replies or likes ──────────────────
-- add_post_reply and toggle_post_like are SECURITY DEFINER, so the
-- posts_not_hidden policy does not stop them: a member holding a hidden
-- post's id could still reply to it or like it. 133's bodies exactly,
-- grants and revokes kept, plus the hidden_at check.

-- B4. toggle_post_like — caller must be the liker.
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 235: a post the site team took down takes no likes.
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id AND hidden_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This post is no longer available.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.likes WHERE user_id = p_user_id AND post_id = p_post_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.likes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO public.likes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- B5. add_post_reply — caller must be the author. (body from 122, incl. bumped_at)
CREATE OR REPLACE FUNCTION public.add_post_reply(
  p_parent_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_horse_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_author_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 235: a post the site team took down takes no replies.
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = p_parent_id AND hidden_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This post is no longer available.';
  END IF;

  INSERT INTO public.posts (author_id, content, parent_id, horse_id, group_id, event_id)
  VALUES (p_author_id, p_content, p_parent_id, p_horse_id, p_group_id, p_event_id)
  RETURNING id INTO v_id;

  UPDATE public.posts
  SET replies_count = replies_count + 1,
      bumped_at = now()
  WHERE id = p_parent_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) TO authenticated;

-- A hidden reply stops counting in its post's "N replies", so the count
-- matches what members see; clearing hidden_at by hand counts it again.
-- Only the service role and the SQL editor can change hidden_at (the
-- posts_hidden_stay_hidden policy), so this runs with their rights.
CREATE OR REPLACE FUNCTION public.posts_reply_count_follows_hiding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NULL; END IF;
  IF OLD.hidden_at IS NULL AND NEW.hidden_at IS NOT NULL THEN
    UPDATE public.posts SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = NEW.parent_id;
  ELSIF OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL THEN
    UPDATE public.posts SET replies_count = replies_count + 1 WHERE id = NEW.parent_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_reply_count_follows_hiding ON public.posts;
CREATE TRIGGER trg_posts_reply_count_follows_hiding
  AFTER UPDATE OF hidden_at ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_reply_count_follows_hiding();

-- After pasting: Admin › Ops shows 235 green (it probes
-- show_class_entries.moderation_scratched_at, added near the end).
-- Then run npm run gen-types.
