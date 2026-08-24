-- ============================================================
-- 192: Curator badge descriptions — match the recalibrated ladder
--
-- The curator thresholds were recalibrated in code on 2026-08-23
-- (src/lib/catalog/corrections.ts): contributor 1, bronze 5, silver 10,
-- gold 50. The old bars (10/50/200) were set against an imagined
-- community — after months live, the top contributor had 30 approvals,
-- so the ladder had never fired once.
--
-- The badges table still describes the OLD bars ("Had 10 catalog
-- suggestions approved", 50, 200), and those descriptions render on
-- member profiles via the Trophy Case. A badge that misstates how it is
-- earned is worse than no description: it tells the one group reading it
-- — active contributors sizing up the next rank — a number that is
-- wrong by 4x.
--
-- Descriptions also now say what the rank DOES, not only how it is
-- earned, because the power (instant application of factual fixes) is
-- the actual reason to climb.
-- ============================================================

UPDATE badges SET description =
    'Had your first catalog suggestion approved. Every entry in the Registry got better because someone like you spoke up.'
WHERE id = 'catalog_contributor';

UPDATE badges SET description =
    'Had 5 catalog suggestions approved. The Registry remembers who does the work.'
WHERE id = 'bronze_curator';

UPDATE badges SET description =
    'Had 10 catalog suggestions approved. Your factual fixes — colour, years, run details, prices — now apply instantly, no review queue.'
WHERE id = 'silver_curator';

UPDATE badges SET description =
    'Had 50 catalog suggestions approved. Every correction you make applies instantly. The catalog is partly yours now.'
WHERE id = 'gold_curator';

-- Verify:
--   SELECT id, description FROM badges WHERE id LIKE '%curator%' OR id = 'catalog_contributor';
--   The numbers must read 1 (implicit), 5, 10, 50 — matching
--   CONTRIBUTOR/BRONZE/SILVER/GOLD_THRESHOLD in src/lib/catalog/corrections.ts.
