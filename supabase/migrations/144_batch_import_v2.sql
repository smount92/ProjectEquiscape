-- ══════════════════════════════════════════════════════════════
-- Migration 144: CSV batch import v2 — per-row truth
-- ══════════════════════════════════════════════════════════════
-- NUMBERING NOTE: 143 was the last migration on disk when this was
-- written. Another Wave 5a agent may take a number concurrently — if
-- we collide, the integration merger renumbers at merge (same
-- convention as 143's header).
--
-- WHY: the original batch_import_horses (023 → 056 → 092) is one big
-- transaction: a single bad row (e.g. Finish Type "Original Finish",
-- which is not in the finish_type enum) aborts the ENTIRE import with
-- a raw Postgres error, and the user's whole spreadsheet silently
-- imports nothing. It also ignores the Notes column and hard-codes
-- is_public = false, so the UI's publish checkbox was a lie.
--
-- batch_import_horses_v2:
--   * per-row exception handling — each row is its own nested
--     BEGIN/EXCEPTION block, so good rows land and bad rows come back
--     as structured errors instead of nuking the batch;
--   * plain-English error messages with the user's CSV row number
--     ("Finish Type must be OF, Custom, or Artist Resin — got
--     'Original Finish'"), never raw SQLSTATE spew where avoidable;
--   * writes Notes (user_horses.public_notes);
--   * honors p_is_public (+ keeps the paired visibility column in
--     sync, same as createHorseRecord in src/app/actions/horse.ts);
--   * tolerant price parsing ("$45.00" / "1,200" import instead of
--     erroring).
--
-- Returns JSONB: { inserted int, errors jsonb[] } where each error is
-- { row_number, name, message }.
--
-- The OLD batch_import_horses is left untouched: the client
-- feature-detects v2 and falls back to the old call (with the old
-- limitations, and says so) until this file is applied.
--
-- SECURITY (adversarial review):
--   * SECURITY DEFINER + SET search_path = '' + fully-qualified names
--     (house pattern, migrations 092/130/143).
--   * NO p_user_id parameter — the old function accepted one and
--     compared it to auth.uid(); v2 removes the parameter entirely so
--     there is nothing to spoof. Every insert is pinned to auth.uid().
--   * REVOKE from PUBLIC/anon; EXECUTE granted to authenticated only.
--   * Row payload fields are allowlisted: only custom_name,
--     finish_type (validated), condition_grade, notes, prices
--     (validated numeric), catalog_id (validated uuid) are read.
--     asset_category / trade_status / owner_id / is_for_sale CANNOT be
--     supplied by the payload — pinned server-side ('model',
--     'Not for Sale', auth.uid(), default false).
--   * Batch capped at 1000 rows so an authenticated user cannot use
--     the definer function as a bulk write amplifier.
--   * Per-row nested block = per-row atomicity: if the vault insert
--     fails after the horse insert, that row's horse insert rolls back
--     with it — no half-imported rows.
--
-- Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.batch_import_horses_v2(
    rows JSONB,
    p_is_public BOOLEAN DEFAULT true
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
BEGIN
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
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
                COALESCE(p_is_public, true),
                CASE WHEN COALESCE(p_is_public, true) THEN 'public' ELSE 'private' END,
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
REVOKE ALL ON FUNCTION public.batch_import_horses_v2(JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.batch_import_horses_v2(JSONB, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.batch_import_horses_v2(JSONB, BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 144 Complete — batch_import_horses_v2(rows, p_is_public).
-- Old batch_import_horses untouched (client falls back to it until
-- this is applied). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
