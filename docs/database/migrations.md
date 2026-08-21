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
| 018 | `018_hoofprint.sql` | Hoofprint provenance view and ownership history |
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
| 092 | `092_supabase_linter_fixes.sql` | Security & performance hardening: views → `security_invoker`, `SET search_path = ''` on 19 SECURITY DEFINER functions, `pg_trgm` → extensions schema, RLS initplan wraps, merged permissive policies, 6 duplicate indexes dropped, 28 FK indexes added |
| 093 | `093_bugfixes_delete_policies.sql` | Missing RLS DELETE policies: `id_requests` (owner deletes own), `id_suggestions` (owner deletes own), `posts` (author deletes own — guard) |
| 094 | `094_judge_entry_update_policy.sql` | Expert judging RLS fix: replaces owner-only UPDATE policy on `event_entries` with one allowing entry owner, event creator, AND assigned judges |
| 095 | `095_show_polish.sql` | Show polish: entry preview, smart class browser, results podium, show history widget |
| 096 | `096_notification_deep_links.sql` | `link_url` column on notifications — clickable deep links to referenced items |
| 097 | `097_backfill_missing_tables.sql` | Backfill missing tables and columns for schema completeness |
| 098 | `098_soft_delete_horses.sql` | Tombstone soft-delete for `user_horses` (is_tombstone flag) |
| 099 | `099_commerce_locks.sql` | Atomic commerce RPCs: `claim_transfer_atomic`, `make_offer_atomic` |
| 100 | `100_fuzzy_search_rpc.sql` | `pg_trgm` fuzzy search RPC for catalog and user search |
| 101 | `101_trusted_sellers.sql` | Trusted seller materialized view + seller verification |
| 102 | `102_pro_rls.sql` | Pro tier RLS functions for freemium feature gating |
| 103 | `103_core_monetization.sql` | Core monetization: promoted listings, ISO bounties, purchased reports, Studio Pro tables |
| 104 | `104_exhibitor_number.sql` | Exhibitor number on users, show tag numbering system |
| 105 | `105_multi_class_entry.sql` | Multi-class entry support for shows, per-class entry caps |
| 106 | `106_discover_group_fixes.sql` | Discover + group member-count fixes |
| 107 | `107_discover_visibility_fix.sql` | Fix `discover_users_view` to use the `visibility` column |
| 108 | `108_rls_safe_horse_counting.sql` | RLS-safe horse counting |
| 109 | `109_fix_visibility_drift.sql` | Fix `is_public` / `visibility` drift |
| 110 | `110_fix_catalog_fuzzy_rpc.sql` | Update `search_catalog_fuzzy` RPC |
| 111 | `111_chat_attachments_bucket.sql` | `chat-attachments` storage bucket + RLS |
| 112 | `112_photo_short_slugs.sql` | Friendly photo URLs (short slugs) |
| 113 | `113_asset_category_other_model.sql` | Asset category expansion (other model) |
| 114 | `114_fix_savanna_dial_scale.sql` | Fix scale for Indian Pony mold |
| 115 | `115_vault_is_trade.sql` | Add `is_trade` flag to `financial_vault` |
| 116 | `116_platform_generated_verification_tier.sql` | Allow `platform_generated` verification tier |
| 117 | `117_shows_domain.sql` | Shows Domain — schema (Phase B of show rebuild) |
| 118 | `118_shows_domain_rls.sql` | Shows Domain — RLS + helper functions |
| 119 | `119_shows_online_judging.sql` | Shows Domain — online judging (Phase E1) |
| 120 | `120_cards_safe_trade_hook.sql` | Shows Domain — safe-trade card transfer hook |
| 121 | `121_group_files_bucket.sql` | `group-files` storage bucket + RLS |
| 122 | `122_groups_forum.sql` | Groups Forum ("Notice Board") |
| 123 | `123_stable_filters.sql` | Digital Stable filter rebuild |
| 124 | `124_catalog_anon_read.sql` | Catalog reference data readable by `anon` (SELECT policy) |
| 125 | `125_catalog_facets.sql` | `get_catalog_facets()` RPC — distinct makers/scales in one round-trip |
| 126 | `126_market_prices_public_rpc.sql` | Public anon-safe read path for `mv_market_prices` (`get_market_rows`) |
| 127 | `127_watermark_custom_text.sql` | Watermark: `users.watermark_text` column + `watermark_photos` default → `true` (on by default) |
| 128 | `128_catalog_material_facet.sql` | Catalog `material` facet: backfill `attributes.material` (Plastic/Resin), `get_catalog_facets()` now returns `materials` |
| 129 | `129_catalog_item_slugs.sql` | `catalog_items.maker_slug`/`slug` + `catalog_slugify()` and a self-slug trigger for `/reference/[maker]/[slug]` |
| 130 | `130_reference_wanted_rpcs.sql` | `count_catalog_collectors()`, `count_catalog_wanters()`, `notify_catalog_owners_of_demand()` — Wanted demand engine |
| 131 | `131_reference_photo_optout.sql` | `users.show_photos_on_reference` opt-out + `get_catalog_reference_photos()` gallery RPC |
| 132 | `132_catalog_listings_rpc.sql` | `get_catalog_listings()` — anon-safe "for sale now" horses plus seller alias |
| 133 | `133_security_hardening.sql` | `users` column-level grants (table SELECT revoked), `auth.uid()` binding in offer/vote/post RPCs, demand-nudge rate limit |
| 134 | `134_catalog_stats_rpc.sql` | `get_catalog_stats()` — batched owner / want / for-sale counts for a catalog page |
| 135 | `135_public_passport_rpc.sql` | `get_public_passport()` — anon-safe public/unlisted horse passport with owner alias |
| 136 | `136_public_aliases_rpc.sql` | `get_public_aliases()` — batch `alias_name` lookup so anon show pages stop rendering "@unknown" |
| 137 | `137_reference_photos_horse_id.sql` | `get_catalog_reference_photos()` recreated with `horse_id` so gallery photos link to passports |
| 138 | `138_show_records_show_id.sql` | `show_records.show_id` FK + partial index linking trophy-case rows to their originating show |
| 139 | `139_show_hosting_ux.sql` | `shows.about_md` + new `show_fee_payments` table (host-marked entry-fee checklist) |
| 140 | `140_show_photo_angle.sql` | Adds `'Show_Photo'` to the `angle_profile` enum for in-dialog class entry photos |
| 141 | `141_public_horse_cards_rpc.sql` | `get_public_horse_cards()` — live qualification cards on the anon public passport |
| 142 | `142_supporter_tier.sql` | `users.is_supporter`/`supporter_since`/`show_in_supporters_ledger` + write guard + `get_supporters_ledger()` |
| 143 | `143_external_shows.sql` | New `external_shows` table with submit/approve RLS + moderation guard trigger for `/calendar` |
| 144 | `144_batch_import_v2.sql` | `batch_import_horses_v2()` — per-row exception handling, Notes column, honest `is_public` |
| 145 | `145_collector_counts_public_only.sql` | `count_catalog_collectors()` and `get_catalog_stats.owner_count` now count public horses only |
| 146 | `146_public_horse_records_rpc.sql` | `get_public_horse_records()` — public-only show record lines for the anon passport |
| 147 | `147_catalog_browse_thumbs.sql` | `get_catalog_browse_thumbs()` — batched community-photo thumbnail per catalog item |
| 148 | `148_shows_v4_domain.sql` | Shows v4: `show_barred_entrants`, `horse_documents`, `users.is_suspended`, `results_published_at`, entry critiques, card void columns |
| 149 | `149_security_sweep.sql` | Storage size/MIME caps, service-role-only rate-limit RPCs, revoked PUBLIC grants, pinned `search_path` |
| 150 | `150_unlisted_visibility.sql` | Rewrites `user_horses_select` to gate on `visibility` so unlisted horses are link-viewable |
| 151 | `151_fix_entry_permission.sql` | Hotfix: `is_caller_suspended()` DEFINER helper replaces the `users.is_suspended` read in the entry INSERT policy |
| 152 | `152_market_history_rpc.sql` | `get_market_history()` — anon-safe completed-sale date/price/finish points for the Blue Book |
| 153 | `153_card_gates_stakes.sql` | `qualification_cards.class_entry_count`/`class_exhibitor_count`/`is_stakes` + recreated verify/public-card RPCs |
| 154 | `154_taxonomy_v2.sql` | Scale normalization across `catalog_items`/`allowed_scales`; `item_type` CHECK gains `factory_resin`+`china`; `get_mold_customs()` |
| 155 | `155_scale_cleanup.sql` | Second-round `catalog_items.scale` value cleanup (Pebble, Micro Mini, Unknown → NULL) |
| 156 | `156_attribution_split.sql` | `catalog_items.artist` + `catalog_items.manufacturer` columns with mechanical backfill; `maker` untouched |
| 157 | `157_browse_facets_v2.sql` | `get_catalog_facets()` gains manufacturers/artists; unifies "Stone" → "Peter Stone" for display |
| 158 | `158_scale_unknowns.sql` | Clears nine non-scale `catalog_items.scale` values (pose words, size adjectives) to NULL |
| 159 | `159_titles_engine.sql` | New `horse_titles` + `exhibitor_distinctions` tables; `v_horse_hoofprint` gains a titles UNION branch |
| 160 | `160_bulletproof_sweep.sql` | Audit sweep: fixes `soft_delete_account()`, sticky scratches, `placings_announced()` reveal gating, title/image visibility |
| 161 | `161_manufacturer_cleanup.sql` | Moves person-named `manufacturer` values to `artist`, clears placeholders, refreshes planner stats |
| 162 | `162_card_void_reissue.sql` | Replaces the `qualification_cards` unique key with `uq_qualification_cards_live` (one live card per horse/class) |
| 163 | `163_career_ledgers.sql` | New `horse_career` + `exhibitor_career` point-total ledgers with visibility-matched RLS |
| 164 | `164_class_cards_rpc.sql` | `get_class_cards()` and `get_exhibitor_card_count()` — anon-safe card reads gated on announced results |
| 165 | `165_banner_and_atomic_placings.sql` | New `announcements` table (public read of live rows, service-role writes) + `record_class_placings_atomic()` replacing delete-then-insert placing writes |
| 166 | `166_social_spine.sql` | The Paddock spine: `posts.kind` (`user`/`show_results`/`audit`) + `posts.visibility` (`public`/`followers`), `posts_select` rewritten with the audience conjunct, feed indexes, unique one-announcement-per-show index |
| 167 | `167_barns.sql` | Barns: `groups.is_private` (canonical, synced to legacy `visibility` by trigger), new `barn_join_requests` table, `barn_member_role()`/`barn_is_private()`/`barn_created_by()` helpers, membership + roster RLS rewrite |
| 168 | `168_events_rework.sql` | Events become listings for off-platform happenings — `events_event_type_check` widened (adds `external_show`, `club`; `live_show`/`photo_show` legacy read-only) + two date indexes |
| 169 | `169_market_completion.sql` | `get_market_listings()`/`get_market_listings_total()`/`get_public_favorite_count()` for anon market browse; `mv_trusted_sellers` **rebuilt** (joined `horse_transfers.status='completed'`, a value the CHECK forbids — now `'claimed'`); `discover_users_view` excludes suspended members |
| 170 | `170_art_studio.sql` | Art Studio rebuild: structured artist terms + `services` JSONB on `artist_profiles`; commission state machine columns + `commissions_status_check` (`requested→quoted→accepted→in_progress→awaiting_approval→completed→delivered`); agreement-freeze trigger; `customization_logs.commission_id`/`artist_user_id`; `financial_vault.commission_cost`; `v_artist_finished_horses` view; `stamp_finishing_artist()`, `studio_slot_usage()` |
| 171 | `171_profile_customization.sql` | `users.profile_customization` JSONB (theme, tagline, banner path, featured horses) + column grant to `anon`/`authenticated` |
| 172 | `172_commerce_bugfixes.sql` | `chk_trade_status` finally allows `'Pending Sale'` and `'Stolen/Missing'` (079 shipped the feature with no schema change); `respond_to_offer_atomic()` stops writing the phantom `transactions.updated_at` that broke declines since 099 |
| 173 | `173_deal_room.sql` | The Deal Room: `messages.kind`+`payload` mixed transcript, new `conversation_participants` (roles, unread, mute, archive) and `payment_installments` tables, `conversations.deal_terms` contract boxes + dispute columns, `deal_offer_move_atomic()`, bidirectional `are_blocked()` + block-on-send trigger, missing `WITH CHECK` repairs, lossless DM backfill |
| 175 | `175_object_metrics.sql` | Object metrics: `object_view_daily` + `site_activity_daily` rollups and the salted `object_view_scratch` (purged nightly by `cleanup_system_garbage()`); `record_object_view()`, `get_horse_view_stats()`, `metrics_entity_totals()`, `metrics_top_objects()` |

> **Note:** Migration numbers 045, 047, 049 and 051 were consolidated into adjacent migrations during the Grand Unification, and **174 is an intentional gap** — no such file exists and none should be written. Numbers run 001–175; 170 files are on disk.

## Adding New Migrations

1. Create a new file: `supabase/migrations/NNN_description.sql`
2. Use the next sequential number (currently: **176**)
3. Always include RLS policies for new tables
4. Add foreign key indexes for new FK columns
5. Test by running the SQL in Supabase Dashboard → SQL Editor

See [Adding a Migration](../guides/adding-a-migration.md) for the full guide.

---

**Next:** [Schema Overview](schema-overview.md) · [Tables](tables.md)
