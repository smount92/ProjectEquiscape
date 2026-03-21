# 🔍 Model Horse Hub — Visual QA Test Plan
## Post-Tailwind-Migration Comprehensive Audit

> **Context:** Following Phase 3 of the Tailwind CSS migration, an automated converter introduced widespread styling bugs including garbled classNames, spaced arbitrary values, dead CSS class references, and identical card-level styling applied to semantically different elements. Over 35,000 fixes have been applied. This test plan ensures every user-facing surface is visually correct before beta testers see it.

> [!IMPORTANT]
> Test at **three viewport widths**: Desktop (1440px), Tablet (768px), and Mobile (390px).
> For each section, check **both dark and light** modes if supported.

---

## 📋 How to Use This Checklist

- **✅** = Looks correct, no issues
- **⚠️** = Minor issue (cosmetic, non-blocking)  
- **❌** = Major issue (broken layout, missing content, unusable)
- **🔧** = Issue found and fixed in this session

After testing, any ❌ or ⚠️ items become the fix list for the next session.

---

## 1. 🏠 Global Chrome (Every Page)

### 1.1 Header ([Header.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/Header.tsx))
| # | Check | Status |
|---|-------|--------|
| 1.1.1 | Logo + site name visible, properly aligned left | |
| 1.1.2 | Navigation links in a **horizontal row** (not stacked) on desktop | |
| 1.1.3 | Sticky behavior — header stays pinned on scroll | |
| 1.1.4 | User avatar visible in top-right, correct sizing (no oversized/tiny) | |
| 1.1.5 | User dropdown opens on click, items are readable and properly spaced | |
| 1.1.6 | Dropdown dividers visible between sections | |
| 1.1.7 | Notification bell visible with badge count | |
| 1.1.8 | **Mobile:** Hamburger button visible, nav links hidden | |
| 1.1.9 | **Mobile:** Hamburger opens slide-out menu, items are tappable | |
| 1.1.10 | **Mobile:** Sign-out button visible and styled | |
| 1.1.11 | **Logged out:** Login/Signup buttons visible, nav is simplified | |

### 1.2 Footer (`Footer.tsx`)
| # | Check | Status |
|---|-------|--------|
| 1.2.1 | Footer visible at bottom of page | |
| 1.2.2 | Links are horizontal on desktop, stack on mobile | |
| 1.2.3 | Copyright text readable | |
| 1.2.4 | Adequate spacing from page content above | |

### 1.3 Layout Wrapper
| # | Check | Status |
|---|-------|--------|
| 1.3.1 | Content has max-width constraint, centered | |
| 1.3.2 | Page has horizontal padding (not edge-to-edge text) | |
| 1.3.3 | No horizontal scroll on any viewport width | |
| 1.3.4 | Cookie consent banner appears (if applicable) | |

---

## 2. 🏡 Landing Page (`/`)

| # | Check | Status |
|---|-------|--------|
| 2.1 | Hero section: large heading, subtext, CTA button visible | |
| 2.2 | Hero has visual depth (gradient, glow, or decorative elements) | |
| 2.3 | Features grid: **3 or more columns** on desktop, stacking on mobile | |
| 2.4 | Feature icons/emojis visible and properly sized | |
| 2.5 | Featured horse card(s) render with image, name, badges | |
| 2.6 | "Getting Started" or signup CTA visible | |
| 2.7 | Animations play (fade-in-up) on scroll | |
| 2.8 | No `hero-glow` class visible as raw text or broken element | |

---

## 3. 🔐 Auth Pages

### 3.1 Login (`/login`)
| # | Check | Status |
|---|-------|--------|
| 3.1.1 | Centered card with proper border/shadow | |
| 3.1.2 | Email & password inputs visible, properly sized | |
| 3.1.3 | Submit button styled (green/forest, not browser default) | |
| 3.1.4 | "Forgot password" and "Sign up" links visible | |
| 3.1.5 | Card not edge-to-edge on desktop (max-width constraint) | |

### 3.2 Signup (`/signup`)
| # | Check | Status |
|---|-------|--------|
| 3.2.1 | Form fields visible with labels | |
| 3.2.2 | Alias name field with helper text | |
| 3.2.3 | Submit button styled | |
| 3.2.4 | Terms/privacy links visible | |

### 3.3 Forgot Password (`/forgot-password`)
| # | Check | Status |
|---|-------|--------|
| 3.3.1 | Email input visible | |
| 3.3.2 | Submit button styled | |

### 3.4 Reset Password (`/auth/reset-password`)
| # | Check | Status |
|---|-------|--------|
| 3.4.1 | Password + confirm fields visible | |
| 3.4.2 | Success/error states render correctly | |

---

## 4. 📊 Dashboard (`/dashboard`)

### 4.1 Dashboard Shell (`DashboardShell.tsx`)
| # | Check | Status |
|---|-------|--------|
| 4.1.1 | Welcome message with user name | |
| 4.1.2 | Stats row: **horizontal grid** (horses count, collections, etc.) | |
| 4.1.3 | Stat cards have borders, backgrounds, proper spacing | |
| 4.1.4 | Quick action buttons visible and styled | |
| 4.1.5 | "Add Horse" CTA prominent | |

### 4.2 Stable Grid/Ledger Toggle
| # | Check | Status |
|---|-------|--------|
| 4.2.1 | View toggle (Grid vs Ledger) visible | |
| 4.2.2 | Search bar visible with placeholder text | |
| 4.2.3 | Sort dropdown visible and functional | |

### 4.3 Stable Grid View ([StableGrid.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/StableGrid.tsx))
| # | Check | Status |
|---|-------|--------|
| 4.3.1 | Cards in responsive **multi-column grid** (not vertical stack) | |
| 4.3.2 | Card image fills top area with proper aspect ratio | |
| 4.3.3 | **No-photo placeholder:** centered emoji + "No photo" text, not a card-in-card | |
| 4.3.4 | Horse name visible and truncated if long | |
| 4.3.5 | Reference name visible below horse name | |
| 4.3.6 | Finish badge (OF/Custom/Resin) colored correctly | |
| 4.3.7 | Trade status badges visible (For Sale = green, Offers = blue) | |
| 4.3.8 | Condition grade and date in footer row | |
| 4.3.9 | Collection name tag visible if assigned | |
| 4.3.10 | Card hover effect (shadow increase) | |
| 4.3.11 | Category badge (Tack/Prop/Diorama) positioned top-right | |
| 4.3.12 | **Select mode:** Checkbox visible, ring highlight on selected | |

### 4.4 Stable Ledger View ([StableLedger.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/StableLedger.tsx))
| # | Check | Status |
|---|-------|--------|
| 4.4.1 | Table spans **full width** of container | |
| 4.4.2 | Column headers visible, clickable for sorting | |
| 4.4.3 | Sort indicator (▲/▼) shows on active column | |
| 4.4.4 | Thumbnail images small (40×40) and properly contained | |
| 4.4.5 | Horse name is a clickable link (forest color) | |
| 4.4.6 | Reference, finish, condition columns readable | |
| 4.4.7 | Trade status uses colored pill badges | |
| 4.4.8 | Responsive: some columns hide on mobile (`max-md:hidden`) | |
| 4.4.9 | Hover row highlight | |
| 4.4.10 | Empty state shows centered message | |

### 4.5 Collection Manager (`CollectionManager.tsx`)
| # | Check | Status |
|---|-------|--------|
| 4.5.1 | Collection list visible | |
| 4.5.2 | Create collection form functional | |
| 4.5.3 | Collection picker modal works | |

### 4.6 NAN Dashboard Widget
| # | Check | Status |
|---|-------|--------|
| 4.6.1 | Widget renders with proper card styling | |
| 4.6.2 | Stats readable | |

---

## 5. 🐴 Horse Passport (`/stable/:id`)

| # | Check | Status |
|---|-------|--------|
| 5.1 | **Two-column layout** on desktop: Gallery left, Info right | |
| 5.2 | **Mobile:** Stacks to single column (gallery on top, info below) | |
| 5.3 | Gallery images visible and swipeable | |
| 5.4 | Info sidebar has tan/brown background (`#C8B596`) | |
| 5.5 | Horse name is large, bold heading | |
| 5.6 | Reference/maker subtext visible | |
| 5.7 | **Model Details card:** rows with label left, value right (`justify-between`) | |
| 5.8 | Detail rows have subtle bottom borders | |
| 5.9 | Condition badge has green pill styling | |
| 5.10 | Finish Details card visible (if data exists) | |
| 5.11 | Show Identity card visible (breed, gender, age, regional ID) | |
| 5.12 | Public notes card renders with whitespace preserved | |
| 5.13 | Market Value Badge renders (if catalog linked) | |
| 5.14 | Show Record Timeline renders (if records exist) | |
| 5.15 | Pedigree Card renders (if pedigree exists) | |
| 5.16 | Hoofprint Timeline renders with events | |
| 5.17 | Vault Reveal section works (click to show financials) | |
| 5.18 | Action buttons row: Back, Edit, Transfer, Delete — **horizontal flex wrap** | |
| 5.19 | Breadcrumb navigation visible at top | |
| 5.20 | Wishlist demand banner visible (if applicable) | |

---

## 6. ✏️ Edit Horse (`/stable/:id/edit`)

| # | Check | Status |
|---|-------|--------|
| 6.1 | Form fields properly labeled and spaced | |
| 6.2 | Image upload/crop area visible | |
| 6.3 | Reference search (UnifiedReferenceSearch) works | |
| 6.4 | Dropdowns (finish type, condition, trade status) styled | |
| 6.5 | Save button styled as primary (green) | |
| 6.6 | Image crop modal ([ImageCropModal.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/ImageCropModal.tsx)) opens and renders correctly | |
| 6.7 | Aspect ratio buttons visible in crop modal | |

---

## 7. ➕ Add Horse (`/add-horse`)

| # | Check | Status |
|---|-------|--------|
| 7.1 | Multi-step form wizard visible | |
| 7.2 | Reference search works with results grid | |
| 7.3 | Image upload area visible | |
| 7.4 | Form inputs styled (not browser defaults) | |
| 7.5 | Submit button styled | |

### 7.1 Quick Add (`/add-horse/quick`)
| # | Check | Status |
|---|-------|--------|
| 7.1.1 | Quick add cards visible in grid layout | |
| 7.1.2 | Selected state visible (`.quick-add-selected` — **dead class, likely broken**) | |

---

## 8. 🏟️ Show Ring / Community (`/community`)

### 8.1 Show Ring Grid ([ShowRingGrid.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/ShowRingGrid.tsx))
| # | Check | Status |
|---|-------|--------|
| 8.1.1 | Cards in responsive **multi-column grid** | |
| 8.1.2 | Search bar sticky at top | |
| 8.1.3 | Filter bar (ShowRingFilters) visible below search | |
| 8.1.4 | Card image area with proper aspect ratio | |
| 8.1.5 | **No-photo placeholder:** centered emoji, not card-in-card | |
| 8.1.6 | Card info section: horse name (bold), ref name (muted), time | |
| 8.1.7 | Release line and sculptor show if present | |
| 8.1.8 | **Card footer:** Owner link (left) + Favorite/Wishlist buttons (right) — **horizontal** | |
| 8.1.9 | Finish badges, trade badges, new badges visible | |
| 8.1.10 | Hoofprint indicator visible (🐾 badge) | |
| 8.1.11 | Empty state message centered | |
| 8.1.12 | Filter results count visible | |

### 8.2 Community Detail (`/community/:id`)
| # | Check | Status |
|---|-------|--------|
| 8.2.1 | **Two-column layout** on desktop | |
| 8.2.2 | Image gallery visible | |
| 8.2.3 | Horse details readable | |
| 8.2.4 | Owner info visible | |
| 8.2.5 | Favorite/Wishlist/Share buttons visible | |
| 8.2.6 | Message seller button visible | |

### 8.3 Hoofprint Page (`/community/:id/hoofprint`)
| # | Check | Status |
|---|-------|--------|
| 8.3.1 | Timeline renders with events | |
| 8.3.2 | Ownership chain visible | |

---

## 9. 🆔 Help ID (`/community/help-id`)

| # | Check | Status |
|---|-------|--------|
| 9.1 | Request list visible in cards or grid | |
| 9.2 | Status badges (open/resolved) visible — **`open`/[resolved](file:///C:/Users/MTG%20Test/.gemini/antigravity/brain/f3cf4861-e83c-49a0-9503-da78fa8548ed/sprint_results.md.resolved) may be dead classes** | |
| 9.3 | Request form ([HelpIdRequestForm.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/HelpIdRequestForm.tsx)) visible | |
| 9.4 | Detail page (`/community/help-id/:id`) renders | |

---

## 10. 📸 Photo Shows

### 10.1 Shows List (`/shows`)
| # | Check | Status |
|---|-------|--------|
| 10.1.1 | Show cards in grid layout | |
| 10.1.2 | Status badges visible (active, judging, closed) | |

### 10.2 Show Detail (`/shows/:id`)
| # | Check | Status |
|---|-------|--------|
| 10.2.1 | Show header with title and status | |
| 10.2.2 | Entry grid visible | |
| 10.2.3 | Entry form ([ShowEntryForm.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/ShowEntryForm.tsx)) works | |
| 10.2.4 | String manager visible | |
| 10.2.5 | Results/placings visible for closed shows | |

### 10.3 Show Planner (`/shows/planner`)
| # | Check | Status |
|---|-------|--------|
| 10.3.1 | Planner layout renders | |

---

## 11. 📚 Catalog

### 11.1 Catalog Browser (`/catalog`)
| # | Check | Status |
|---|-------|--------|
| 11.1.1 | Search bar visible | |
| 11.1.2 | Catalog items in grid or list — **check `.ref-main` dead class** | |
| 11.1.3 | Category filters work | |

### 11.2 Catalog Detail (`/catalog/:id`)
| # | Check | Status |
|---|-------|--------|
| 11.2.1 | Item details visible | |
| 11.2.2 | Suggest edit modal works | |
| 11.2.3 | **Check `.ref-pending-type` dead class** | |

### 11.3 Catalog Suggestions (`/catalog/suggestions`)
| # | Check | Status |
|---|-------|--------|
| 11.3.1 | Suggestion list renders | |
| 11.3.2 | Vote buttons work | |
| 11.3.3 | New suggestion form (`/catalog/suggestions/new`) renders | |

### 11.4 Catalog Changelog (`/catalog/changelog`)
| # | Check | Status |
|---|-------|--------|
| 11.4.1 | Changelog entries visible — **check `.ref-changelog-content` dead class** | |

---

## 12. 👤 Profile (`/profile/:alias`)

| # | Check | Status |
|---|-------|--------|
| 12.1 | Profile header: avatar, name, bio visible | |
| 12.2 | Stats row (horses, favorites, rating) **horizontal** | |
| 12.3 | Follow/Message/Block buttons visible | |
| 12.4 | Trophy Case (`TrophyCase.tsx`) renders badges | |
| 12.5 | Public stable grid visible | |
| 12.6 | Rating display (stars) works | |
| 12.7 | Edit bio button visible (own profile) | |

---

## 13. ⚙️ Settings (`/settings`)

| # | Check | Status |
|---|-------|--------|
| 13.1 | Form sections clearly separated | |
| 13.2 | Avatar upload works | |
| 13.3 | Inputs and dropdowns styled | |
| 13.4 | Save button visible | |
| 13.5 | Currency selector visible | |
| 13.6 | Privacy toggles work | |

---

## 14. 💬 Inbox (`/inbox`)

| # | Check | Status |
|---|-------|--------|
| 14.1 | Conversation list visible | |
| 14.2 | Each conversation shows avatar, name, preview | |
| 14.3 | Unread indicator visible | |

### 14.1 Thread View (`/inbox/:id`)
| # | Check | Status |
|---|-------|--------|
| 14.1.1 | Messages visible with sender alignment (left/right) | |
| 14.1.2 | Chat input at bottom | |
| 14.1.3 | Timestamps visible | |
| 14.1.4 | Rich embeds render (`RichEmbed.tsx`) | |

---

## 15. 🔔 Notifications (`/notifications`)

| # | Check | Status |
|---|-------|--------|
| 15.1 | Notification list renders | |
| 15.2 | Read/unread distinction visible | |
| 15.3 | Notification types have icons | |
| 15.4 | Mark as read button works | |

---

## 16. 📰 Feed (`/feed`)

| # | Check | Status |
|---|-------|--------|
| 16.1 | Universal feed card layout renders | |
| 16.2 | **Feed action row** — **`feed-action-row` is a dead class** | |
| 16.3 | Like toggle works | |
| 16.4 | Load more pagination works | |
| 16.5 | Activity feed renders user activity | |

---

## 17. 🛒 Market (`/market`)

| # | Check | Status |
|---|-------|--------|
| 17.1 | Market filters visible and functional | |
| 17.2 | Horse cards in grid layout | |
| 17.3 | Price and trade status visible on cards | |
| 17.4 | Filter pills/controls styled | |

---

## 18. 🔮 Discover (`/discover`)

| # | Check | Status |
|---|-------|--------|
| 18.1 | Discover grid (`DiscoverGrid.tsx`) renders cards | |
| 18.2 | Cards in multi-column layout | |
| 18.3 | Randomized content loads | |

---

## 19. ❤️ Wishlist (`/wishlist`)

| # | Check | Status |
|---|-------|--------|
| 19.1 | Wishlist items visible in grid | |
| 19.2 | Remove button visible and functional | |
| 19.3 | Matchmaker matches visible (`MatchmakerMatches.tsx`) | |
| 19.4 | Wishlist search works | |

---

## 20. 🎨 Artist Studio

### 20.1 Studio Landing (`/studio`)
| # | Check | Status |
|---|-------|--------|
| 20.1.1 | Studio info visible | |
| 20.1.2 | CTA to setup studio | |

### 20.2 Studio Setup (`/studio/setup`)
| # | Check | Status |
|---|-------|--------|
| 20.2.1 | Setup form renders with sections | |
| 20.2.2 | Inputs styled | |

### 20.3 Studio Dashboard (`/studio/dashboard`)
| # | Check | Status |
|---|-------|--------|
| 20.3.1 | Commission board visible | |
| 20.3.2 | Stats visible | |

### 20.4 Artist Profile (`/studio/:slug`)
| # | Check | Status |
|---|-------|--------|
| 20.4.1 | Artist info visible | |
| 20.4.2 | Commission request button | |
| 20.4.3 | Gallery visible | |

### 20.5 Commission Request (`/studio/:slug/request`)
| # | Check | Status |
|---|-------|--------|
| 20.5.1 | Request form renders | |
| 20.5.2 | Inputs styled | |

### 20.6 Commission Detail (`/studio/commission/:id`)
| # | Check | Status |
|---|-------|--------|
| 20.6.1 | Commission timeline renders | |
| 20.6.2 | Status updates visible | |
| 20.6.3 | Action buttons styled | |

### 20.7 My Commissions (`/studio/my-commissions`)
| # | Check | Status |
|---|-------|--------|
| 20.7.1 | Commission list visible | |
| 20.7.2 | Status filters work | |

---

## 21. 📦 Import (`/stable/import`)

| # | Check | Status |
|---|-------|--------|
| 21.1 | CSV import form visible (`CsvImport.tsx`) | |
| 21.2 | File upload area styled | |
| 21.3 | Preview table renders after upload | |
| 21.4 | Progress indicators visible | |

---

## 22. 📋 Collections (`/stable/collection/:id`)

| # | Check | Status |
|---|-------|--------|
| 22.1 | Collection header with name | |
| 22.2 | Grid of horses in this collection | |
| 22.3 | Proper card styling (same as StableGrid) | |

---

## 23. 🏘️ Groups

### 23.1 Group Browser (`/community/groups`)
| # | Check | Status |
|---|-------|--------|
| 23.1.1 | Group cards in grid | |
| 23.1.2 | Create group CTA visible | |

### 23.2 Group Detail (`/community/groups/:slug`)
| # | Check | Status |
|---|-------|--------|
| 23.2.1 | Group info header | |
| 23.2.2 | Member list visible | |
| 23.2.3 | Group files section | |
| 23.2.4 | Admin panel (if admin) | |
| 23.2.5 | **Check `.empty-state` dead class** | |

### 23.3 Create Group (`/community/groups/create`)
| # | Check | Status |
|---|-------|--------|
| 23.3.1 | Form renders with styled inputs | |

---

## 24. 📅 Events

### 24.1 Event Browser (`/community/events`)
| # | Check | Status |
|---|-------|--------|
| 24.1.1 | Event cards in grid | |
| 24.1.2 | RSVP button visible | |

### 24.2 Event Detail (`/community/events/:id`)
| # | Check | Status |
|---|-------|--------|
| 24.2.1 | Event header with title, date, location | |
| 24.2.2 | Photo gallery visible | |
| 24.2.3 | RSVP button works | |

### 24.3 Event Management (`/community/events/:id/manage`)
| # | Check | Status |
|---|-------|--------|
| 24.3.1 | Management controls visible | |
| 24.3.2 | Entry list renders | |
| 24.3.3 | Assign placings works | |

### 24.4 Create Event (`/community/events/create`)
| # | Check | Status |
|---|-------|--------|
| 24.4.1 | Form renders | |

---

## 25. ⚡ Admin (`/admin`)

### 25.1 Admin Header
| # | Check | Status |
|---|-------|--------|
| 25.1.1 | Title and badge in **horizontal row** | |
| 25.1.2 | Subtitle text visible | |
| 25.1.3 | Shield badge properly styled | |

### 25.2 Metrics Row
| # | Check | Status |
|---|-------|--------|
| 25.2.1 | Three metric cards in **horizontal grid** | |
| 25.2.2 | Numbers large and bold | |
| 25.2.3 | Labels below numbers | |
| 25.2.4 | Cards have glass/border styling | |

### 25.3 Tab Bar
| # | Check | Status |
|---|-------|--------|
| 25.3.1 | Five tabs visible in **horizontal row** | |
| 25.3.2 | Active tab has bottom border (forest green) | |
| 25.3.3 | Badge counts visible on tabs | |
| 25.3.4 | Reports badge is red if > 0 | |
| 25.3.5 | Tab switching works | |

### 25.4 Mailbox Tab
| # | Check | Status |
|---|-------|--------|
| 25.4.1 | Messages as distinct cards with borders | |
| 25.4.2 | Each card: sender name + email in header row | |
| 25.4.3 | Date/time in header right side | |
| 25.4.4 | Subject line with unread dot indicator | |
| 25.4.5 | Message body readable (not crammed or oversized) | |
| 25.4.6 | Actions footer: Reply, Mark Read, Delete — **horizontal flex** | |
| 25.4.7 | Unread messages have shadow, read messages are subdued | |
| 25.4.8 | Empty state message when no messages | |

### 25.5 Shows Tab
| # | Check | Status |
|---|-------|--------|
| 25.5.1 | Create Show form and Manage side-by-side grid | |
| 25.5.2 | Show manager renders list | |

### 25.6 Content Tab (Suggestions)
| # | Check | Status |
|---|-------|--------|
| 25.6.1 | Suggestion list renders | |
| 25.6.2 | Admin actions visible | |

### 25.7 Reports Tab
| # | Check | Status |
|---|-------|--------|
| 25.7.1 | Report cards render with info | |
| 25.7.2 | Action buttons visible | |

### 25.8 Catalog Tab
| # | Check | Status |
|---|-------|--------|
| 25.8.1 | Catalog suggestions list renders | |
| 25.8.2 | Admin actions visible (approve/reject) | |
| 25.8.3 | Vote counts visible | |

---

## 26. 📄 Static Pages

### 26.1 About (`/about`)
| # | Check | Status |
|---|-------|--------|
| 26.1.1 | Content sections visible | |
| 26.1.2 | Values grid — **horizontal grid, not vertical** | |
| 26.1.3 | Proper heading hierarchy | |

### 26.2 FAQ (`/faq`)
| # | Check | Status |
|---|-------|--------|
| 26.2.1 | FAQ sections visible | |
| 26.2.2 | Expandable/accordion items (if applicable) | |

### 26.3 Getting Started (`/getting-started`)
| # | Check | Status |
|---|-------|--------|
| 26.3.1 | Step-by-step guide visible | |
| 26.3.2 | Screenshots/images render | |

### 26.4 Contact (`/contact`)
| # | Check | Status |
|---|-------|--------|
| 26.4.1 | Contact form visible with styled inputs | |
| 26.4.2 | Submit button styled | |

### 26.5 Privacy (`/privacy`) & Terms (`/terms`)
| # | Check | Status |
|---|-------|--------|
| 26.5.1 | Legal text readable with proper formatting | |
| 26.5.2 | Headings visible | |
| 26.5.3 | **Check `var(--space-lg)` class fragments** | |

---

## 27. 🔄 Transfer & Claim

### 27.1 Transfer Modal ([TransferModal.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/TransferModal.tsx))
| # | Check | Status |
|---|-------|--------|
| 27.1.1 | Modal opens with proper overlay | |
| 27.1.2 | Form inputs styled | |

### 27.2 Claim Page (`/claim`)
| # | Check | Status |
|---|-------|--------|
| 27.2.1 | PIN entry form visible | |
| 27.2.2 | Horse preview card — **check `claim-preview-bg-card` dead class** | |

---

## 28. 🚨 Error & Loading States

| # | Check | Status |
|---|-------|--------|
| 28.1 | Error page (`error.tsx`): centered card with error message | |
| 28.2 | Not Found (`not-found.tsx`): centered card with 404 message | |
| 28.3 | Loading states (`loading.tsx`): **skeleton cards** — **check `skeleton-bg-card`, `loading-skeleton` dead classes** | |

---

## 29. 🧩 Cross-Cutting Components

### 29.1 Modals
| # | Check | Status |
|---|-------|--------|
| 29.1.1 | [ImageCropModal](file:///c:/Project%20Equispace/model-horse-hub/src/components/ImageCropModal.tsx#28-485): opens, aspect ratio buttons visible, crop works | |
| 29.1.2 | `DeleteHorseModal`: confirmation dialog proper | |
| 29.1.3 | `SuggestReferenceModal`: form visible | |
| 29.1.4 | `SuggestEditModal`: form visible | |
| 29.1.5 | `MakeOfferModal`: form visible | |
| 29.1.6 | `TransferModal`: form visible | |

### 29.2 Interactive Buttons
| # | Check | Status |
|---|-------|--------|
| 29.2.1 | `FavoriteButton`: heart icon, count, toggling works | |
| 29.2.2 | `WishlistButton`: rendering, toggling | |
| 29.2.3 | `FollowButton`: rendering, toggling | |
| 29.2.4 | `ShareButton`: opens share options | |
| 29.2.5 | `ReportButton`: opens report form | |
| 29.2.6 | `BlockButton`: rendering | |
| 29.2.7 | `ExportButton`: rendering | |
| 29.2.8 | `BackToTop`: appears on scroll, works | |

### 29.3 Forms
| # | Check | Status |
|---|-------|--------|
| 29.3.1 | All form inputs use `form-input` class or equivalent styling | |
| 29.3.2 | Select elements styled (not browser default) | |
| 29.3.3 | Textarea elements styled | |
| 29.3.4 | Error states show red border + message | |
| 29.3.5 | Success toast notifications appear | |

### 29.4 PDF Components
| # | Check | Status |
|---|-------|--------|
| 29.4.1 | Insurance Report button opens/generates | |
| 29.4.2 | Certificate of Authenticity generates | |

---

## 30. 🔍 Known Dead CSS Classes to Verify

> [!WARNING]
> These CSS classes are used in TSX files but no longer defined in [globals.css](file:///c:/Project%20Equispace/model-horse-hub/src/app/globals.css). Each reference will render with **no styling** — may cause layout/visual issues.

| Class | Refs | Files | Likely Impact |
|-------|------|-------|---------------|
| `page-content` | 9 | Events, Groups, Catalog | Missing container styling |
| `empty-state` | 6 | Groups, ArtistBrowser, CommissionBoard | Missing empty state styling |
| `skeleton-bg-card` | 6 | Loading pages | Broken skeleton loaders |
| `comment-error` | 15 | Events manage, many forms | Missing error styling |
| `hero-glow` | 2 | Landing page | Missing glow effect |
| `loading-skeleton` | 1 | Loading page | Broken skeleton |
| `quick-add-selected` | 2 | Quick add horse | Missing selection state |
| `feed-action-row` | 2 | Feed pages | Missing feed actions layout |
| `commission-actions-bar` | 2 | CommissionTimeline | Missing actions layout |
| `verified-badge` | 2 | Community detail, Passport | Missing verified styling |
| `claim-preview-bg-card` | 1 | Claim page | Missing claim preview |
| `ref-*` classes | 8 | Catalog pages | Missing catalog styling |
| `ai-fixed` | 1 | Add horse page | Missing AI indicator |
| `var(sticky` | 10 | Many pages | Garbled sticky positioning |
| `var(--header` | 25 | Many pages | Garbled header-height references |

---

## 31. 📐 Responsive Breakpoint Checklist

For **every page** above, verify at these widths:

| Width | Device | Key Checks |
|-------|--------|------------|
| **1440px** | Desktop | Multi-column grids fill space, no wasted gutters |
| **1024px** | Small laptop | Grids reflow to fewer columns |
| **768px** | Tablet | Side-by-side layouts stack, tables show fewer columns |
| **480px** | Small phone | Everything single-column, no horizontal overflow |
| **390px** | iPhone 14 | Tight spacing, buttons still tappable (44px targets) |

---

## 32. 🎨 Visual Polish Checklist

| # | Check | Status |
|---|-------|--------|
| 32.1 | No raw HTML/browser-default buttons anywhere | |
| 32.2 | No unstyled `<select>` elements | |
| 32.3 | No visible class names rendered as text | |
| 32.4 | No broken image placeholders (other than intentional "No photo") | |
| 32.5 | Consistent border-radius across cards (rounded-lg) | |
| 32.6 | Consistent shadow depth on cards | |
| 32.7 | Text contrast passes WCAG AA (4.5:1 ratio minimum) | |
| 32.8 | Focus outlines visible on keyboard navigation | |
| 32.9 | Animations are smooth, no janky transitions | |
| 32.10 | Colors match the brand palette (forest green, parchment) | |
| 32.11 | No duplicate borders (border-on-border artifacts) | |
| 32.12 | No elements with excessive padding (p-12 leftovers) | |

---

## Testing Order (Recommended)

> [!TIP]
> Start with the pages you and your beta testers visit most frequently. Fix critical issues before moving to less-trafficked pages.

1. **Dashboard** (most used) → Stable Grid → Stable Ledger
2. **Horse Passport** (most complex single page)
3. **Show Ring / Community** (public-facing)
4. **Landing Page** (first impression)
5. **Admin Console** (your daily tool)
6. **Profile Pages**
7. **Inbox / Notifications**
8. **Add Horse / Edit Horse** (core workflow)
9. **Shows** (photo shows section)
10. **Catalog** (reference data)
11. **Studio** (commissions)
12. **Groups / Events** (community features)
13. **Static Pages** (about, FAQ, contact, terms, privacy)
14. **Edge Cases** (loading, error, not-found, claim, transfer)
