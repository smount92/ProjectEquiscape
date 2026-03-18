# ADR 006: Private Storage with Signed URLs

**Status:** Accepted  
**Date:** January 2026  
**Deciders:** Project team

## Context

Horse images are personal property photos — some horses are marked private, others are public. Storage options:
1. **Public bucket** — Anyone with the URL can access any image
2. **Private bucket with signed URLs** — Images require a time-limited signed URL to access

## Decision

Use a **private Supabase Storage bucket** (`horse-images`) and generate **time-limited signed URLs** for rendering.

## Rationale

- **Privacy-first:** Private horses' images cannot be hotlinked or scraped
- **Access control:** Storage policies enforce visibility based on `user_horses.is_public` and `owner_id`
- **TTL:** Signed URLs expire, preventing stale bookmarks to private content
- **Selective access:** Commission WIP photos, social images, and event images have separate read policies

## Implementation

Storage policies in migration `089_commission_wip_photos.sql`:

```sql
CREATE POLICY "Horse image read (public horses)" ON storage.objects FOR SELECT
USING (
    bucket_id = 'horse-images'
    AND (
        -- Social and event images: public
        (storage.foldername(name))[1] = 'social'
        OR (storage.foldername(name))[1] = 'events'
        -- Commission WIP photos: public
        OR (storage.foldername(name))[2] = 'commissions'
        -- Horse images: public if horse.is_public OR owner
        OR EXISTS (
            SELECT 1 FROM user_horses
            WHERE id = ((storage.foldername(name))[2])::uuid
            AND (is_public = true OR owner_id = (SELECT auth.uid()))
        )
    )
);
```

Application code uses `getSignedImageUrl()` from `@/lib/utils/storage.ts`:

```typescript
const url = await getSignedImageUrl(imagePath);
// Returns a time-limited URL that expires
```

## Consequences

- All image rendering goes through signed URLs — no direct public links
- Signed URL generation adds a small latency per image
- Avatar images use a separate pattern (public user profile images)
- Storage path convention: `horse-images/{userId}/horses/{horseId}/{filename}`
