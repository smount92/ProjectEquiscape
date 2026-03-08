-- ============================================================
-- Migration 022: Performance Hardening
-- Fixes: RLS InitPlan (auth.uid() → (SELECT auth.uid())),
--        merges duplicate permissive SELECT policies,
--        adds missing FK indexes, hardens contact INSERT policy.
-- ============================================================

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  PART A: Fix RLS policies to use (SELECT auth.uid())     ║
-- ║  This prevents per-row re-evaluation of auth functions.  ║
-- ╚═══════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────
-- TABLE: users (001 + 003)
-- Merge: users_select_own + users_select_public_alias → single policy
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_select_public_alias" ON users;
CREATE POLICY "users_select"
  ON users FOR SELECT TO authenticated
  USING (true);
  -- All authenticated requests already pass through RLS; column privacy
  -- is enforced at the app layer (never SELECT full_name in public queries).

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ────────────────────────────────────────
-- TABLE: reference_molds (001)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "reference_molds_select_authenticated" ON reference_molds;
CREATE POLICY "reference_molds_select_authenticated"
  ON reference_molds FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ────────────────────────────────────────
-- TABLE: artist_resins (001)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "artist_resins_select_authenticated" ON artist_resins;
CREATE POLICY "artist_resins_select_authenticated"
  ON artist_resins FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ────────────────────────────────────────
-- TABLE: reference_releases (002)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "reference_releases_select_authenticated" ON reference_releases;
CREATE POLICY "reference_releases_select_authenticated"
  ON reference_releases FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

-- ────────────────────────────────────────
-- TABLE: user_horses (001)
-- Merge: user_horses_select_own + user_horses_select_public
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "user_horses_select_own" ON user_horses;
DROP POLICY IF EXISTS "user_horses_select_public" ON user_horses;
CREATE POLICY "user_horses_select"
  ON user_horses FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id OR is_public = true);

DROP POLICY IF EXISTS "user_horses_insert_own" ON user_horses;
CREATE POLICY "user_horses_insert_own"
  ON user_horses FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "user_horses_update_own" ON user_horses;
CREATE POLICY "user_horses_update_own"
  ON user_horses FOR UPDATE
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "user_horses_delete_own" ON user_horses;
CREATE POLICY "user_horses_delete_own"
  ON user_horses FOR DELETE
  USING ((SELECT auth.uid()) = owner_id);

-- ────────────────────────────────────────
-- TABLE: financial_vault (001)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "financial_vault_select_own" ON financial_vault;
CREATE POLICY "financial_vault_select_own"
  ON financial_vault FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "financial_vault_insert_own" ON financial_vault;
CREATE POLICY "financial_vault_insert_own"
  ON financial_vault FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "financial_vault_update_own" ON financial_vault;
CREATE POLICY "financial_vault_update_own"
  ON financial_vault FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "financial_vault_delete_own" ON financial_vault;
CREATE POLICY "financial_vault_delete_own"
  ON financial_vault FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = financial_vault.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────
-- TABLE: horse_images (001)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "horse_images_select_own" ON horse_images;
CREATE POLICY "horse_images_select"
  ON horse_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND (user_horses.owner_id = (SELECT auth.uid()) OR user_horses.is_public = true)
    )
  );

DROP POLICY IF EXISTS "horse_images_insert_own" ON horse_images;
CREATE POLICY "horse_images_insert_own"
  ON horse_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "horse_images_update_own" ON horse_images;
CREATE POLICY "horse_images_update_own"
  ON horse_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "horse_images_delete_own" ON horse_images;
CREATE POLICY "horse_images_delete_own"
  ON horse_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = horse_images.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────
-- TABLE: customization_logs (001)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "customization_logs_select_own" ON customization_logs;
CREATE POLICY "customization_logs_select"
  ON customization_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND (user_horses.owner_id = (SELECT auth.uid()) OR user_horses.is_public = true)
    )
  );

DROP POLICY IF EXISTS "customization_logs_insert_own" ON customization_logs;
CREATE POLICY "customization_logs_insert_own"
  ON customization_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "customization_logs_update_own" ON customization_logs;
CREATE POLICY "customization_logs_update_own"
  ON customization_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "customization_logs_delete_own" ON customization_logs;
CREATE POLICY "customization_logs_delete_own"
  ON customization_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────
-- TABLE: user_collections (004)
-- Merge: collections_select_own + collections_select_public
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "collections_select_own" ON user_collections;
DROP POLICY IF EXISTS "collections_select_public" ON user_collections;
CREATE POLICY "collections_select"
  ON user_collections FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.collection_id = user_collections.id
        AND user_horses.is_public = true
    )
  );

DROP POLICY IF EXISTS "collections_insert_own" ON user_collections;
CREATE POLICY "collections_insert_own"
  ON user_collections FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "collections_update_own" ON user_collections;
CREATE POLICY "collections_update_own"
  ON user_collections FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "collections_delete_own" ON user_collections;
CREATE POLICY "collections_delete_own"
  ON user_collections FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: user_wishlists (007)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own wishlist" ON user_wishlists;
CREATE POLICY "Users can view own wishlist"
  ON user_wishlists FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add to own wishlist" ON user_wishlists;
CREATE POLICY "Users can add to own wishlist"
  ON user_wishlists FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own wishlist" ON user_wishlists;
CREATE POLICY "Users can update own wishlist"
  ON user_wishlists FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete from own wishlist" ON user_wishlists;
CREATE POLICY "Users can delete from own wishlist"
  ON user_wishlists FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: conversations (009)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id);

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = buyer_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id);

-- ────────────────────────────────────────
-- TABLE: messages (009)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can send messages in own conversations" ON messages;
CREATE POLICY "Users can send messages in own conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can mark messages as read in own conversations" ON messages;
CREATE POLICY "Users can mark messages as read in own conversations"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

-- ────────────────────────────────────────
-- TABLE: horse_favorites (010)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can favorite horses" ON horse_favorites;
CREATE POLICY "Users can favorite horses"
  ON horse_favorites FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unfavorite horses" ON horse_favorites;
CREATE POLICY "Users can unfavorite horses"
  ON horse_favorites FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
-- "Anyone can view favorites" uses USING(true) — no auth.uid(), no change needed.

-- ────────────────────────────────────────
-- TABLE: horse_comments (010)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view comments on public horses" ON horse_comments;
CREATE POLICY "Anyone can view comments on public horses"
  ON horse_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id AND h.is_public = true
    )
  );

DROP POLICY IF EXISTS "Users can comment on public horses" ON horse_comments;
CREATE POLICY "Users can comment on public horses"
  ON horse_comments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id AND h.is_public = true
    )
  );

DROP POLICY IF EXISTS "Author or horse owner can delete comments" ON horse_comments;
CREATE POLICY "Author or horse owner can delete comments"
  ON horse_comments FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_comments.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────
-- TABLE: show_records (011)
-- Merge: public + own SELECT
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view show records on public horses" ON show_records;
DROP POLICY IF EXISTS "Owner can view own show records" ON show_records;
CREATE POLICY "show_records_select"
  ON show_records FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = show_records.horse_id AND h.is_public = true
    )
  );

DROP POLICY IF EXISTS "Owner can add show records" ON show_records;
CREATE POLICY "Owner can add show records"
  ON show_records FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = show_records.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can update own show records" ON show_records;
CREATE POLICY "Owner can update own show records"
  ON show_records FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner can delete own show records" ON show_records;
CREATE POLICY "Owner can delete own show records"
  ON show_records FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: horse_pedigrees (011)
-- Merge: public + own SELECT
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view pedigree on public horses" ON horse_pedigrees;
DROP POLICY IF EXISTS "Owner can view own pedigree" ON horse_pedigrees;
CREATE POLICY "horse_pedigrees_select"
  ON horse_pedigrees FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_pedigrees.horse_id AND h.is_public = true
    )
  );

DROP POLICY IF EXISTS "Owner can add pedigree" ON horse_pedigrees;
CREATE POLICY "Owner can add pedigree"
  ON horse_pedigrees FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_pedigrees.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can update own pedigree" ON horse_pedigrees;
CREATE POLICY "Owner can update own pedigree"
  ON horse_pedigrees FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner can delete own pedigree" ON horse_pedigrees;
CREATE POLICY "Owner can delete own pedigree"
  ON horse_pedigrees FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: user_ratings (012)
-- ────────────────────────────────────────
-- "Anyone can view ratings" uses USING(true) — no change needed.

DROP POLICY IF EXISTS "Reviewer can add rating" ON user_ratings;
CREATE POLICY "Reviewer can add rating"
  ON user_ratings FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reviewer_id
    AND reviewer_id != reviewed_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = user_ratings.conversation_id
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Reviewer can retract own rating" ON user_ratings;
CREATE POLICY "Reviewer can retract own rating"
  ON user_ratings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = reviewer_id);

-- ────────────────────────────────────────
-- TABLE: notifications (014)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: user_follows (015)
-- ────────────────────────────────────────
-- "Anyone can view follows" uses USING(true) — no change needed.

DROP POLICY IF EXISTS "Users can follow" ON user_follows;
CREATE POLICY "Users can follow"
  ON user_follows FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON user_follows;
CREATE POLICY "Users can unfollow"
  ON user_follows FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = follower_id);

-- ────────────────────────────────────────
-- TABLE: activity_events (015)
-- ────────────────────────────────────────
-- "Anyone can view public activity" — no direct auth.uid(), no change needed.
-- (It checks horse is_public via EXISTS, which is fine.)

-- ────────────────────────────────────────
-- TABLE: show_entries (016)
-- ────────────────────────────────────────
-- "Anyone can view show entries" uses USING(true) — no change needed.

DROP POLICY IF EXISTS "Users can enter shows" ON show_entries;
CREATE POLICY "Users can enter shows"
  ON show_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove own entries" ON show_entries;
CREATE POLICY "Users can remove own entries"
  ON show_entries FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: show_votes (016)
-- ────────────────────────────────────────
-- "Anyone can view votes" uses USING(true) — no change needed.

DROP POLICY IF EXISTS "Users can vote" ON show_votes;
CREATE POLICY "Users can vote"
  ON show_votes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove own votes" ON show_votes;
CREATE POLICY "Users can remove own votes"
  ON show_votes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: horse_timeline (018)
-- Merge: public + own SELECT
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "View public timeline entries" ON horse_timeline;
DROP POLICY IF EXISTS "Owner views all own timeline" ON horse_timeline;
CREATE POLICY "horse_timeline_select"
  ON horse_timeline FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.is_public = true
      )
    )
  );

DROP POLICY IF EXISTS "Owner adds timeline entries" ON horse_timeline;
CREATE POLICY "Owner adds timeline entries"
  ON horse_timeline FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner updates own timeline" ON horse_timeline;
CREATE POLICY "Owner updates own timeline"
  ON horse_timeline FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner deletes own timeline" ON horse_timeline;
CREATE POLICY "Owner deletes own timeline"
  ON horse_timeline FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────
-- TABLE: horse_ownership_history (018)
-- Merge: public + own SELECT
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "View ownership history on public horses" ON horse_ownership_history;
DROP POLICY IF EXISTS "Owner views own ownership history" ON horse_ownership_history;
CREATE POLICY "horse_ownership_history_select"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_ownership_history.horse_id AND h.is_public = true
    )
  );

-- ────────────────────────────────────────
-- TABLE: horse_photo_stages (018)
-- Merge: public + own SELECT
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "View photo stages on public horses" ON horse_photo_stages;
DROP POLICY IF EXISTS "Owner views own photo stages" ON horse_photo_stages;
CREATE POLICY "horse_photo_stages_select"
  ON horse_photo_stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_photo_stages.horse_id
        AND (h.owner_id = (SELECT auth.uid()) OR h.is_public = true)
    )
  );

DROP POLICY IF EXISTS "Owner manages photo stages" ON horse_photo_stages;
CREATE POLICY "Owner manages photo stages"
  ON horse_photo_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner deletes photo stages" ON horse_photo_stages;
CREATE POLICY "Owner deletes photo stages"
  ON horse_photo_stages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

-- ────────────────────────────────────────
-- TABLE: horse_transfers (018)
-- Merge: sender views + lookup by code
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Sender views own transfers" ON horse_transfers;
DROP POLICY IF EXISTS "Lookup by transfer code" ON horse_transfers;
CREATE POLICY "horse_transfers_select"
  ON horse_transfers FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = sender_id
    OR status = 'pending'
  );

DROP POLICY IF EXISTS "Owner creates transfer" ON horse_transfers;
CREATE POLICY "Owner creates transfer"
  ON horse_transfers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_transfers.horse_id AND h.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sender cancels transfer" ON horse_transfers;
CREATE POLICY "Sender cancels transfer"
  ON horse_transfers FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = sender_id)
  WITH CHECK ((SELECT auth.uid()) = sender_id);

-- ────────────────────────────────────────
-- TABLE: database_suggestions (020)
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own suggestions" ON database_suggestions;
CREATE POLICY "Users can view own suggestions"
  ON database_suggestions FOR SELECT TO authenticated
  USING (submitted_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can submit suggestions" ON database_suggestions;
CREATE POLICY "Users can submit suggestions"
  ON database_suggestions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = (SELECT auth.uid()));


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  PART B: Missing FK Indexes                              ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_horse_id ON notifications(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_transfers_horse_id ON horse_transfers(horse_id);
CREATE INDEX IF NOT EXISTS idx_horse_transfers_claimed_by ON horse_transfers(claimed_by);
CREATE INDEX IF NOT EXISTS idx_show_entries_horse_id ON show_entries(horse_id);
CREATE INDEX IF NOT EXISTS idx_show_votes_user_id ON show_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_mold_id ON user_wishlists(mold_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_release_id ON user_wishlists(release_id);
CREATE INDEX IF NOT EXISTS idx_featured_horses_horse_id ON featured_horses(horse_id);
CREATE INDEX IF NOT EXISTS idx_featured_horses_created_by ON featured_horses(created_by);
CREATE INDEX IF NOT EXISTS idx_photo_shows_created_by ON photo_shows(created_by);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  PART C: Harden contact_messages INSERT policy            ║
-- ╚═══════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Anyone can submit a contact message" ON contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND
    length(email) > 3 AND
    length(message) > 0 AND
    length(message) < 5000
  );

-- ============================================================
-- ✅ Migration 022 Complete
-- Fixed: ~74 RLS InitPlan warnings (auth.uid() → (SELECT auth.uid()))
-- Merged: ~9 duplicate permissive SELECT policies
-- Added: 12 missing FK indexes
-- Hardened: contact_messages INSERT policy with length checks
-- ============================================================
