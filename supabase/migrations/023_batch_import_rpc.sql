-- ============================================================
-- Migration 023: Batch Import RPC
-- Provides a transactional batch-insert function for CSV import.
-- Inserts into user_horses and optionally financial_vault.
-- ============================================================

CREATE OR REPLACE FUNCTION batch_import_horses(
  p_user_id UUID,
  p_horses JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  horse_record JSONB;
  new_horse_id UUID;
  imported_count INT := 0;
BEGIN
  -- Verify the caller matches p_user_id (defense in depth)
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  FOR horse_record IN SELECT * FROM jsonb_array_elements(p_horses)
  LOOP
    -- Insert into user_horses
    INSERT INTO user_horses (
      owner_id,
      custom_name,
      finish_type,
      condition_grade,
      reference_mold_id,
      artist_resin_id,
      release_id,
      is_public,
      trade_status
    ) VALUES (
      p_user_id,
      horse_record->>'custom_name',
      COALESCE(horse_record->>'finish_type', 'OF'),
      COALESCE(horse_record->>'condition_grade', 'Not Graded'),
      NULLIF(horse_record->>'reference_mold_id', ''),
      NULLIF(horse_record->>'artist_resin_id', ''),
      NULLIF(horse_record->>'release_id', ''),
      false,
      'Not for Sale'
    )
    RETURNING id INTO new_horse_id;

    -- Insert into financial_vault if price data exists
    IF (horse_record->>'purchase_price') IS NOT NULL
       OR (horse_record->>'estimated_value') IS NOT NULL THEN
      INSERT INTO financial_vault (
        horse_id,
        purchase_price,
        estimated_current_value
      ) VALUES (
        new_horse_id,
        NULLIF(horse_record->>'purchase_price', '')::NUMERIC,
        NULLIF(horse_record->>'estimated_value', '')::NUMERIC
      );
    END IF;

    imported_count := imported_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'imported', imported_count);
END;
$$;
