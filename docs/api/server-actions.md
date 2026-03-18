# Server Actions Reference

All backend logic lives in 35 `"use server"` files under `src/app/actions/`. This document is the master index with function counts and domain groupings.

## How Server Actions Work

1. Server action files declare `"use server"` at the top
2. Client components import functions directly: `import { doThing } from "@/app/actions/x"`
3. Next.js serializes the call as a POST request
4. All actions return `{ success: boolean; error?: string; data?: T }`

For the full request lifecycle, see [Data Flow](../architecture/data-flow.md).

## Domain Index

### 🐴 Inventory & Horses

| File | Functions | Purpose |
|------|-----------|---------|
| [`horse.ts`](actions/horse.md#horse) | `createHorse`, `updateHorse`, `deleteHorse`, `getHorse`, `getMyHorses`, `getPublicHorses`, `toggleVisibility` + more | Core CRUD for horses |
| [`collections.ts`](actions/inventory.md#collections) | `createCollection`, `updateCollection`, `deleteCollection`, `addToCollection`, `removeFromCollection`, `getCollections` | Collection management |
| [`csv-import.ts`](actions/inventory.md#csv-import) | `importHorsesFromCsv`, `previewCsvImport` | Batch CSV import |
| [`reference.ts`](actions/inventory.md#reference) | `searchCatalogAction`, `getCatalogItem`, `getReleasesForMold` | Reference catalog search |
| [`suggestions.ts`](actions/inventory.md#suggestions) | `submitSuggestion`, `getPendingSuggestions`, `reviewSuggestion` | Catalog suggestions |

### 🔐 Provenance (Hoofprint™)

| File | Functions | Purpose |
|------|-----------|---------|
| [`hoofprint.ts`](actions/provenance.md#hoofprint) | `getHoofprint`, `addTimelineEvent`, `deleteTimelineEvent`, `updateLifeStage`, `initializeHoofprint`, `generateTransferCode`, `claimTransfer`, `cancelTransfer`, `getMyPendingTransfers`, `getTransferHistory` | Timeline, transfers |
| [`provenance.ts`](actions/provenance.md#provenance) | `addShowRecord`, `updateShowRecord`, `deleteShowRecord`, `savePedigree`, `deletePedigree` | Show records, pedigrees |
| [`parked-export.ts`](actions/provenance.md#parked-export) | `parkHorse`, `unparkHorse`, `getParkedStatus`, `generateCoA` | Horse parking, CoA export |
| [`insurance-report.ts`](actions/provenance.md#insurance-report) | `generateInsuranceReport` | PDF insurance reports |

### 💰 Commerce

| File | Functions | Purpose |
|------|-----------|---------|
| [`transactions.ts`](actions/commerce.md#transactions) | `createTransaction`, `completeTransaction`, `makeOffer`, `respondToOffer`, `markPaymentSent`, `verifyFundsAndRelease`, `cancelTransaction`, `retractOffer`, `getTransactionsForUser`, `getTransactionByConversation`, `getReviewableTransactions` | Safe-Trade state machine |
| [`ratings.ts`](actions/commerce.md#ratings) | `leaveRating`, `deleteRating`, `getUserRatingSummary` | Legacy ratings |
| [`transactions.ts`](actions/commerce.md#reviews) | `leaveReview`, `deleteReview`, `getUserReviewSummary` | Post-transaction reviews |
| [`market.ts`](actions/commerce.md#market) | `getMarketPrices`, `refreshMarketPrices` | Blue Book price guide |
| [`wishlist.ts`](actions/commerce.md#wishlist) | `addToWishlist`, `removeFromWishlist` | Wishlist management |

### 🎨 Art Studio

| File | Functions | Purpose |
|------|-----------|---------|
| [`art-studio.ts`](actions/art-studio.md) | `getArtistProfile`, `getArtistProfileBySlug`, `createArtistProfile`, `updateArtistProfile`, `getArtistCommissions`, `getClientCommissions`, `createCommission`, `updateCommissionStatus`, `addCommissionUpdate`, `getCommissionUpdates`, `getCommission`, `browseArtists`, `linkHorseToCommission` + more | Full commission workflow |

### 👥 Social

| File | Functions | Purpose |
|------|-----------|---------|
| [`posts.ts`](actions/social.md#posts) | `createPost`, `replyToPost`, `deletePost`, `getPostThread` | Posts & replies |
| [`likes.ts`](actions/social.md#likes) | `toggleLike`, `getLikeCount`, `isLiked` | Like toggling |
| [`follows.ts`](actions/social.md#follows) | `toggleFollow`, `getFollowers`, `getFollowing`, `isFollowing` | Follow system |
| [`social.ts`](actions/social.md#favorites) | `toggleFavorite` | Horse favorites |
| [`activity.ts`](actions/social.md#activity) | `createActivityEvent`, `getActivityFeed` | Activity feed events |
| [`mentions.ts`](actions/social.md#mentions) | `searchMentions` | @mention search |
| [`blocks.ts`](actions/social.md#blocks) | `blockUser`, `unblockUser`, `isBlocked`, `getBlockedUsers` | Block system |

### 💬 Messaging

| File | Functions | Purpose |
|------|-----------|---------|
| [`messaging.ts`](actions/social.md#messaging) | `sendMessage`, `getConversations`, `getMessages`, `startConversation`, `getOrCreateConversation`, `markConversationRead` | DM system |
| [`notifications.ts`](actions/social.md#notifications) | `getNotifications`, `markAsRead`, `markAllRead`, `getUnreadCount` | Notification system |

### 🏆 Competition

| File | Functions | Purpose |
|------|-----------|---------|
| [`shows.ts`](actions/competition.md#shows) | `getPhotoShows`, `getShowEntries`, `enterShow`, `voteForEntry`, `createPhotoShow`, `updateShowStatus`, `deleteShow`, `withdrawEntry`, `batchRecordResults`, `saveExpertPlacings` | Photo show system |
| [`competition.ts`](actions/competition.md#competition) | `getCompetitions`, `getCompetition`, `createCompetition`, `updateCompetition`, `enterCompetition`, `getMyEntries` | Live competition engine |
| [`events.ts`](actions/competition.md#events) | `createEvent`, `updateEvent`, `deleteEvent`, `getEvents`, `getEvent`, `rsvpToEvent` | Community events |
| [`horse-events.ts`](actions/competition.md#horse-events) | `getHorseShowHistory`, `getHorseNanProgress` | Horse show history |

### 👤 User & Settings

| File | Functions | Purpose |
|------|-----------|---------|
| [`profile.ts`](actions/user.md#profile) | `updateBio` | Profile bio editing |
| [`settings.ts`](actions/user.md#settings) | `getProfile`, `updateProfile`, `updateNotificationPrefs`, `changePassword`, `uploadAvatar`, `deleteAccount` | User settings |
| [`header.ts`](actions/user.md#header) | `getHeaderData` | Header nav data (alias, avatar, unread count) |

### 🏘️ Community

| File | Functions | Purpose |
|------|-----------|---------|
| [`groups.ts`](actions/community.md) | `createGroup`, `getGroups`, `getGroup`, `joinGroup`, `leaveGroup`, `updateGroup`, `deleteGroup`, `uploadGroupFile`, `getGroupFiles` + more | Group system |
| [`help-id.ts`](actions/community.md#help-id) | `createHelpIdRequest`, `getHelpIdRequests`, `getHelpIdRequest`, `replyToHelpId` | Help ID requests |
| [`moderation.ts`](actions/community.md#moderation) | `submitReport`, `getReports`, `resolveReport` | Content moderation |
| [`contact.ts`](actions/community.md#contact) | `submitContactMessage` | Contact form |

### 🔧 Admin

| File | Functions | Purpose |
|------|-----------|---------|
| [`admin.ts`](actions/user.md#admin) | `getAdminStats`, `getAdminUsers`, `toggleVerified`, `getAdminReports` | Admin dashboard |

### 📚 Catalog Curation (V32)

| File | Functions | Purpose |
|------|-----------|---------|
| [`catalog-suggestions.ts`](actions/catalog-suggestions.md) | `getCatalogItems`, `getCatalogItem`, `createSuggestion`, `getSuggestions`, `getSuggestion`, `voteSuggestion`, `removeVote`, `getUserVote`, `addSuggestionComment`, `deleteSuggestionComment`, `reviewSuggestion`, `getChangelog`, `getTopCurators` | Community catalog curation — browsing, suggestions, voting, discussion, admin review, trusted curator auto-approve, changelog |

## Auth Patterns

Every mutating server action begins with one of:

```typescript
// Pattern A: requireAuth() — preferred for mutations
const { supabase, user } = await requireAuth();

// Pattern B: createClient() — for read-only or public data
const supabase = await createClient();
```

See [Auth Flow](../architecture/auth-flow.md) for details.

---

**Next:** [API Routes](routes.md) · [Architecture Overview](../architecture/overview.md)
