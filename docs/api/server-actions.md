# Server Actions Reference

All backend logic lives in **58 `"use server"` files** under `src/app/actions/`, plus one outside
it (`src/app/auth/actions.ts`). This document is the master index by domain.

> Some `src/lib/**` and `src/app/*/reads.ts` files contain the string `"use server"` inside
> comments explaining why the module is deliberately *not* an action file. Those are not actions.

## How Server Actions Work

1. Server action files declare `"use server"` at the top
2. Client components import functions directly: `import { doThing } from "@/app/actions/x"`
3. Next.js serializes the call as a POST request
4. All actions return `{ success: boolean; error?: string; data?: T }`

For the full request lifecycle, see [Data Flow](../architecture/data-flow.md).

## The Order (Iron Law 7)

```
zod parse → requireAuth() → explicit ownership/role check → RLS-first write
```

The admin client is used only with a code comment justifying why RLS can't do the job. Business
logic belongs in a pure `src/lib/<domain>/` module, not inline in the action — actions stay thin.

## Domain Index

### 🐴 Inventory & Stable

| File | Functions |
|------|-----------|
| [`horse.ts`](../../src/app/actions/horse.ts) | `createHorseRecord`, `updateHorseAction`, `quickAddHorse`, `deleteHorse`, `listDeletedHorses`, `restoreHorse`, `finalizeHorseImages`, `deleteHorseImageAction`, `reorderHorseImages`, `bulkUpdateHorses`, `bulkDeleteHorses`, `searchPublicHorses`, `getMyTier` |
| [`stable.ts`](../../src/app/actions/stable.ts) | `getStablePage`, `loadMoreStable`, `getMatchingHorseIds`, `getStableSummary`, `listStableViews`, `saveStableView`, `deleteStableView` |
| [`collections.ts`](../../src/app/actions/collections.ts) | `getCollectionsAction`, `createCollectionAction`, `updateCollectionAction`, `deleteCollectionAction`, `getHorseCollections`, `setHorseCollections` |
| [`csv-import.ts`](../../src/app/actions/csv-import.ts) | `executeBatchImport`, `getExistingHorseNames` |
| [`favorites.ts`](../../src/app/actions/favorites.ts) | `getFavoritesPage`, `loadMoreFavorites` |
| [`wishlist.ts`](../../src/app/actions/wishlist.ts) | `addToWishlist`, `removeFromWishlist`, `getWishlistState` |

> **Recently Deleted:** `deleteHorse` stashes the horse's name in `attributes` under the
> `mhh:deleted_name` key so `restoreHorse` can put it back. `/stable/deleted` is the undo surface.

### 🔐 Provenance (Hoofprint)

| File | Functions |
|------|-----------|
| [`hoofprint.ts`](../../src/app/actions/hoofprint.ts) | `getHoofprint`, `addTimelineEvent`, `deleteTimelineEvent`, `updateLifeStage`, `initializeHoofprint`, `generateTransferCode`, `claimTransfer`, `cancelTransfer`, `getMyPendingTransfers`, `getTransferHistory` |
| [`provenance.ts`](../../src/app/actions/provenance.ts) | `addShowRecord`, `updateShowRecord`, `deleteShowRecord`, `savePedigree`, `deletePedigree` |
| [`conditionHistory.ts`](../../src/app/actions/conditionHistory.ts) | `getConditionHistory` — the condition ledger, reading the history written since migration 026 |
| [`parked-export.ts`](../../src/app/actions/parked-export.ts) | `parkHorse`, `unparkHorse`, `getParkedHorseByPin`, `claimParkedHorse`, `getCoaData` |
| [`insurance-report.ts`](../../src/app/actions/insurance-report.ts) | `getInsuranceReportData` |
| [`photos.ts`](../../src/app/actions/photos.ts) | `getPhotoBySlug` |

### 💰 Commerce, Market & the Deal Room

| File | Functions |
|------|-----------|
| [`deals.ts`](../../src/app/actions/deals.ts) | `proposeTerms`, `agreeToTerms`, `withdrawTermsAgreement`, `clearTerms`, `savePaymentPlan`, `markInstallmentSent`, `confirmInstallmentReceived`, `counterOffer`, `respondToCounter`, `raiseDispute`, `standDownDispute`, `recordSaleInVault`, `attachCommissionToThread`, `getDealStage`, `markThreadRead`, `setThreadMuted`, `setThreadArchived` |
| [`transactions.ts`](../../src/app/actions/transactions.ts) | `createTransaction`, `makeOffer`, `respondToOffer`, `retractOffer`, `markPaymentSent`, `verifyFundsAndRelease`, `completeTransaction`, `cancelTransaction`, `getTransactionsForUser`, `getTransactionByConversation`, `leaveReview`, `deleteReview`, `getUserReviewSummary`, `getReviewableTransactions` |
| [`messaging.ts`](../../src/app/actions/messaging.ts) | `createOrFindConversation`, `sendMessage`, `getConversationAttachments`, `markConversationRead`, `getUnreadCount`, `markTransactionComplete` |
| [`market.ts`](../../src/app/actions/market.ts) | `getMarketPrice`, `searchMarketPrices`, `getTopTraded`, `refreshMarketPrices` |
| [`marketPublicRecord.ts`](../../src/app/actions/marketPublicRecord.ts) | `getPublicMarketHorseRecord` — the anon record quick-look on a listing card |
| [`purchased-reports.ts`](../../src/app/actions/purchased-reports.ts) | `getMyPurchasedReports` — backs `/market/reports` |
| [`supporter.ts`](../../src/app/actions/supporter.ts) | `setSupporterLedgerListing` |
| [`ratings.ts`](../../src/app/actions/ratings.ts) | `leaveRating`, `deleteRating`, `getUserRatingSummary` (legacy) |

> **Anon market browse** goes through the `get_market_listings` RPC (migration 169) with a
> service-role fallback — see `src/lib/market/rpcListings.ts`. Blocked sellers are excluded at
> the query level, not in the UI.
>
> **Deal vocabulary** is centralised in [`src/lib/deals/vocabulary.ts`](../../src/lib/deals/vocabulary.ts):
> 8 stages — `talking`, `proposed`, `agreed`, `paying`, `fulfilling`, `settled`, `closed`,
> `disputed` — with parties A/B derived from `transactions`. The evidence pack is assembled in
> [`src/lib/deals/evidence.ts`](../../src/lib/deals/evidence.ts) and rendered at `/inbox/[id]/record`.

### 🎨 Art Studio

| File | Functions |
|------|-----------|
| [`art-studio.ts`](../../src/app/actions/art-studio.ts) | `getArtistProfile`, `getArtistProfileBySlug`, `createArtistProfile`, `updateArtistProfile`, `updateStudioTerms`, `updateStudioServices`, `setStudioIntake`, `getSlotUsage`, `browseArtists`, `getArtistPortfolio`, `getArtistCommissions`, `getClientCommissions`, `getCommission`, `getCommissionUpdates`, `createCommission`, `sendQuote`, `transitionCommission`, `addCommissionUpdate`, `markModelReceived`, `recordPayment`, `linkHorseToCommission`, `recordCommissionInVault` |

> Pipeline rules live in [`src/lib/studio/pipeline.ts`](../../src/lib/studio/pipeline.ts). The
> free-tier cap of 3 active commissions is enforced in `sendQuote` and on the `accept`
> transition — not in SQL.

### 🏆 Shows & Competition

Four generations coexist. Know which you are in before you edit.

| File | Functions |
|------|-----------|
| [`shows-v2.ts`](../../src/app/actions/shows-v2.ts) | Host + entrant surface: `createShow`, `updateShowSettings`, `deleteShow`, `transitionShowStatus`, `addDivision`/`addSection`/`addClass` (+ `update*`), `reorderClasslist`, `splitClass`, `combineClasses`, `loadNamhsaTemplate`, `addShowStaff`, `removeShowStaff`, `setFeePaid`, `getHostedShows`, `getShowConsole`, `getPublicShows`, `getPublicShow`, `enterClass`, `scratchEntry`, `getMyShowEntries`, `getMyEntrantHorses`, `getMyHandlerEntries`, `removeSelfAsHandler`, `getShowGallery`, `castVote`, `removeVote`, `getJudgeQueue`, `recordPlacings`, `finalizeCommunityVotes`, `findUserByAlias` |
| [`shows-v2-ring.ts`](../../src/app/actions/shows-v2-ring.ts) | `getRingConsole`, `recordCallback`, `getRingBoard`, `getShowChampions` |
| [`shows-v4.ts`](../../src/app/actions/shows-v4.ts) | `barEntrant`, `liftBar`, `listBarredEntrants`, `voidCard`, `strikeEntryFromResults`, `writeCritique`, `publishClassResults`, `unpublishClassResults`, `getClassRoom`, `createHorseDocument`, `updateHorseDocument`, `deleteHorseDocument`, `attachDocumentToEntry` |
| [`shows.ts`](../../src/app/actions/shows.ts) | Legacy v1 photo shows — `getPhotoShows`, `enterShow`, `voteForEntry`, `createPhotoShow`, `updateShowStatus`, `withdrawEntry`, `batchRecordResults`, `saveExpertPlacings`, `overrideFinalPlacings`, `getShowHistory`, `getPublicShowResults` |
| [`competition.ts`](../../src/app/actions/competition.ts) | Legacy engine + Show Packer + NAN dashboard — `getNanQualifications`, `getNanDashboard`, `exportNanCards`, `checkJudgeCOI`, `addShowRecord`, `verifyShowRecord`, the `show_strings` CRUD, `convertShowStringToResults`, `detectConflicts`, and the `event_divisions`/`event_classes` CRUD |
| [`showring.ts`](../../src/app/actions/showring.ts) | `getShowRingPage`, `loadMoreShowRing` |
| [`show-life.ts`](../../src/app/actions/show-life.ts) · [`show-readiness.ts`](../../src/app/actions/show-readiness.ts) | `getMyShowLife`; `getMyShowReadiness`, `listMyEntrantHorses` |
| [`show-announcements.ts`](../../src/app/actions/show-announcements.ts) | `announceToEntrants` |
| [`entry-photo.ts`](../../src/app/actions/entry-photo.ts) | `addShowPhotoToHorse` |
| [`external-shows.ts`](../../src/app/actions/external-shows.ts) | `submitExternalShow`, `listApprovedExternalShows`, `listPendingExternalShows`, `reviewExternalShow` — the `/calendar` surface |
| [`standings.ts`](../../src/app/actions/standings.ts) | `getMySeason`, `getStandings` — **dark** behind `NEXT_PUBLIC_SHOW_STANDINGS` |
| [`horse-events.ts`](../../src/app/actions/horse-events.ts) | `notifyHorsePublic` |

> `competition.ts` and the Show Packer are **not** dead code — they serve real-world show
> entrants today, and `LegacyShowPage` renders their shows. They become deletable only after a
> data migration moves historical shows into the v2 tables.

### 📰 The Paddock & Social

| File | Functions |
|------|-----------|
| [`posts.ts`](../../src/app/actions/posts.ts) | `getFeedStream` (the Paddock spine), `getFeedCapabilities`, `getFeedPost`, `createPost`, `replyToPost`, `updatePost`, `deletePost`, `togglePostLike`, `getPosts`, `getHorseEmbedData`, `searchAliases`, `getEventMedia`, `addEventMedia`, `deleteEventMedia` |
| [`activity.ts`](../../src/app/actions/activity.ts) | `createActivityEvent`, `createTextPost`, `deleteTextPost`, `getActivityFeed`, `getFollowingFeed` |
| [`mentions.ts`](../../src/app/actions/mentions.ts) | `resolveMentionedAliases`, `parseAndNotifyMentions` |
| [`follows.ts`](../../src/app/actions/follows.ts) | `toggleFollow`, `getFollowStats` |
| [`likes.ts`](../../src/app/actions/likes.ts) | `toggleActivityLike`, `toggleGroupPostLike`, `toggleCommentLike` |
| [`social.ts`](../../src/app/actions/social.ts) | `toggleFavorite` |
| [`blocks.ts`](../../src/app/actions/blocks.ts) | `blockUser`, `unblockUser`, `getBlockedUserIds`, `isBlocked` |
| [`community.ts`](../../src/app/actions/community.ts) | `loadMoreShowRing` |

> The stream merges `posts` with legacy `activity_events` **read-only** — see
> [`src/lib/feed/stream.ts`](../../src/lib/feed/stream.ts). Mention resolution uses
> longest-alias matching in [`src/lib/feed/mentionMatch.ts`](../../src/lib/feed/mentionMatch.ts),
> shared by the `MentionTextarea` autocomplete and `RichText`'s `knownAliases`.

### 🏘️ Barns, Events & Community

| File | Functions |
|------|-----------|
| [`groups.ts`](../../src/app/actions/groups.ts) | `createGroup`, `updateBarnSettings`, `getGroup`, `getGroups`, `getMyGroups`, `joinGroup`, `leaveGroup`, `requestToJoinBarn`, `cancelBarnJoinRequest`, `getBarnJoinRequests`, `decideBarnJoinRequest`, `getGroupRegistry`, `getGroupMembers`, `updateMemberRole`, `removeMember`, `togglePinPost`, `getGroupFiles`, `uploadGroupFile`, `deleteGroupFile`, `getGroupChannels`, `createGroupChannel`, `deleteGroupChannel` |
| [`groups-forum.ts`](../../src/app/actions/groups-forum.ts) | `getGroupBoard`, `markGroupRead`, `getThread`, `createThread`, `replyToThread` |
| [`events.ts`](../../src/app/actions/events.ts) | `createEvent`, `updateEvent`, `deleteEvent`, `getEvents`, `getEvent`, `getUpcomingEvents`, `rsvpEvent`, `getEventAttendees`, `addEventComment`, `deleteEventComment`, `getEventComments`, `addEventPhoto`, `getEventPhotos`, `deleteEventPhoto`, `getEventJudges`, `addEventJudge`, `removeEventJudge`, `searchUsers` |
| [`help-id.ts`](../../src/app/actions/help-id.ts) | `createIdRequest`, `createSuggestion`, `upvoteSuggestion`, `acceptSuggestion`, `addIdentifiedHorse`, `deleteIdRequest` |
| [`contact.ts`](../../src/app/actions/contact.ts) | `submitContactForm` |
| [`moderation.ts`](../../src/app/actions/moderation.ts) | `getReportReasons`, `submitReport`, `getOpenReports`, `dismissReport`, `actionReport` |

> **Creating `live_show` / `photo_show` events is removed and server-guarded.** Events are now
> listing pages for happenings outside MHH. Existing legacy shows still render.

### 📚 Registry (Catalog) & Reference

| File | Functions |
|------|-----------|
| [`reference.ts`](../../src/app/actions/reference.ts) | `searchCatalogAction`, `searchCatalogFuzzy`, `getCatalogItem`, `getReleasesForMold`, `matchCsvRowsBatch` |
| [`reference-pages.ts`](../../src/app/actions/reference-pages.ts) | `unstable_cache` readers for the public `/reference` pages: `resolveReferenceItem`, `getActiveListingsForCatalog`, `getCatalogPhotos`, `getChildReleases`, `getCatalogCounts`, `getReferenceMarket`, `getReferenceMarketHistory` (+ `REFERENCE_PAGES_CACHE_TAG`) |
| [`maker-hubs.ts`](../../src/app/actions/maker-hubs.ts) | `getMakerIndex`, `getMakerMolds`, `getMakerRecent` |
| [`catalog-suggestions.ts`](../../src/app/actions/catalog-suggestions.ts) | `getCatalogItems`, `getCatalogItem`, `createSuggestion`, `getSuggestions`, `getSuggestion`, `voteSuggestion`, `removeVote`, `getUserVote`, `addSuggestionComment`, `deleteSuggestionComment`, `reviewSuggestion`, `getChangelog`, `getTopCurators` |

> Approved corrections merge into `catalog_items.attributes` JSONB via
> [`src/lib/catalog/corrections.ts`](../../src/lib/catalog/corrections.ts) — never top-level
> columns. Filter dropdowns come from `get_catalog_facets()`.

### 👤 Account, Profile & Platform

| File | Functions |
|------|-----------|
| [`profile.ts`](../../src/app/actions/profile.ts) | `updateBio`, `loadMoreProfileHorses`, `getMyCustomization`, `saveProfileCustomization`, `uploadProfileBanner` |
| [`settings.ts`](../../src/app/actions/settings.ts) | `getProfile`, `updateProfile`, `updateNotificationPrefs`, `changePassword`, `uploadAvatar`, `deleteAccount` |
| [`notifications.ts`](../../src/app/actions/notifications.ts) | `getUnreadNotificationCount`, `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `clearNotifications` |
| [`header.ts`](../../src/app/actions/header.ts) | `getHeaderData` |
| [`src/app/auth/actions.ts`](../../src/app/auth/actions.ts) | `loginAction`, `signupAction`, `resendConfirmationAction`, `forgotPasswordAction` — the only action file outside `src/app/actions/` |

> Profile customization (migration 171) is a single `users.profile_customization` JSONB bag,
> validated app-side by `sanitizeCustomization`. Notification preference groups have a
> drift-guard test; `link_url` deep links are checked same-origin before use.

### 🔧 Admin

| File | Functions |
|------|-----------|
| [`admin.ts`](../../src/app/actions/admin.ts) | `getAdminPulse`, `getMigrationStatus`, `getEnvFlagStatus`, `searchMembers`, `suspendUser`/`unsuspendUser` (+ `*ByAlias`), `listAnnouncements`, `createAnnouncement`, `deleteAnnouncement`, `featureHorse`, `setFeedPostPinned`, `listLegacySuggestions`, `resolveLegacySuggestion`, `findCatalogDuplicates`, `mergeCatalogItems`, `listSanctioningRequests`, `resolveSanctioningRequest`, `listOverdueShows`, `nudgeOverdueShowHost`, `toggleMessageRead`, `replyToContactMessage`, `deleteContactMessage` |
| [`admin-insights.ts`](../../src/app/actions/admin-insights.ts) | `getAdminInsights` — the object-metrics dashboard |

See [OPERATOR_PLAYBOOK.md](../OPERATOR_PLAYBOOK.md) for the console's shape.

## Auth Patterns

Every mutating server action begins with one of:

```typescript
// Pattern A: requireAuth() — preferred for mutations
const { supabase, user } = await requireAuth();

// Pattern B: createClient() — for read-only or public data
const supabase = await createClient();
```

Anon-readable surfaces use `src/lib/supabase/anon.ts` or a `SECURITY DEFINER` RPC; the
service-role client (`src/lib/supabase/admin.ts`) is the last resort and always carries a
justification comment.

See [Auth Flow](../architecture/auth-flow.md) for details.

---

**Next:** [API Routes](routes.md) · [Architecture Overview](../architecture/overview.md)
