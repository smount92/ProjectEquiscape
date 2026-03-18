# Migration Index

All SQL migrations are located in `supabase/migrations/` and are applied sequentially. Each migration is idempotent when applied in order.

## Timeline

| # | File | Purpose |
|---|------|---------|
| 001 | `001_initial_schema.sql` | Core tables: `users`, `user_horses`, `horse_images`, `financial_vault` |
| 002 | `002_reference_releases.sql` | Reference catalog: `catalog_items` (Breyer/Stone releases) |
| 003 | `003_community_rls.sql` | Row Level Security policies for community features |
| 004 | `004_collections.sql` | User collections system |
| 005 | `005_sculptor_search.sql` | Sculptor/artist search indexing |
| 006 | `006_contact_messages.sql` | Contact form messages table |
| 007 | `007_marketplace_wishlists.sql` | Marketplace wishlists and watchlists |
| 008 | `008_marketplace_fields.sql` | Additional marketplace fields (price, trade status) |
| 009 | `009_native_inbox.sql` | DM conversations and messages tables |
| 010 | `010_social_layer.sql` | Posts, comments, likes initial structure |
| 011 | `011_provenance_tracking.sql` | `horse_timeline` table for provenance events |
| 012 | `012_user_ratings.sql` | User ratings/reviews system |
| 013–016 | `013–016_social_expansion_p[1-4].sql` | Social features expansion (follows, activity feed, notifications) |
| 017 | `017_user_bio.sql` | User profile bio field |
| 018 | `018_hoofprint.sql` | Hoofprint™ provenance view and ownership history |
| 019 | `019_settings.sql` | User settings/preferences table |
| 020 | `020_beta_feedback.sql` | Beta user feedback collection |
| 021 | `021_indexes_and_constraints.sql` | Performance indexes and FK constraints |
| 022 | `022_performance_hardening.sql` | Query performance optimizations |
| 023 | `023_batch_import_rpc.sql` | RPC function for batch CSV import |
| 024 | `024_help_id.sql` | Help article identifiers |
| 025 | `025_parked_export.sql` | Horse parking (transfer staging) and CoA export |
| 026 | `026_condition_history.sql` | Condition grade change tracking |
| 027 | `027_transfer_rls_fix.sql` | Transfer RLS policy corrections |
| 028 | `028_art_studio.sql` | Artist profiles, commissions, commission updates |
| 029 | `029_transfer_improvements.sql` | Transfer system enhancements |
| 030 | `030_competition_engine.sql` | Competition events, divisions, classes, entries |
| 031 | `031_groups_events.sql` | Groups, group membership, community events |
| 032 | `032_rate_limiting.sql` | `rate_limits` table + `check_rate_limit` RPC |
| 033 | `033_immutable_storage.sql` | Immutable storage patterns for provenance |
| 034 | `034_tombstone_deletion.sql` | Soft delete (tombstone) for referenced records |
| 035 | `035_atomic_mutations.sql` | Atomic RPC functions for critical operations |
| 036 | `036_parked_atomic.sql` | Atomic parking/unparking operations |
| 037 | `037_alias_join_fkeys.sql` | Foreign key constraints for alias joins |
| 038 | `038_v4_patches.sql` | V4 release patches |
| 039 | `039_modern_social.sql` | Modern social system refactor |
| 040 | `040_v5_social_fixes.sql` | V5 social feature fixes |
| 041 | `041_event_enrichment.sql` | Event data enrichment |
| 042 | `042_universal_social_engine.sql` | Universal social engine consolidation |
| 043 | `043_drop_legacy_social.sql` | Legacy social table cleanup |
| 044 | `044_universal_trust_engine.sql` | Transactions + reviews (replaces ratings) |
| 046 | `046_unified_competition_engine.sql` | Unified competition/show system |
| 048 | `048_universal_catalog.sql` | Polymorphic catalog (Breyer + Stone + Artist Resins unified) |
| 050 | `050_universal_ledger.sql` | Universal ledger for financial tracking |
| 052 | `052_the_great_purge.sql` | Legacy table cleanup |
| 053 | `053_asset_expansion.sql` | Additional asset fields |
| 054 | `054_live_show_tree.sql` | Live show hierarchical structure |
| 055 | `055_market_price_guide.sql` | Blue Book: `mv_market_prices` materialized view |
| 056 | `056_integrity_sprint.sql` | Data integrity constraints |
| 057 | `057_ux_enhancements.sql` | UX-driven schema improvements |
| 058 | `058_group_enrichment.sql` | Group features expansion |
| 059 | `059_feed_quality.sql` | Activity feed quality improvements |
| 060 | `060_commerce_state_machine.sql` | Commerce state machine fields (offer_amount, paid_at, etc.) |
| 061 | `061_market_finish_split.sql` | Market price guide: finish type split |
| 062 | `062_verified_artist.sql` | Verified artist stamp on horses |
| 063 | `063_bluebook_lifestage.sql` | Blue Book life stage filtering |
| 064 | `064_expired_transfer_unpark.sql` | Auto-unpark on expired transfers |
| 065 | `065_expert_judged_shows.sql` | Expert-judged show support |
| 066 | `066_user_reports.sql` | User report/moderation system |
| 067 | `067_bundle_sale_filter.sql` | Bundle sale filtering |
| 068 | `068_system_garbage_collection.sql` | Automated cleanup of expired data |
| 069 | `069_guest_token.sql` | Guest token for non-registered commission clients |
| 070 | `070_stripped_life_stage.sql` | "Stripped" life stage option |
| 071 | `071_qa_fixes.sql` | QA-driven fixes |
| 072 | `072_show_bio_fields.sql` | Show biography fields |
| 073 | `073_show_record_details.sql` | Show record detail expansion |
| 074 | `074_currency_preference.sql` | Multi-currency preference setting |
| 075 | `075_fuzzy_purchase_date.sql` | Approximate purchase date support |
| 076 | `076_event_judges.sql` | Event judge assignments |
| 077 | `077_horse_collections_junction.sql` | Many-to-many horse ↔ collections |
| 078 | `078_public_horse_images_bucket.sql` | Public horse images storage policy |
| 079 | `079_stolen_missing_status.sql` | Stolen/missing horse flagging |
| 080 | `080_relational_pedigrees.sql` | Horse pedigree (sire/dam) relationships |
| 081 | `081_class_scale_filter.sql` | Competition class scale filtering |
| 082 | `082_show_record_class_name.sql` | Show record class name field |
| 083 | `083_show_entry_photo_caption.sql` | Show entry photo captions |
| 084 | `084_discover_tags.sql` | User discovery tags |
| 085 | `085_gamification_engine.sql` | Badges, user_badges, achievement evaluation |
| 086 | `086_hide_test_accounts.sql` | Hide test accounts from public views |
| 087 | `087_hoofprint_remove_comments.sql` | Remove visitor comments from Hoofprint view |
| 088 | `088_show_badges_toggle.sql` | Toggle badge display on profiles |
| 089 | `089_commission_wip_photos.sql` | Commission WIP photos, shipping status, Hoofprint injection |
| 091 | `091_catalog_curation.sql` | Catalog curation: `catalog_suggestions`, `catalog_suggestion_votes`, `catalog_suggestion_comments`, `catalog_changelog` tables + curator columns on `users` + `increment_approved_suggestions` RPC + curator badge seeds |

> **Note:** Migration numbers 045, 047, 049, 051, 090 are intentionally skipped (consolidated into adjacent migrations during development).

## Adding New Migrations

1. Create a new file: `supabase/migrations/NNN_description.sql`
2. Use the next sequential number (currently: **092**)
3. Always include RLS policies for new tables
4. Add foreign key indexes for new FK columns
5. Test by running the SQL in Supabase Dashboard → SQL Editor

See [Adding a Migration](../guides/adding-a-migration.md) for the full guide.

---

**Next:** [Schema Overview](schema-overview.md) · [Tables](tables.md)
