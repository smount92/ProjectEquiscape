description: V4 Production Hardening & UI Completion. Fixes 10 critical crash vectors, data loss bugs, and completes the UI tasks that were hallucinated in V3.
🛡️ V4 Production Hardening & UI Completion
Target Audience: Developer Agent
Status: CRITICAL PATCH & REMEDIATION
Directives: You MUST execute every single step below. Do NOT claim a step is complete unless you have actually written the UI code, the <button> tags, and the .map() loops. Follow the exact code snippets provided.

// turbo-all

🗄️ PHASE 1: Database & Storage Patches (Crash Prevention)
Task 1A: Migration 038 — Security & Scale Patches
Create supabase/migrations/038_v4_patches.sql with the following code to fix the Account Deletion unique constraint crash, fix the life_stage bug on Parked Horses, open up the Storage RLS, create the avatars bucket, and create the Discover View to fix the O(N) memory leak:

SQL
-- ============================================================
-- Migration 038: V4 Patches (Avatars, RLS, Deletion, Discover View)
-- ============================================================

-- 1. Create the missing avatars bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', false) 
ON CONFLICT (id) DO NOTHING;

-- Avatars RLS: Users can upload their own, anyone can read
CREATE POLICY "Avatar insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar read" ON storage.objects FOR SELECT TO authenticated, anon USING (bucket_id = 'avatars');

-- 2. Fix Storage RLS to allow Help ID and WIP photos
DROP POLICY IF EXISTS "Horse image insert (owner)" ON storage.objects;
CREATE POLICY "Horse image insert (owner)" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (
        -- Standard horse photos
        ((storage.foldername(name))[1] = 'horses' AND EXISTS (SELECT 1 FROM public.user_horses WHERE id = ((storage.foldername(name))[2])::uuid AND owner_id = (SELECT auth.uid())))
        OR 
        -- Help ID photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'help-id')
        OR
        -- Art Studio WIP photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'commissions')
    )
);

-- 3. Fix Account Deletion Unique Constraint Crash
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (SELECT auth.uid()) != target_uid THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    -- Use substr of UUID to prevent 23505 Duplicate Key crashes
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted] ' || substr(target_uid::text, 1, 8),
        bio = NULL, avatar_url = NULL, notification_prefs = NULL
    WHERE id = target_uid;
    
    UPDATE public.user_horses SET is_public = false, trade_status = 'Not for Sale', life_stage = 'orphaned' WHERE owner_id = target_uid;
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;
    UPDATE horse_transfers SET status = 'cancelled' WHERE sender_id = target_uid AND status = 'pending';
    UPDATE commissions SET status = 'cancelled' WHERE (artist_id = target_uid OR client_id = target_uid) AND status NOT IN ('completed', 'delivered', 'cancelled');
    DELETE FROM group_memberships WHERE user_id = target_uid;
END;
$$;

-- 4. Fix Parked Horse Claim Stickiness
CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD; v_horse RECORD; v_sender_alias TEXT; v_receiver_alias TEXT; v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM horse_transfers WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending' FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN.'); END IF;
    IF v_transfer.expires_at < now() THEN UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id; RETURN jsonb_build_object('success', false, 'error', 'Expired PIN.'); END IF;
    IF v_transfer.sender_id = p_claimant_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot claim your own horse.'); END IF;

    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE horse_ownership_history SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes) VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via CoA PIN');
    
    -- CRITICAL FIX: Set life_stage back to 'completed' instead of leaving it 'parked'
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed' WHERE id = v_transfer.horse_id;
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;
    
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred', 'Sold off-platform to @' || v_receiver_alias, 'Sold via CoA.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired', 'Claimed from @' || v_sender_alias, 'Acquired via CoA PIN.', true);

    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL WHERE horse_id = v_transfer.horse_id;
    RETURN jsonb_build_object('success', true, 'horse_id', v_transfer.horse_id, 'horse_name', v_horse.custom_name, 'sender_id', v_transfer.sender_id, 'sender_alias', v_sender_alias, 'receiver_alias', v_receiver_alias);
END;
$$;

-- 5. Discover Page Memory Leak View (O(N) Javascript Fix)
CREATE OR REPLACE VIEW discover_users_view AS
SELECT 
    u.id, 
    u.alias_name, 
    u.created_at, 
    u.avatar_url,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM user_ratings r WHERE r.reviewed_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM user_ratings r WHERE r.reviewed_id = u.id) as rating_count
FROM users u
WHERE u.account_status = 'active';
[STOP] Ask the human user to run this migration in the Supabase SQL editor before continuing.

🔒 PHASE 2: Logic & Data Loss Patches
Task 2A: Fix Admin Auth Bypass
File: src/app/actions/admin.ts
Fix: In verifyAdmin(), if the ADMIN_EMAIL env var is missing, the code evaluates to false and grants admin access. Replace the top of verifyAdmin() with exactly this:

TypeScript
async function verifyAdmin() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!user || !user.email || !adminEmail) return null;
  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) return null;
  
  return user;
}
Task 2B: Fix the 9,500 Missing Reference Horses
File: src/app/api/reference-dictionary/route.ts
Fix: PostgREST limits queries to 1000 rows. Replace the single reference_releases and artist_resins fetches with paginated while loops.

TypeScript
    // Replace the existing releases fetch with this:
    const allReleases: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from("reference_releases")
            .select("id, release_name, model_number, color_description, reference_molds(mold_name, manufacturer, scale)")
            .order("release_name")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allReleases.push(...data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    const releases = allReleases;
    
    // Replace the existing resins fetch with this:
    const allResins: any[] = [];
    let resinPage = 0;
    while (true) {
        const { data, error } = await supabase
            .from("artist_resins")
            .select("id, resin_name, sculptor_alias, scale")
            .order("resin_name")
            .range(resinPage * PAGE_SIZE, (resinPage + 1) * PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        allResins.push(...data);
        if (data.length < PAGE_SIZE) break;
        resinPage++;
    }
    const resins = allResins;
Task 2C: Prevent Edit Form Photo Deletion Data Loss
File: src/app/stable/[id]/edit/page.tsx
Fix: Currently, handleSlotRemove calls deleteHorseImageAction immediately. If a user clicks Cancel, the photo is still deleted from the database.

Add state:

TypeScript
const [pendingImageDeletes, setPendingImageDeletes] = useState<{recordId: string, path: string | null}[]>([]);
Change handleSlotRemove so it does NOT call deleteHorseImageAction immediately:

TypeScript
  const handleSlotRemove = (angle: AngleProfile) => {
    const existing = existingImages[angle];
    if (existing && existing.recordId) {
      setPendingImageDeletes(prev => [...prev, { recordId: existing.recordId, path: existing.storagePath || null }]);
    }
    setNewFiles((prev) => { const u = { ...prev }; delete u[angle]; return u; });
    setPreviews((prev) => { const u = { ...prev }; delete u[angle]; return u; });
    setExistingImages((prev) => { const u = { ...prev }; delete u[angle]; return u; });
  };
Change the Extra Details remove button (inside the extras-preview-grid map) similarly:

TypeScript
  onClick={(e) => {
    e.stopPropagation();
    setPendingImageDeletes(prev => [...prev, { recordId: ex.recordId, path: ex.storagePath || null }]);
    setExistingExtras(prev => prev.filter(item => item.recordId !== ex.recordId));
  }}
Inside handleSave, before uploading new photos, loop through pendingImageDeletes:

TypeScript
      // Process pending deletions first
      for (const del of pendingImageDeletes) {
        await deleteHorseImageAction(del.recordId, del.path);
      }
Task 2D: Fix Help ID Photo Abandonment
File: src/app/actions/help-id.ts
Fix: In addIdentifiedHorse, the new horse is created successfully, but it has no photo. Fetch it from the request and copy it over within the horse-images bucket.

Insert this block inside addIdentifiedHorse, immediately after the user_horses insert succeeds (after const { data: horse, error } = ...):

TypeScript
        // Transfer the photo from the Help ID request to the new horse
        const { data: request } = await supabase.from('id_requests').select('image_url').eq('accepted_suggestion_id', suggestionId).single();
        if (request?.image_url) {
            const { getAdminClient } = await import("@/lib/supabase/admin");
            const admin = getAdminClient();
            const ext = request.image_url.split('.').pop() || 'webp';
            const newPath = `horses/${horse.id}/Primary_Thumbnail_${Date.now()}.${ext}`;
            
            const { data: copyData } = await admin.storage.from("horse-images").copy(request.image_url, newPath);
            if (copyData) {
                const { data: { publicUrl } } = admin.storage.from("horse-images").getPublicUrl(newPath);
                await admin.from("horse_images").insert({ 
                    horse_id: horse.id, 
                    image_url: publicUrl, 
                    angle_profile: 'Primary_Thumbnail' 
                });
            }
        }
Task 2E: Protect Admin Suggestion Crashes
File: src/app/actions/suggestions.ts
Fix: In reviewSuggestion, change the release insert block to prevent null constraint crashes on mold_id:

TypeScript
            } else if (s.suggestion_type === "release") {
                return { success: false, error: "Releases require a specific mold_id. Please insert this release manually via the Supabase Dashboard, then mark as Approved." };
            } else if (s.suggestion_type === "resin") {
Task 2F: Fix Discover Page Memory Leak
File: src/app/discover/page.tsx
Replace the two massive queries (and the resulting JS maps) with the view created in Task 1A.

Delete the rawUsers, publicHorses, and allRatings queries, and replace them with:

TypeScript
    // Fetch aggregated data from the highly efficient PostgreSQL View
    const { data: activeUsersView } = await supabase
        .from("discover_users_view")
        .select("*")
        .order("created_at", { ascending: false });

    const activeUsers = activeUsersView || [];

    // Resolve avatar storage paths to signed URLs
    for (const u of activeUsers) {
        if (u.avatar_url && !u.avatar_url.startsWith("http")) {
            const { data: signedAvatar } = await supabase.storage
                .from("avatars")
                .createSignedUrl(u.avatar_url, 3600);
            u.avatar_url = signedAvatar?.signedUrl || null;
        }
    }
Then update the mapping in the JSX block to use the view's column names directly:

TypeScript
                    {activeUsers.map((u) => {
                        const publicCount = u.public_horse_count;
                        const isMe = u.id === user.id;

                        return (
                            <Link key={u.id} href={`/profile/${encodeURIComponent(u.alias_name)}`} className="discover-card" id={`discover-${u.id}`}>
                                <div className="discover-card-avatar">
                                    <UserAvatar avatarUrl={u.avatar_url} aliasName={u.alias_name} size={40} />
                                </div>
                                <div className="discover-card-info">
                                    <div className="discover-card-alias">
                                        @{u.alias_name}
                                        {isMe && <span className="community-own-badge" style={{ marginLeft: "6px" }}>You</span>}
                                    </div>
                                    <div className="discover-card-stats">
                                        <span>🐴 {publicCount} model{publicCount !== 1 ? "s" : ""}</span>
                                        <span>📅 {memberSince(u.created_at)}</span>
                                    </div>
                                    {u.rating_count > 0 && (
                                        <div style={{ marginTop: "var(--space-xs)" }}>
                                            <RatingBadge average={Number(u.avg_rating).toFixed(1) as unknown as number} count={u.rating_count} />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
🏗️ PHASE 3: Remediating Hallucinated UI (Part 1 - Search & Speed)
Task 3A: True Server-Side Show Ring Search
File: src/app/community/page.tsx

Update page props to await searchParams:

TypeScript
export default async function CommunityPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; finishType?: string; tradeStatus?: string; manufacturer?: string; scale?: string; sortBy?: string }>;
}) {
    const params = await searchParams;
Apply filters directly to the Supabase .from("user_horses").select(...) query string before the .limit(60):

TypeScript
  let query = supabase.from("user_horses").select(`
      id, owner_id, custom_name, finish_type, condition_grade, created_at, sculptor, trade_status, listing_price, marketplace_notes, reference_mold_id, release_id,
      users!inner(alias_name),
      reference_molds(mold_name, manufacturer, scale),
      artist_resins(resin_name, sculptor_alias),
      reference_releases(release_name, model_number),
      horse_images(image_url, angle_profile)
    `).eq("is_public", true);
    
  if (params.q) {
      query = query.or(`custom_name.ilike.%${params.q}%,sculptor.ilike.%${params.q}%`);
  }
  if (params.finishType && params.finishType !== "all") query = query.eq('finish_type', params.finishType);
  if (params.tradeStatus && params.tradeStatus !== "all") query = query.eq('trade_status', params.tradeStatus);

  // Sorting
  if (params.sortBy === "oldest") {
      query = query.order("created_at", { ascending: true });
  } else {
      query = query.order("created_at", { ascending: false });
  }

  const { data: rawHorses } = await query.limit(60);
File: src/components/ShowRingFilters.tsx and SearchBar.tsx
Refactor both components to use useRouter() and useSearchParams(). When a user types in the search bar or clicks a filter, push to ?q=...&finishType=.... Remove the local state passing.

File: src/components/ShowRingGrid.tsx
Delete the entire useMemo filtering block. The component must be a pure presentation component that maps exactly over the communityCards prop.

Task 3B: Eradicate N+1 Joins
Files: src/app/actions/activity.ts, src/app/actions/shows.ts, src/app/actions/groups.ts, src/app/actions/events.ts, src/app/inbox/page.tsx.

For each file:

Find the code block that maps an array of userIds, queries the users table, and creates an aliasMap. Delete it entirely.

Update the primary query to include the PostgREST inner join: users!inner(alias_name, avatar_url) (or just alias_name).

Update the return map to read directly from the joined object (e.g., item.users.alias_name instead of aliasMap.get(item.user_id)).

Also, in src/app/actions/art-studio.ts, completely delete the batchFetchAliases helper function.

🎨 PHASE 4: Remediating Hallucinated UI (Part 2 - CRUD & Visuals)
Task 4A: Install & Apply Markdown
Run npm install react-markdown remark-gfm.

In src/components/ActivityFeed.tsx and src/components/GroupFeed.tsx, replace <p>{post.content}</p> (and its variants) with:

TypeScript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Inside the component return:
<ReactMarkdown remarkPlugins={[remarkGfm]} className="activity-post-content">
  {post.content || (post.metadata as any)?.text}
</ReactMarkdown>
Add CSS rules to globals.css:

CSS
.activity-post-content a { color: var(--color-accent-primary); text-decoration: underline; }
.activity-post-content strong { font-weight: 600; }
.activity-post-content ul, .activity-post-content ol { padding-left: var(--space-lg); margin: var(--space-xs) 0; }
Task 4B: Build the Missing UI Delete Buttons
Activity Feed: In src/components/ActivityFeed.tsx, pass currentUserId?: string as a prop. Next to the timestamp, add:

TypeScript
{currentUserId && currentUserId === item.actorId && item.eventType === 'text_post' && (
    <button className="btn btn-ghost" style={{padding: '2px 6px', fontSize: '0.8rem'}} onClick={(e) => { e.preventDefault(); if (confirm("Delete post?")) { deleteTextPost(item.id); router.refresh(); }}}>🗑️</button>
)}
Group Feed: In src/components/GroupFeed.tsx, next to the reply button, add:

TypeScript
{userId === post.userId && (
    <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Delete post?")) { deleteGroupPost(post.id); router.refresh(); }}}>🗑️ Delete</button>
)}
Events: In src/app/community/events/[id]/page.tsx, if user.id === event.createdBy, render:

TypeScript
<button className="btn btn-ghost" style={{color: 'red'}} onClick={async () => { if (confirm("Delete Event?")) { await deleteEvent(event.id); router.push('/community/events'); }}}>🗑️ Delete Event</button>
Help ID: In src/components/HelpIdDetailClient.tsx, if isOwner, render:

TypeScript
<button className="btn btn-ghost" style={{color: 'red'}} onClick={async () => { if (confirm("Delete Request?")) { await deleteIdRequest(requestId); router.push('/community/help-id'); }}}>🗑️ Delete Request</button>
Task 4C: Implement Collection Folder Management
In src/app/stable/collection/[id]/page.tsx, ensure user_id is selected in the collection query.

Create a small client component <CollectionManager collection={collection} /> that renders a "⚙️ Manage Collection" ghost button (visible only if user.id === collection.user_id).

Clicking it opens a modal allowing them to rename the collection, update is_public, or completely delete it (calling deleteCollectionAction).

Task 4D: Implement the Real WIP Uploader
File: src/components/CommissionTimeline.tsx

Add state: const [wipFile, setWipFile] = useState<File | null>(null);

Find the <select> for updateType. When updateType === "wip_photo", render an actual file input:

TypeScript
{updateType === "wip_photo" && (
    <div className="form-group">
        <input type="file" accept="image/*" onChange={(e) => setWipFile(e.target.files?.[0] || null)} className="form-input" />
    </div>
)}
In handleAddUpdate, add the upload logic:

TypeScript
        let uploadedUrls: string[] = [];
        if (updateType === "wip_photo" && wipFile) {
            const { compressImage } = await import("@/lib/utils/imageCompression");
            const { createClient: createBrowserClient } = await import("@/lib/supabase/client");
            const browserClient = createBrowserClient();
            
            const compressed = await compressImage(wipFile);
            const filePath = `${(await browserClient.auth.getUser()).data.user?.id}/commissions/${commissionId}_${Date.now()}.webp`;
            
            const { error: uploadError } = await browserClient.storage.from("horse-images").upload(filePath, compressed);
            if (!uploadError) {
                const { data: { publicUrl } } = browserClient.storage.from("horse-images").getPublicUrl(filePath);
                uploadedUrls = [publicUrl];
            }
        }
Pass imageUrls: uploadedUrls into the addCommissionUpdate call.

Verification Check
Run npx next build. All pages must compile. All 10 hallucinated bugs/omissions from V3 are now solved.