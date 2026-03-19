-- ============================================================
-- Migration 095: Show System Polish
-- ============================================================
-- Fixes:
-- 1. Expert-judged shows preserve manually assigned placings
--    (close_virtual_show no longer overwrites them with vote-based rankings)
-- 2. Enriches show_records with judge metadata columns
-- ============================================================

-- ── Step 1: Enrich show_records with judge metadata ──

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_notes TEXT;
COMMENT ON COLUMN show_records.judge_notes IS 'Private judge notes or critique for the entry.';

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS total_class_entries INT;
COMMENT ON COLUMN show_records.total_class_entries IS 'Number of entries in this specific class (vs total show entries).';

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_user_id UUID REFERENCES auth.users(id);
COMMENT ON COLUMN show_records.judge_user_id IS 'The user who judged/placed this entry (for expert-judged shows).';


-- ── Step 2: Replace close_virtual_show() to respect expert judging ──

CREATE OR REPLACE FUNCTION public.close_virtual_show(p_event_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event RECORD;
  v_entry RECORD;
  v_rank INTEGER := 0;
  v_records_created INTEGER := 0;
  v_total_entries INTEGER;
  v_judging_method TEXT;
BEGIN
  SELECT id, name, created_by, event_type, show_status, starts_at, judging_method
  INTO v_event FROM public.events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  IF v_event.created_by != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the event creator can close the show');
  END IF;
  IF v_event.show_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already closed');
  END IF;

  v_judging_method := COALESCE(v_event.judging_method, 'community_vote');

  UPDATE public.events SET show_status = 'closed' WHERE id = p_event_id;

  SELECT count(*) INTO v_total_entries
  FROM public.event_entries WHERE event_id = p_event_id AND entry_type = 'entered';

  IF v_judging_method = 'expert_judge' THEN
    -- ══════════════════════════════════════════════════════════
    -- EXPERT-JUDGED: use pre-assigned placings from saveExpertPlacings()
    -- Only generate show_records for entries that already have a placing
    -- Do NOT overwrite manual placings with vote-based rankings
    -- ══════════════════════════════════════════════════════════
    FOR v_entry IN
      SELECT ee.id, ee.horse_id, ee.user_id, ee.placing, ee.class_name
      FROM public.event_entries ee
      WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered' AND ee.placing IS NOT NULL
    LOOP
      -- Check for existing show_record to avoid duplicates
      IF NOT EXISTS (
        SELECT 1 FROM public.show_records
        WHERE horse_id = v_entry.horse_id AND show_name = v_event.name AND "placing" = v_entry.placing
      ) THEN
        INSERT INTO public.show_records (
          horse_id, user_id, show_name, show_date, "placing", division,
          show_type, class_name, total_entries, verification_tier
        ) VALUES (
          v_entry.horse_id, v_entry.user_id, v_event.name,
          v_event.starts_at::date, v_entry.placing, v_entry.class_name,
          'photo_mhh', v_entry.class_name, v_total_entries, 'mhh_auto'
        );
        v_records_created := v_records_created + 1;
      END IF;
    END LOOP;
  ELSE
    -- ══════════════════════════════════════════════════════════
    -- COMMUNITY VOTE: rank by votes, assign placings
    -- ══════════════════════════════════════════════════════════
    FOR v_entry IN
      SELECT ee.id, ee.horse_id, ee.user_id, ee.votes_count, ee.class_name
      FROM public.event_entries ee
      WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered'
      ORDER BY ee.votes_count DESC, ee.created_at ASC
    LOOP
      v_rank := v_rank + 1;

      UPDATE public.event_entries SET "placing" =
        CASE v_rank
          WHEN 1 THEN '1st'
          WHEN 2 THEN '2nd'
          WHEN 3 THEN '3rd'
          ELSE v_rank || 'th'
        END
      WHERE id = v_entry.id;

      IF v_rank <= 10 THEN
        INSERT INTO public.show_records (
          horse_id, user_id, show_name, show_date, "placing", division,
          show_type, class_name, total_entries, verification_tier
        ) VALUES (
          v_entry.horse_id, v_entry.user_id, v_event.name,
          v_event.starts_at::date,
          CASE v_rank
            WHEN 1 THEN '1st' WHEN 2 THEN '2nd' WHEN 3 THEN '3rd'
            ELSE v_rank || 'th'
          END,
          v_entry.class_name,
          'photo_mhh', v_entry.class_name, v_total_entries, 'mhh_auto'
        );
        v_records_created := v_records_created + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entries_ranked', CASE WHEN v_judging_method = 'expert_judge' THEN v_records_created ELSE v_rank END,
    'records_created', v_records_created,
    'judging_method', v_judging_method
  );
END;
$$;
