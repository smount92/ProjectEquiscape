🐴 Equiscape Master QA Protocol (v1.0)
Methodology: Destructive Testing, State Machine Reversal, Boundary Analysis, and RLS Auditing.
Test Actors Required:

Actor A (Seller / Artist): Populated stable, premium models.

Actor B (Buyer / Client): Small stable, active wishlist.

Actor C (The Competitor): Used for concurrency / race-condition testing.

Actor D (Anon / Malicious): Logged out, attempting to scrape or bypass logic.

Admin: Access to the ADMIN_EMAIL account.

🛡️ PILLAR 1: IAM, Privacy & Infrastructure Safety
Testing the boundaries of user identity, security, and data destruction.

1.1 Account Lifecycle & Rate Limiting
[ ] Auth-01 [Boundary]: Attempt to sign up with an alias containing special characters (e.g., admin!@#), an existing alias (case-insensitive), and an alias < 3 characters. Verify strict rejection.

[ ] Auth-02 [Race]: Request a password reset. Request a second one immediately. Click the first email link. Verify the system gracefully catches the expired token and renders /auth/auth-code-error instead of a 500 error.

[ ] Auth-03 [Security]: Hit the /contact form and /api/identify-mold endpoint 6 times in 10 seconds. Verify the Postgres Database Rate Limiter blocks the 6th attempt with a 429 response.

[ ] Auth-04 [RLS Leak]: As Actor B, open the browser console and execute a raw Supabase JS client query against financial_vault for Actor A's horse. Verify exactly 0 rows are returned.

1.2 Tombstone Deletion (The "Rage Quit" Scenario)
If a power user gets mad and deletes their account, they cannot be allowed to destroy the platform's provenance history or break active commerce flows.

[ ] Del-01 [Setup]: As Actor A, add a horse, post a comment, leave a review for Actor B, and start an Art Studio commission with Actor B.

[ ] Del-02 [Execute]: Go to the Danger Zone and type "DELETE". Verify immediate sign-out and account lockout.

[ ] Del-03 [DB Integrity]: Query DB for Actor A. Verify alias_name is exactly [Deleted Collector], and bio/avatar_url are nullified.

[ ] Del-04 [Asset Orphan]: Verify Actor A's public horses reverted to visibility = 'private', trade_status = 'Not for Sale', and life_stage = 'orphaned'.

[ ] Del-05 [Social Scrub]: Log in as Actor B. Go to the DM thread with Actor A. Verify all Actor A's messages read exactly [Message deleted by user].

[ ] Del-06 [Provenance Survival - CRITICAL]: As Actor B, view the Hoofprint timeline of a horse previously bought from Actor A. Verify the timeline still exists (no cascading data loss) but attributes past events to [Deleted Collector].

1.3 System Infrastructure
[ ] Inf-01 [The WebSocket Black Hole]: Open MHH in 5 different tabs. Open Chrome DevTools > Network > WS. Verify there is no active WebSocket connection on /dashboard or /feed (verifying the Notification Bell polling fix). Verify a WebSocket only opens when actively entering an /inbox/[id] DM.

[ ] Inf-02 [Image Compression]: Upload a massive 20MB, 4K resolution .tiff image into the Add Horse form. Verify the client-side Canvas API shrinks it to <400KB WebP before the network request fires.

📦 PILLAR 2: The Digital Stable & Bulk Intake
Testing Super-Collector workflows, data density, and media handling.

2.1 Dynamic Intake & Polymorphism
[ ] Add-01 [Category Toggle]: On /add-horse, switch to "Tack & Gear". Verify "Finish Type", "Condition", and "Life Stage" completely disappear from the DOM. Submit. Verify the DB accepts null for these fields without throwing constraint errors.

[ ] Add-02 [Quick Add Duplicate]: On /add-horse/quick, select a catalog item. Click "Add". Click "Duplicate as New Finish". Verify the catalog item remains selected but the form resets condition/finish, creating a distinct new UUID.

[ ] Add-03 [Watermarking]: Enable "Watermark Photos" in Settings. Upload a photo. Inspect the Supabase Storage bucket. Verify the physical .webp file has the © @Alias — ModelHorseHub text burned into the image data (preventing direct URL scraping).

2.2 Super-Collector Management
[ ] Bulk-01 [The Panic Button]: Select 50 public horses using the Dashboard checkboxes. Use the Bulk Action Bar to set Visibility to Unlisted. Switch to Actor D (Anon) and verify all 50 vanished instantly from the public Show Ring.

[ ] Bulk-02 [Ghost File GC - CRITICAL]: Select 5 horses with uploaded photos. Click "Bulk Delete". Check Supabase Storage. Verify the Garbage Collection logic successfully wiped the associated horse-images folders from the bucket, not just the DB rows.

[ ] Dash-01 [OOM Guard]: Log into an account with 300+ horses. Verify the dashboard loads instantly (fetching only the first 48). Scroll down and verify IntersectionObserver triggers seamless pagination without freezing the browser thread.

[ ] Exp-01 [PDF Guard]: Attempt to generate an Insurance PDF for a 300-horse stable. Verify the UI forces the user to select a specific Collection folder (max 50) to prevent a mobile RAM crash from buffering 300 base64 images.

2.3 The CSV Pipeline
[ ] CSV-01 [No Photo / No Feed]: Upload a CSV. Check the "Publish to Feed" box. Import 10 models with NO photos. Verify exactly zero events hit the global Activity Feed.

[ ] CSV-02 [Sanitization]: Import a CSV where a horse name is <script>alert('hack')</script>. Verify it renders safely on the dashboard as a literal string.

🤝 PILLAR 3: Commerce State Machine (The Danger Zone)
Testing escrow-less safety, scam prevention, and the transaction locks.

3.1 Offer Concurrency & Locks
[ ] Com-01 [Concurrency - CRITICAL]: Actor B and Actor C submit offers on the same horse simultaneously. Actor A (Seller) accepts Actor B. Verify Actor C's offer automatically transitions to cancelled and Actor C is notified.

[ ] Com-02 [State Locking]: Accepting an offer sets the horse's trade_status to "Pending Sale". Attempt to manually edit the horse to revert it to "For Sale" while the transaction is pending. Verify the edit is blocked.

[ ] Com-03 [The "Rug Pull" Defense]: While an offer is in pending_payment (Buyer has sent money off-platform), Actor A attempts to click "Delete Horse" from their Stable. Verify the system throws a hard error: "Cannot delete a horse locked in an active transaction."

3.2 Dispute Flows & Cryptography
[ ] Com-04 [Ghosting Buyer]: Actor A accepts offer. Actor B ghosts and never pays. Verify Actor A can click "Cancel / Dispute Transaction" to safely abort the state machine and unlock the horse's trade status.

[ ] Com-05 [Buyer Retraction]: Actor B makes an offer. Actor A hasn't responded. Verify Actor B can click "Retract Offer" to cancel it.

[ ] Com-06 [Crypto Check]: Click "Verify Funds & Release". Verify the generated 6-character PIN uses crypto.randomInt() (no 0/O/I/1/L characters) and appears ONLY to the Buyer in the OfferCard.

[ ] Com-07 [Chat Guardrails]: In the DM, type "Can I just use venmo friends and family?". Verify the amber 🛡️ warning banner injects instantly into the UI.

📖 PILLAR 4: Universal Catalog, Market & AI
Testing value integrity, search logic, and AI hallucinations.

4.1 Search & AI Vision
[ ] Cat-01 [The "Breyer Adios" Split]: Search "Breyer Adios" in UnifiedReferenceSearch. Verify the system successfully splits the tokens and retrieves the mold (matching maker = Breyer and title = Adios simultaneously).

[ ] AI-01 [The Coffee Mug Test]: Upload a photo of a dog or a coffee mug to the Help ID tool. Verify Gemini strictly returns {"error": "Not a model horse"} and the UI displays a friendly error instead of hallucinating "Breyer Classic Black Beauty".

[ ] Cat-02 [Bait & Switch Defense]: Seller lists "Breyer #100". Buyer makes an offer. Seller quickly edits the horse to "Breyer #200". Verify Hoofprint automatically logs a "Reference identity updated" event so the buyer has an audit trail.

4.2 The Blue Book (Market Integrity)
[ ] Mkt-01 [Finish Skew]: Complete a transaction for an "OF" Breyer at $40, and a "Custom" Breyer on the exact same mold for $400. Trigger the cron refresh. Verify the /market page shows two distinct entries, grouped by finish_type.

[ ] Mkt-02 [Life Stage Skew]: Complete a transaction for a "Blank" Artist Resin and a "Completed" Artist Resin. Verify the Blue Book separates them via life_stage.

[ ] Mkt-03 [Bundle Exclusion]: In the Make Offer modal, toggle is_bundle_sale = true for a mare/foal pair. Complete the transaction. Trigger the Cron refresh. Verify this price is mathematically excluded from the Blue Book averages.

🐾 PILLAR 5: Provenance & Transfers
5.1 Transfer Integrity
[ ] Trn-01 [Double Claim Race]: Actor A generates a transfer code. Actor B and Actor C both attempt to submit the claim code at the exact same millisecond. Verify the Postgres FOR UPDATE lock ensures only 1 succeeds.

[ ] Trn-02 [Self-Claim]: Attempt to claim a PIN on the exact same account that generated it. Verify failure.

[ ] Trn-03 [Privacy Wipe]: Actor A claims a Parked PIN. Verify Actor B's financial_vault data (purchase price, insurance notes) is completely wiped for that horse and does not transfer.

[ ] Trn-04 [Lost in Transit Auto-Recovery]: Generate a Parked PIN. Manually alter the expires_at date in the DB to yesterday. Attempt to load /claim?pin=XXXXXX. Verify the system rejects it, unparks the horse (life_stage = 'completed'), and logs a Hoofprint note.

5.2 The Fake Artist Guard
[ ] Art-01 [Manual Spoof]: Manually type "Brigitte Eberl" in the finishing_artist field of an Add Horse form. Verify the public passport displays it normally without a checkmark.

[ ] Art-02 [Verified Delivery]: Complete an Art Studio commission. Verify the user_horses row updates to finishing_artist_verified = true, and the UI renders "✅ Verified Creator: @ArtistAlias".

🎨 PILLAR 6: Art Studio & Creator Flywheel
[ ] Stu-01 [The Missing Link]: Client requests a "Send-In" commission. Verify they can use the UI to select a specific horse from their stable to link to the request.

[ ] Stu-02 [WIP Privacy]: Artist uploads a WIP photo and unchecks "Visible to client". Log in as the Client and verify the photo is entirely absent from the timeline UI and API payload.

[ ] Stu-03 [Guest Portal]: Access a commission URL with ?token=UUID in an Incognito window. Verify the timeline renders in read-only mode without requiring an account (bypassing RLS safely).

[ ] Stu-04 [The Magic Pipeline - CRITICAL]: Artist marks commission as delivered and transfers the horse. View the horse passport as the new owner. Verify all public WIP photos transitioned perfectly into permanent customization_logs events on the Hoofprint timeline.

🏆 PILLAR 7: Competition Engine
Testing live show realities and UI feedback.

[ ] Sho-01 [Handler Conflict]: Show String Planner. Assign Horse A to Class 1 at 10:00 AM. Assign Horse B to Class 2 at 10:00 AM. Verify the visual timeline pulses red with a "⚠️ Handler Time Conflict" warning (because the human cannot be in two rings at once).

[ ] Sho-02 [Duplication]: Click "Duplicate String" on an old 30-horse show string. Verify a new planner instance is created with all show_string_entries copied over successfully.

[ ] Sho-03 [Batch Entry UX]: Open the post-show results grid. Use the "Tab" key to rapidly enter 1st, 2nd, 3rd placings down the column. Click Save. Verify the NAN point tracker updates correctly based on ribbon tiers.

[ ] Sho-04 [Expert Judged Protection]: Create a show with judging_method = 'expert_judge'. Verify normal users cannot see the <VoteButton /> to prevent popularity contests. Verify the Creator can manually assign placings.

[ ] Sho-05 [Self-Voting Block]: Attempt to click the heart icon on your own entry in a community-voted show. Verify the RPC strictly rejects it.

🌍 PILLAR 8: Community Fabric & Moderation
[ ] Soc-01 [Mention Parsing]: Type a post containing @TestUser, @"Alias With Spaces", and @NonExistentUser. Verify the first two render as blue links and trigger notifications, and the third renders as plain text.

[ ] Soc-02 [Rich Embeds]: Paste a MHH public passport URL into a text post. Verify the UI unfurls it into a rich visual card containing the horse's thumbnail and finish.

[ ] Soc-03 [Private Group Leakage]: Create a Private Group. Log in as a non-member. Navigate directly to /community/groups/[slug]. Verify the UI blocks access. Try to fetch the posts via direct Supabase API call. Verify RLS returns 0 rows.

[ ] Soc-04 [Troll Defense]: As User B, click "🚩 Report" on User A's feed post. As Admin, go to /admin, view the report, and click "Delete Content & Ban User". Verify the post disappears, the media blobs are deleted from S3 via Storage GC, and User A's account_status is suspended.

[ ] Soc-05 [System GC Cron]: Manually trigger /api/cron/refresh-market. Verify the cleanup_system_garbage() RPC executes. Check the DB to ensure read notifications older than 30 days are gone, and offer_made transactions older than 7 days are auto-cancelled.