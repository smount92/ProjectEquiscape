-- ============================================================
-- 234: a member's default visibility for new horses
--
-- Release 1 (2026-10), ticket MHH-005.
--
-- Settings has long offered "new horses are public", saved in
-- users.default_horse_public, but no add path ever read it: a member who
-- turned it off still got public horses. The fix makes the setting do
-- what it says and gives it the same three choices every horse has:
-- Public, Unlisted, Private. Add Horse, Quick Add and CSV import start
-- from it; the member can still change any one horse.
--
-- Existing choices carry over: "public" stays Public; switched off becomes
-- Private. default_horse_public is kept (older code reads it) and the app
-- writes both until a later cleanup.
--
-- Safe to paste twice.
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_horse_visibility TEXT;

UPDATE public.users
SET default_horse_visibility = CASE WHEN default_horse_public = false THEN 'private' ELSE 'public' END
WHERE default_horse_visibility IS NULL;

ALTER TABLE public.users ALTER COLUMN default_horse_visibility SET DEFAULT 'public';
ALTER TABLE public.users ALTER COLUMN default_horse_visibility SET NOT NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_default_horse_visibility_check;
ALTER TABLE public.users ADD CONSTRAINT users_default_horse_visibility_check
  CHECK (default_horse_visibility IN ('public', 'unlisted', 'private'));

COMMENT ON COLUMN public.users.default_horse_visibility IS
  'Where a new horse starts: public, unlisted or private (Settings). Add Horse, Quick Add and CSV import read it.';

-- users has column-level SELECT grants (133); a new column must be granted.
-- The member's own default is nobody else's business, so not to anon.
GRANT SELECT (default_horse_visibility) ON public.users TO authenticated;

-- ── CSV import takes the same three choices ───────────────────
-- batch_import_horses_v3 is v2 (migration 144) with one change: it takes a
-- visibility ('public' | 'unlisted' | 'private') instead of a public/private
-- flag, so an import can start Unlisted like any other new horse. v2 stays
-- for code that has not moved yet. Generated from 144's text; only the
-- name, the parameter, its check and the two visibility values differ.

CREATE OR REPLACE FUNCTION public.batch_import_horses_v3(
    rows JSONB,
    p_visibility TEXT DEFAULT 'public'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID;
    v_row JSONB;
    v_row_number INT;
    v_index INT := 0;
    v_name TEXT;
    v_finish TEXT;
    v_condition TEXT;
    v_notes TEXT;
    v_purchase_raw TEXT;
    v_estimated_raw TEXT;
    v_purchase NUMERIC;
    v_estimated NUMERIC;
    v_catalog_raw TEXT;
    v_catalog UUID;
    v_horse_id UUID;
    v_inserted INT := 0;
    v_errors JSONB := '[]'::jsonb;
    v_visibility TEXT := COALESCE(p_visibility, 'public');
BEGIN
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF v_visibility NOT IN ('public', 'unlisted', 'private') THEN
        RAISE EXCEPTION 'Visibility must be public, unlisted or private.';
    END IF;

    IF rows IS NULL OR jsonb_typeof(rows) <> 'array' THEN
        RAISE EXCEPTION 'rows must be a JSON array.';
    END IF;

    IF jsonb_array_length(rows) > 1000 THEN
        RAISE EXCEPTION 'Imports are limited to 1000 rows per batch. Split your file and try again.';
    END IF;

    FOR v_row IN SELECT * FROM jsonb_array_elements(rows)
    LOOP
        v_index := v_index + 1;
        -- The client sends the user's spreadsheet row number (header =
        -- row 1, first data row = row 2) so errors point at the row the
        -- user actually sees. Fall back to the array position. Guarded
        -- cast (this runs OUTSIDE the per-row exception block — it must
        -- never itself throw, or one malformed row aborts the batch).
        v_row_number := CASE
            WHEN COALESCE(v_row->>'row_number', '') ~ '^[0-9]{1,9}$'
            THEN (v_row->>'row_number')::INT
            ELSE v_index
        END;
        v_name := NULLIF(btrim(COALESCE(v_row->>'custom_name', '')), '');

        BEGIN
            -- ── Validate: name ────────────────────────────────────
            IF v_name IS NULL THEN
                RAISE EXCEPTION 'Name is required — this row has no name.';
            END IF;
            -- Length guards: the server action caps these via zod, but a
            -- direct RPC caller must not get to stuff megabytes of text
            -- through a DEFINER bulk write (user_horses columns are TEXT).
            IF char_length(v_name) > 300 THEN
                RAISE EXCEPTION 'Name is too long (max 300 characters).';
            END IF;

            -- ── Validate: finish type (the enum that used to nuke
            --    whole imports). Empty defaults to OF. ─────────────
            v_finish := COALESCE(NULLIF(btrim(COALESCE(v_row->>'finish_type', '')), ''), 'OF');
            IF v_finish NOT IN ('OF', 'Custom', 'Artist Resin') THEN
                RAISE EXCEPTION 'Finish Type must be OF, Custom, or Artist Resin — got ''%''.', v_finish;
            END IF;

            v_condition := COALESCE(NULLIF(btrim(COALESCE(v_row->>'condition_grade', '')), ''), 'Not Graded');
            IF char_length(v_condition) > 100 THEN
                RAISE EXCEPTION 'Condition is too long (max 100 characters).';
            END IF;
            v_notes := NULLIF(btrim(COALESCE(v_row->>'notes', '')), '');
            IF v_notes IS NOT NULL AND char_length(v_notes) > 2000 THEN
                RAISE EXCEPTION 'Notes are too long (max 2000 characters).';
            END IF;

            -- ── Validate: prices (tolerant — strip $, commas, spaces) ──
            v_purchase_raw := NULLIF(regexp_replace(COALESCE(v_row->>'purchase_price', ''), '[$,[:space:]]', '', 'g'), '');
            IF v_purchase_raw IS NOT NULL AND v_purchase_raw !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
                RAISE EXCEPTION 'Purchase Price must be a number — got ''%''.', btrim(v_row->>'purchase_price');
            END IF;
            v_purchase := v_purchase_raw::NUMERIC;
            IF v_purchase IS NOT NULL AND v_purchase < 0 THEN
                RAISE EXCEPTION 'Purchase Price cannot be negative — got ''%''.', btrim(v_row->>'purchase_price');
            END IF;

            v_estimated_raw := NULLIF(regexp_replace(COALESCE(v_row->>'estimated_value', ''), '[$,[:space:]]', '', 'g'), '');
            IF v_estimated_raw IS NOT NULL AND v_estimated_raw !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
                RAISE EXCEPTION 'Estimated Value must be a number — got ''%''.', btrim(v_row->>'estimated_value');
            END IF;
            v_estimated := v_estimated_raw::NUMERIC;
            IF v_estimated IS NOT NULL AND v_estimated < 0 THEN
                RAISE EXCEPTION 'Estimated Value cannot be negative — got ''%''.', btrim(v_row->>'estimated_value');
            END IF;

            -- ── Validate: catalog link ────────────────────────────
            v_catalog_raw := NULLIF(btrim(COALESCE(v_row->>'catalog_id', '')), '');
            v_catalog := NULL;
            IF v_catalog_raw IS NOT NULL THEN
                BEGIN
                    v_catalog := v_catalog_raw::UUID;
                EXCEPTION WHEN OTHERS THEN
                    RAISE EXCEPTION 'Reference link is not valid — re-match this row and try again.';
                END;
                IF NOT EXISTS (SELECT 1 FROM public.catalog_items ci WHERE ci.id = v_catalog) THEN
                    RAISE EXCEPTION 'Reference link points to a catalog entry that no longer exists — re-match this row.';
                END IF;
            END IF;

            -- ── Insert (owner, category, trade status pinned) ─────
            INSERT INTO public.user_horses (
                owner_id,
                custom_name,
                finish_type,
                condition_grade,
                catalog_id,
                asset_category,
                public_notes,
                is_public,
                visibility,
                trade_status
            ) VALUES (
                v_user,
                v_name,
                v_finish::public.finish_type,
                v_condition,
                v_catalog,
                'model',
                v_notes,
                v_visibility = 'public',
                v_visibility,
                'Not for Sale'
            )
            RETURNING id INTO v_horse_id;

            IF v_purchase IS NOT NULL OR v_estimated IS NOT NULL THEN
                INSERT INTO public.financial_vault (
                    horse_id,
                    purchase_price,
                    estimated_current_value
                ) VALUES (
                    v_horse_id,
                    v_purchase,
                    v_estimated
                );
            END IF;

            v_inserted := v_inserted + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Per-row failure: record it and keep going. SQLERRM is our
            -- own plain-English message for the validations above; for
            -- anything unexpected it is still the most truthful thing
            -- we can show.
            v_errors := v_errors || jsonb_build_array(jsonb_build_object(
                'row_number', v_row_number,
                'name', COALESCE(v_name, 'Unnamed row'),
                'message', SQLERRM
            ));
        END;
    END LOOP;

    RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors);
END;
$$;

-- Authenticated members only — never anon, never PUBLIC.
REVOKE ALL ON FUNCTION public.batch_import_horses_v3(JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.batch_import_horses_v3(JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.batch_import_horses_v3(JSONB, TEXT) TO authenticated;
