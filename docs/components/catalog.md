# Component Catalog

All 112+ client components live in `src/components/`. Every component is a `"use client"` React component.

## Component Index by Domain

### 🐴 Stable & Inventory

| Component | File | Purpose |
|-----------|------|---------|
| `StableGrid` | `StableGrid.tsx` | Grid of horse cards with sorting, filtering |
| `StableLedger` | `StableLedger.tsx` | Table/ledger view of horses |
| `CollectionManager` | `CollectionManager.tsx` | Create/edit/delete collections |
| `CollectionPicker` | `CollectionPicker.tsx` | Add a horse to a collection |
| `CsvImport` | `CsvImport.tsx` | CSV file upload and preview |
| `DeleteHorseModal` | `DeleteHorseModal.tsx` | Confirmation modal for horse deletion |
| `UnifiedReferenceSearch` | `UnifiedReferenceSearch.tsx` | Fuzzy reference catalog search |
| `SuggestReferenceModal` | `SuggestReferenceModal.tsx` | Suggest a missing catalog entry |
| `MarketFilters` | `MarketFilters.tsx` | Blue Book market price filtering |
| `MarketValueBadge` | `MarketValueBadge.tsx` | Inline price estimate badge |

### 📸 Photos & Media

| Component | File | Purpose |
|-----------|------|---------|
| `PassportGallery` | `PassportGallery.tsx` | Public horse photo gallery (5 LSQ angles) |
| `PhotoLightbox` | `PhotoLightbox.tsx` | Full-screen photo viewer with nav |
| `ImageCropModal` | `ImageCropModal.tsx` | Crop and resize images on upload |
| `EventPhotoGallery` | `EventPhotoGallery.tsx` | Photo gallery for events |

### 🔐 Provenance (Hoofprint™)

| Component | File | Purpose |
|-----------|------|---------|
| `HoofprintTimeline` | `HoofprintTimeline.tsx` | Vertical timeline of provenance events |
| `ShowRecordForm` | `ShowRecordForm.tsx` | Add/edit show records |
| `ShowRecordTimeline` | `ShowRecordTimeline.tsx` | Show history timeline |
| `PedigreeCard` | `PedigreeCard.tsx` | Sire/dam family tree card |
| `ExportButton` | `ExportButton.tsx` | Download Certificate of Authenticity PDF |
| `InsuranceReportButton` | `InsuranceReportButton.tsx` | Generate insurance PDF |
| `ParkedExportPanel` | `ParkedExportPanel.tsx` | Park horse for transfer + CoA export |
| `TransferModal` | `TransferModal.tsx` | Generate/display transfer code |
| `TransferHistorySection` | `TransferHistorySection.tsx` | Ghost remnants of transferred horses |
| `VaultReveal` | `VaultReveal.tsx` | Private financial vault reveal toggle |

### 💰 Commerce (Safe-Trade)

| Component | File | Purpose |
|-----------|------|---------|
| `MakeOfferModal` | `MakeOfferModal.tsx` | Submit a purchase offer |
| `OfferCard` | `OfferCard.tsx` | Offer display with accept/decline actions |
| `TransactionActions` | `TransactionActions.tsx` | Payment sent, verify funds, cancel buttons |
| `RatingBadge` | `RatingBadge.tsx` | Star rating display badge |
| `RatingForm` | `RatingForm.tsx` | Submit a review form |
| `RatingStars` | `RatingStars.tsx` | Interactive star rating input |
| `MessageSellerButton` | `MessageSellerButton.tsx` | One-click DM to seller |

### 🎨 Art Studio

| Component | File | Purpose |
|-----------|------|---------|
| `ArtistBrowser` | `ArtistBrowser.tsx` | Browse/filter artist profiles |
| `CommissionBoard` | `CommissionBoard.tsx` | Artist dashboard commission kanban |
| `CommissionRequestForm` | `CommissionRequestForm.tsx` | Submit a commission request |
| `CommissionTimeline` | `CommissionTimeline.tsx` | Commission status timeline with actions |
| `LinkHorseToCommission` | `LinkHorseToCommission.tsx` | Link a horse to a commission |
| `GuestLinkButton` | `GuestLinkButton.tsx` | Generate guest link for non-registered clients |

### 👥 Social

| Component | File | Purpose |
|-----------|------|---------|
| `UniversalFeed` | `UniversalFeed.tsx` | Activity feed with infinite scroll |
| `ActivityFeed` | `ActivityFeed.tsx` | Recent activity events |
| `LoadMoreFeed` | `LoadMoreFeed.tsx` | Paginated feed loading |
| `LikeToggle` | `LikeToggle.tsx` | Like/unlike toggle button |
| `FollowButton` | `FollowButton.tsx` | Follow/unfollow user |
| `FavoriteButton` | `FavoriteButton.tsx` | Favorite/unfavorite horse |
| `ShareButton` | `ShareButton.tsx` | Native Web Share / copy URL |
| `BlockButton` | `BlockButton.tsx` | Block/unblock user |
| `RichText` | `RichText.tsx` | Markdown-like rich text renderer |
| `RichEmbed` | `RichEmbed.tsx` | URL preview card embed |
| `MatchmakerMatches` | `MatchmakerMatches.tsx` | Wishlist matchmaker results |

### 💬 Messaging

| Component | File | Purpose |
|-----------|------|---------|
| `ChatThread` | `ChatThread.tsx` | DM conversation view |
| `NotificationBell` | `NotificationBell.tsx` | Header notification icon with badge |
| `NotificationList` | `NotificationList.tsx` | Notification dropdown list |
| `MarkReadButton` | `MarkReadButton.tsx` | Mark notification as read |
| `MessageUserButton` | `MessageUserButton.tsx` | One-click DM button |

### 🏆 Competition & Shows

| Component | File | Purpose |
|-----------|------|---------|
| `CreateShowForm` | `CreateShowForm.tsx` | Create a new photo show |
| `ShowEntryForm` | `ShowEntryForm.tsx` | Enter a horse in a show |
| `ShowRingGrid` | `ShowRingGrid.tsx` | Grid of show entries with voting |
| `ShowRingFilters` | `ShowRingFilters.tsx` | Filter entries by division/class |
| `ShowStringManager` | `ShowStringManager.tsx` | Manage show string (horses for shows) |
| `AssignPlacings` | `AssignPlacings.tsx` | Admin tool for assigning show placings |
| `ExpertJudgingPanel` | `ExpertJudgingPanel.tsx` | Expert judge scoring interface |
| `CloseShowButton` | `CloseShowButton.tsx` | Close a show and finalize results |
| `VoteButton` | `VoteButton.tsx` | Vote for an entry |
| `WithdrawButton` | `WithdrawButton.tsx` | Withdraw entry from show |
| `NanDashboardWidget` | `NanDashboardWidget.tsx` | NAN qualifying progress dashboard |

### 🏘️ Community

| Component | File | Purpose |
|-----------|------|---------|
| `DiscoverGrid` | `DiscoverGrid.tsx` | User discovery grid |
| `EventBrowser` | `EventBrowser.tsx` | Browse community events |
| `EventDeleteButton` | `EventDeleteButton.tsx` | Delete event button |
| `EventRsvpButton` | `EventRsvpButton.tsx` | RSVP to event |
| `GroupBrowser` | `GroupBrowser.tsx` | Browse groups |
| `GroupDetailClient` | `GroupDetailClient.tsx` | Group detail page client logic |
| `GroupAdminPanel` | `GroupAdminPanel.tsx` | Group admin tools |
| `GroupFiles` | `GroupFiles.tsx` | Group file browser |
| `GroupRegistry` | `GroupRegistry.tsx` | Group member registry |
| `HelpIdDetailClient` | `HelpIdDetailClient.tsx` | Help ID request detail |
| `HelpIdRequestForm` | `HelpIdRequestForm.tsx` | Submit help ID request |

### 📋 Utility & Layout

| Component | File | Purpose |
|-----------|------|---------|
| `Header` | `Header.tsx` | Main navigation header |
| `Footer` | `Footer.tsx` | Site footer |
| `DashboardShell` | `DashboardShell.tsx` | Dashboard layout wrapper |
| `DashboardToast` | `DashboardToast.tsx` | Toast notification system |
| `SearchBar` | `SearchBar.tsx` | Global search bar |
| `UserAvatar` | `UserAvatar.tsx` | User avatar with fallback |
| `BackToTop` | `BackToTop.tsx` | Scroll to top button |
| `CookieConsent` | `CookieConsent.tsx` | GDPR cookie consent banner |
| `EmptyState` | `EmptyState.tsx` | Standardized empty states with icon + CTA |
| `UpgradeButton` | `UpgradeButton.tsx` | Pro tier upgrade CTA |
| `TrophyCase` | `TrophyCase.tsx` | Badge/achievement display |
| `FeaturedHorseCard` | `FeaturedHorseCard.tsx` | Featured horse card |
| `FeatureHorseForm` | `FeatureHorseForm.tsx` | Admin: feature a horse |

### 🎨 shadcn/ui Primitives

| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `ui/button.tsx` | Variants: default, outline, ghost, destructive |
| `Input` | `ui/input.tsx` | Text input |
| `Textarea` | `ui/textarea.tsx` | Multi-line text input |
| `Select` | `ui/select.tsx` | Dropdown select (Radix) |
| `Badge` | `ui/badge.tsx` | Status/tag badges |
| `Dialog` | `ui/dialog.tsx` | Modal dialog (Radix) |
| `Skeleton` | `ui/skeleton.tsx` | Loading skeleton |
| `Separator` | `ui/separator.tsx` | Visual divider |

### 📌 Page Layout Archetypes

| Component | File | Purpose |
|-----------|------|---------|
| `ExplorerLayout` | `layouts/ExplorerLayout.tsx` | Browsing grids (max-w-7xl, sticky filters) |
| `ScrapbookLayout` | `layouts/ScrapbookLayout.tsx` | Split-view details (1.5fr/1fr, sticky sidebar) |
| `CommandCenterLayout` | `layouts/CommandCenterLayout.tsx` | Dashboards (max-w-[1600px], main + sidebar) |
| `FocusLayout` | `layouts/FocusLayout.tsx` | Forms/data entry (max-w-2xl, centered) |

### 📚 Catalog Curation (V32)

| Component | File | Purpose |
|-----------|------|---------|
| `CatalogBrowser` | `CatalogBrowser.tsx` | Debounced search, maker chips, scale filter, sortable table, pagination |
| `SuggestEditModal` | `SuggestEditModal.tsx` | Pre-filled edit form with amber change highlighting and diff summary |
| `SuggestionVoteButtons` | `SuggestionVoteButtons.tsx` | Optimistic ▲/▼ voting with toggle, switch, and net score |
| `SuggestionCommentThread` | `SuggestionCommentThread.tsx` | Discussion threads with add/delete and relative timestamps |
| `SuggestionAdminActions` | `SuggestionAdminActions.tsx` | Admin approve/reject with required reason for rejections |
| `SuggestNewEntryForm` | `SuggestNewEntryForm.tsx` | Propose a new catalog model with title, type, maker, scale, mold, year (V33) |

### 🔧 Admin

| Component | File | Purpose |
|-----------|------|---------|
| `AdminTabs` | `AdminTabs.tsx` | Admin dashboard tab navigation |
| `AdminReplyForm` | `AdminReplyForm.tsx` | Admin reply to contact form |
| `AdminShowManager` | `AdminShowManager.tsx` | Admin show management |
| `AdminSuggestionsPanel` | `AdminSuggestionsPanel.tsx` | Admin catalog suggestion review |
| `ReportButton` | `ReportButton.tsx` | Report content button |
| `ReportActions` | `ReportActions.tsx` | Admin report resolution actions |

### 💳 Wishlist

| Component | File | Purpose |
|-----------|------|---------|
| `WishlistButton` | `WishlistButton.tsx` | Add to wishlist toggle |
| `WishlistRemoveButton` | `WishlistRemoveButton.tsx` | Remove from wishlist |
| `WishlistSearch` | `WishlistSearch.tsx` | Search wishlist items |
| `EditBioButton` | `EditBioButton.tsx` | Inline bio editing button |

## Total Component Count: 107

---

**Next:** [Component Patterns](patterns.md) · [Design System](design-system.md)
