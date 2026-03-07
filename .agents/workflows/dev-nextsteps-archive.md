# Dev Next-Steps — Completed Task Archive

> **Purpose:** Historical record of completed dev tasks. Moved from `dev-nextsteps.md` to keep the active workflow lean.
> **Last Updated:** 2026-03-07

> [!NOTE]
> Options 1-4 are above. Option 5 (Photo Shows Overhaul) was completed 2026-03-07.

---

## Option 5: Photo Shows Overhaul + Platform Gaps (completed 2026-03-07)

- ✅ **PS-1: Self-Voting Guard** — Added ownership check in `voteForEntry()`. Blocks users from voting for their own show entries.
- ✅ **PS-2: End Date in Create Show Form** — Added date picker to `CreateShowForm`. End date displayed on show listing and detail pages with countdown.
- ✅ **PS-3: Auto-Close Expired Shows** — Added lazy server-side check in `getPhotoShows()` that transitions expired shows to "judging". Also checks deadline in `enterShow()`.
- ✅ **PS-4: Admin Show Management** — Created `updateShowStatus()` and `deleteShow()` admin actions. Built `AdminShowManager` component. Wired into admin page.
- ✅ **PS-5: Winner Display** — Added 🥇🥈🥉 podium for closed shows. Added judging-in-progress banner. Disabled voting on non-open shows via `disabled` prop on VoteButton.
- ✅ **PS-6: Entry Limit** — Capped at 3 entries per user per show. Check added to `enterShow()`.
- ✅ **PS-7: Withdraw Entry Button** — Created `withdrawEntry()` action and `WithdrawButton` component. Shows only on own entries when show is open.
- ✅ **PS-8: Dashboard Unread Messages** — Added unread message count to dashboard analytics cards. Clickable link to inbox.
- ✅ **PS-9: Profile "For Sale" Count** — Added For Sale/Trade count badge to profile stats section.
- ✅ **PS-10: Vote Notifications** — Created notifications when someone votes for a show entry. Fire-and-forget, non-blocking.

---

## Option 1: Launch Prep & Technical Hardening (completed 2026-03-07)

### Launch Prep
- ✅ **LP-1: Mobile Navigation — Hamburger Menu** — Added `mobileMenuOpen` state and hamburger button to Header.tsx. Nav collapses to full-width slide-down menu on mobile (<768px). Auto-closes on link click and outside click. CSS with backdrop blur and glassmorphism.
- ✅ **LP-2: Global Loading States** — Created root `loading.tsx` with shimmer skeleton (hero + 6-card grid). Added route-specific loading files for community, dashboard, discover, feed, and shows via re-exports. Added `@keyframes shimmer` and skeleton CSS.
- ✅ **LP-3: Error Boundary + Not Found** — Created `error.tsx` (client component with retry button) and `not-found.tsx` (branded 404 with back-to-stable link).
- ✅ **LP-4: Landing Page Refresh** — Added 3 new feature cards (Social Community, Virtual Photo Shows, Trusted Marketplace) for 6 total. Updated meta description, hero subheadline, stats section (added "7,000+ Reference Releases"). Changed grid to `auto-fit minmax(300px, 1fr)`.
- ✅ **LP-5: Onboarding Welcome Card** — Added welcome card to dashboard for users with 0 horses. Includes 3-step getting started guide and "Add Your First Horse" CTA. Added glassmorphism CSS with numbered step indicators.
- ✅ **LP-6: Mobile Polish Pass** — Added `@media (max-width: 640px)` rules for feed-tabs, profile-hero-stats, profile-follow-stats, discover-grid, notification-item, and stats-inner.
- ✅ **LP-7: Commit Launch Prep** — Committed and pushed as `polish: Launch prep - mobile nav, loading states, error boundaries, landing page refresh`.

### Technical Hardening
- ✅ **TH-1: Migrate middleware.ts → proxy.ts** — Renamed file and export function per Next.js 16 convention. Deprecation warning eliminated from build output.
- ✅ **TH-2: TypeScript Type Audit** — Cross-referenced all 8 social/expansion interfaces against migration SQL. Found and fixed missing `is_public` field on `UserCollection` interface and its Insert type.
- ✅ **TH-3: Circular Import Check** — Verified `notifications.ts` and `activity.ts` are leaf modules. All import arrows point one-way — no circular dependencies.
- ✅ **TH-4: Commit Technical Hardening** — Committed and pushed as `chore: Technical hardening - proxy migration, type audit, import cleanup`.
- ✅ **TH-5: Add Basic Automated Test** — Installed vitest, created `src/__tests__/smoke.test.ts`, added `"test": "vitest run"` script. Test passes in 938ms.

---

## Option 2: Social Expansion Cleanup (completed 2026-03-07)

- ✅ **Task A: Wire Activity Events** — Wired `createActivityEvent` into ratings.ts, follows.ts, provenance.ts. Added `show_record` event type to ActivityFeed component.
- ✅ **Task B: Collection Showcases UI** — Added `is_public` checkbox to CollectionPicker creation modal. Added public collection pills to profile pages with CSS.
- ✅ **Task C: Optimize Discover N+1 Queries** — Replaced serial `getUserRatingSummary()` loop with single batch query to `user_ratings` table. Removed unused import.
- ✅ **Task D: "New Horse" Activity Event** — Created `notifyHorsePublic` server action in `horse-events.ts`. Wired into both add-horse and edit-horse pages.
- ⏭️ **Task E: Middleware Public Paths** — Skipped; not needed.
- ✅ **Task F: Documentation + Commit** — Committed and pushed as `fix: wire missing activity events + collection showcase UI + discover optimization`.

---

## Bug Fixes (completed 2026-03-07)

- ✅ **BF-1: Disappearing Comments** — Added `revalidatePath` to `addComment`, `deleteComment`, and `toggleFavorite` in social.ts. Cache bust ensures comments/favorites persist across page loads.
- ✅ **BF-2: Mobile Nav CSS** — Added 85 lines of missing `.header-nav`, `.header-nav-link`, `.header-hamburger` CSS to globals.css. Nav now properly collapses on mobile.
- ✅ **BF-3: Remove AI References** — Removed AI language from landing page (meta, hero, feature card). Hidden AI detect button and hint on add-horse page via `{false && ...}` guard. Code preserved for future re-enable.

---

## Option 3: Test-User Readiness (completed 2026-03-07)

- ✅ **TU-1: Forgot Password Flow** — Added `forgotPasswordAction` to auth/actions.ts. Created `/forgot-password` page with email form + success screen. Created `/auth/reset-password` page with new password form + auto-redirect. Added "Forgot your password?" link to login page. Added `/forgot-password` to proxy public paths.
- ✅ **TU-2: Auth Error Page** — Created `/auth/auth-code-error/page.tsx` with branded error messaging for expired/invalid confirmation links. Includes "Sign Up Again" and "Back to Sign In" CTAs.
- ✅ **TU-3: My Profile Navigation Link** — Added `aliasName` state to Header.tsx. Fetches from `users` table on auth. Renders 👤 Profile link between Wishlist and Inbox in nav. Works on both desktop and mobile hamburger menu.
- ✅ **TU-4: Contact Seller CTA on Show Ring Cards** — Added "View & Contact" button inside card link for For Sale / Open to Offers horses. Supplements existing trade badges and MessageSellerButton.
- ✅ **TU-5: Commit & Push** — Committed and pushed as `feat: forgot password, auth error page, profile nav link, contact seller CTA`.

---

## Option 4: Collector Polish — Daily-Use UX (completed 2026-03-07)

- ✅ **CP-1: Stable Sort Options** — Added sort dropdown to StableGrid (newest, oldest, name A-Z, name Z-A, condition). Sort applied client-side after search filter.
- ✅ **CP-2: Scale Filter on Show Ring** — Added scale filter to ShowRingFilters. Extracts unique scales from data. Added `scale` field to CommunityCardData and filter logic.
- ✅ **CP-3: Photo Thumbnails in Show Entries** — Modified `getShowEntries()` to batch-fetch horse images and generate signed URLs. Added thumbnail display to show entry cards. Added CSS for `.show-entry-thumb`.
- ✅ **CP-4: Profile Bio Field** — Migration `017_user_bio.sql` adds `bio` column to `users`. Created `EditBioButton.tsx` component. Added `updateBio` server action. Bio displays on public profile.
- ✅ **CP-5: "See More from Seller" Link** — Added link to seller's profile on public passport page. Only shows when viewer is not the owner.
- ✅ **CP-6: Release Years in Reference Search** — Already existed in the search results.
- ✅ **CP-7: Mark All Notifications Read** — Already existed in the implementation.
- ✅ **CP-8: "New" Badge on Show Ring Cards** — Added pulsing "NEW" badge to horses added within last 48 hours. CSS with `badge-pulse` animation.
- ✅ **CP-9: Activity Feed Event Thumbnails** — Added horse thumbnail fetching to `getActivityFeed()`. Thumbnails display in ActivityFeed component. CSS for `.feed-item-thumb`.
- ✅ **CP-10: Wishlist Match Notifications** — Added wishlist match checking to `notifyHorsePublic()`. Creates notifications when a For Sale/Open to Offers horse matches someone's wishlist.
- ✅ **CP-11: Commit & Push** — Committed and pushed.
