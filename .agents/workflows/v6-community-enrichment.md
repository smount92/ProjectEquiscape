---
description: V6 Community Enrichment — Event comments/attendees/photos, Group search, Art Studio search, Feed post detail pages. 3 phases, ~15 atomic tasks.
---

# V6 Community Enrichment Sprint

> **Pre-requisites:** V5 complete, migration 039 applied, build clean.
> **Architectural Rules:**
> - Server actions return `{ success, error }` — no exceptions
> - PostgREST joins for aliases (no aliasMap)
> - Direct-to-storage for uploads (V2 pattern)
> - Vanilla CSS only, all styles in `globals.css`
> - RLS on every new table

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. If you encounter issues or make design decisions, add a brief note under the task
> 4. Run `npx next build` after every task and note the result
> 5. Do NOT skip updating this file — the human uses it to track progress

---

## Phase 1: Event Enhancement

> **Goal:** Transform events from static listings into living community hubs — comments, attendee lists, and photo galleries.

### Task 1.1 — Migration 041: Event Comments & Photos

Create `supabase/migrations/041_event_enrichment.sql`:

```sql
-- ============================================================
-- Migration 041: Event Enrichment
-- Event comments, event photos, attendee visibility
-- ============================================================

-- ── Event Comments ──
CREATE TABLE IF NOT EXISTS event_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments on any event
CREATE POLICY "event_comments_select"
  ON event_comments FOR SELECT TO authenticated USING (true);

-- Users can post their own comments
CREATE POLICY "event_comments_insert"
  ON event_comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Author or event creator can delete
CREATE POLICY "event_comments_delete"
  ON event_comments FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_comments.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_event_comments_event ON event_comments (event_id, created_at);

-- ── Event Photos ──
CREATE TABLE IF NOT EXISTS event_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path  TEXT NOT NULL,  -- storage path in horse-images/events/{eventId}/{userId}_{ts}.webp
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_photos_select"
  ON event_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_photos_insert"
  ON event_photos FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Author or event creator can delete photos
CREATE POLICY "event_photos_delete"
  ON event_photos FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_photos.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_event_photos_event ON event_photos (event_id);

-- ── Storage RLS for event photos ──
-- Update the master INSERT policy to include events/ path
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
        OR
        -- Social feed photos (V5)
        ((storage.foldername(name))[1] = 'social' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
        OR
        -- Event photos (V6)
        ((storage.foldername(name))[1] = 'events')
    )
);

-- Update READ policy to include events/
DROP POLICY IF EXISTS "Horse image read (public horses)" ON storage.objects;
CREATE POLICY "Horse image read (public horses)" ON storage.objects FOR SELECT TO authenticated, anon
USING (
    bucket_id = 'horse-images'
    AND (
        (storage.foldername(name))[1] = 'social'
        OR (storage.foldername(name))[1] = 'events'
        OR (
            (storage.foldername(name))[1] = 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR (
            (storage.foldername(name))[1] != 'horses'
            AND (storage.foldername(name))[1] != 'social'
            AND (storage.foldername(name))[1] != 'events'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
    )
);
```

**Action:** Write this file. Apply via Supabase SQL editor.

> **NOTE:** This migration also fixes the social/ RLS from V5 Bug 0.1 — if migration 040 already applied the social fix, the DROP IF EXISTS will handle the conflict cleanly.

**Verify:** Tables `event_comments` and `event_photos` appear in Supabase Dashboard.

---

### Task 1.2 — Event Comment Server Actions

**File:** `src/app/actions/events.ts` — add at end:

```typescript
/**
 * Add a comment to an event.
 */
export async function addEventComment(
    eventId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
    if (!content.trim()) return { success: false, error: "Comment cannot be empty." };
    if (content.trim().length > 500) return { success: false, error: "Comment is too long (500 char max)." };

    const { error } = await supabase.from("event_comments").insert({
        event_id: eventId,
        user_id: user.id,
        content: content.trim(),
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${eventId}`);

    // Fire-and-forget: notify event creator
    const { data: event } = await supabase.from("events").select("created_by, name").eq("id", eventId).single();
    if (event && (event as { created_by: string }).created_by !== user.id) {
        const { data: actor } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
        const alias = (actor as { alias_name: string } | null)?.alias_name || "Someone";
        import("@/app/actions/notifications").then((n) => {
            n.createNotification({
                userId: (event as { created_by: string }).created_by,
                type: "comment",
                actorId: user.id,
                content: `@${alias} commented on your event "${(event as { name: string }).name}"`,
            });
        });
        // Mention notifications
        import("@/app/actions/mentions").then((m) => {
            m.parseAndNotifyMentions(content.trim(), user.id, alias, `/community/events/${eventId}`);
        });
    }

    return { success: true };
}

/**
 * Delete an event comment.
 */
export async function deleteEventComment(
    commentId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase
        .from("event_comments")
        .delete()
        .eq("id", commentId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}

/**
 * Get comments for an event, with user aliases via PostgREST join.
 */
export async function getEventComments(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_comments")
        .select("id, content, created_at, user_id, users!event_comments_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(50);

    return (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        content: c.content as string,
        createdAt: c.created_at as string,
        userId: c.user_id as string,
        userAlias: (c.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
    }));
}
```

> **FK Note:** `event_comments.user_id` references `public.users(id)` (not `auth.users`), so the PostgREST join will work correctly here.

**Verify:** `npx next build`

---

### Task 1.3 — Event Attendee List

**File:** `src/app/actions/events.ts` — add:

```typescript
/**
 * Get list of users who RSVP'd "going" or "interested" to an event.
 */
export async function getEventAttendees(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_rsvps")
        .select("user_id, status, users!event_rsvps_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .in("status", ["going", "interested"])
        .order("created_at", { ascending: true });

    return (data ?? []).map((r: Record<string, unknown>) => ({
        userId: r.user_id as string,
        status: r.status as string,
        alias: (r.users as { alias_name: string } | null)?.alias_name ?? "Unknown",
    }));
}
```

---

### Task 1.4 — Event Photo Server Actions

**File:** `src/app/actions/events.ts` — add:

```typescript
/**
 * Add a photo to an event (direct-to-storage path).
 */
export async function addEventPhoto(
    eventId: string,
    imagePath: string,
    caption?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("event_photos").insert({
        event_id: eventId,
        user_id: user.id,
        image_path: imagePath,
        caption: caption?.trim() || null,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/community/events/${eventId}`);
    return { success: true };
}

/**
 * Get photos for an event with signed URLs.
 */
export async function getEventPhotos(eventId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("event_photos")
        .select("id, image_path, caption, created_at, user_id, users!event_photos_user_id_fkey(alias_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    const photos = (data ?? []) as {
        id: string; image_path: string; caption: string | null;
        created_at: string; user_id: string;
        users: { alias_name: string } | null;
    }[];

    // Batch sign URLs
    const paths = photos.map(p => p.image_path);
    const { data: signedBatch } = await supabase.storage
        .from("horse-images")
        .createSignedUrls(paths, 3600);
    const urlMap = new Map<string, string>();
    signedBatch?.forEach((s) => { if (s.signedUrl) urlMap.set(s.path!, s.signedUrl); });

    return photos.map(p => ({
        id: p.id,
        imageUrl: urlMap.get(p.image_path) || "",
        caption: p.caption,
        createdAt: p.created_at,
        userId: p.user_id,
        userAlias: p.users?.alias_name ?? "Unknown",
    }));
}

/**
 * Delete an event photo.
 */
export async function deleteEventPhoto(
    photoId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}
```

---

### Task 1.5 — Event Detail Page Enhancement

**File:** `src/app/community/events/[id]/page.tsx`

After the existing "About" section, add three new sections:

1. **Attendee List** — collapsible section showing who's going/interested:
```tsx
{/* Attendees */}
<div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
    <h3 style={{ marginBottom: "var(--space-sm)" }}>👥 Who's Going ({attendees.filter(a => a.status === "going").length})</h3>
    <div className="event-attendee-grid">
        {attendees.filter(a => a.status === "going").map(a => (
            <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="event-attendee-chip">
                @{a.alias}
            </Link>
        ))}
    </div>
    {attendees.filter(a => a.status === "interested").length > 0 && (
        <>
            <h4 style={{ marginTop: "var(--space-md)", color: "var(--color-text-muted)" }}>⭐ Interested ({attendees.filter(a => a.status === "interested").length})</h4>
            <div className="event-attendee-grid">
                {attendees.filter(a => a.status === "interested").map(a => (
                    <Link key={a.userId} href={`/profile/${encodeURIComponent(a.alias)}`} className="event-attendee-chip">
                        @{a.alias}
                    </Link>
                ))}
            </div>
        </>
    )}
</div>
```

2. **Photo Gallery** — grid of user-contributed photos with upload button:
```tsx
<EventPhotoGallery eventId={event.id} currentUserId={user.id} initialPhotos={photos} />
```

3. **Comment Section** — reuse the comment pattern from horse passports:
```tsx
<EventCommentSection eventId={event.id} currentUserId={user.id} creatorId={event.createdBy} initialComments={comments} />
```

**New Components needed:**
- `src/components/EventPhotoGallery.tsx` — client component: image grid + upload button (direct-to-storage `events/{eventId}/{userId}_{ts}.webp`)
- `src/components/EventCommentSection.tsx` — client component: same pattern as `CommentSection.tsx` but for events, using `addEventComment`/`deleteEventComment`

**CSS additions for `globals.css`:**
```css
.event-attendee-grid {
  display: flex; flex-wrap: wrap; gap: var(--space-xs);
}
.event-attendee-chip {
  padding: 4px 10px; border-radius: var(--radius-pill);
  background: var(--color-surface-hover); color: var(--color-text);
  font-size: calc(0.8rem * var(--font-scale)); text-decoration: none;
  transition: background 0.15s;
}
.event-attendee-chip:hover {
  background: var(--color-accent); color: white;
}
.event-photo-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-sm); margin-top: var(--space-sm);
}
.event-photo-grid img {
  width: 100%; aspect-ratio: 1; object-fit: cover;
  border-radius: var(--radius-md); cursor: pointer;
  transition: opacity 0.15s;
}
.event-photo-grid img:hover { opacity: 0.85; }
```

**Verify:** `npx next build` → visit an event detail page.

---

## Phase 2: Discovery & Search

> **Goal:** Make it easy to find groups, art studios, and content. Client-side text filtering that feels instant.

### Task 2.1 — Group Search Filter

**File:** `src/components/GroupBrowser.tsx`

Add a text search input at the top of the component. It already has a `filter` state for type — add a `search` state:

```typescript
const [search, setSearch] = useState("");

// Update filtering logic:
const groups = tab === "mine" ? myGroups : allGroups;
const filtered = groups
    .filter(g => filter === "all" || g.groupType === filter)
    .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())
        || g.description?.toLowerCase().includes(search.toLowerCase()));
```

Add the search input before the type chips:
```tsx
<div className="search-bar" style={{ marginBottom: "var(--space-md)" }}>
    <input
        type="text"
        className="form-input"
        placeholder="🔍 Search groups by name or description…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        id="group-search"
    />
</div>
```

**Verify:** `npx next build`

---

### Task 2.2 — Art Studio Search & Filtering

**File:** `src/app/studio/page.tsx` — note: this file may not exist yet. Check if there's a browse/discover page for art studios.

**If no browse page exists**, the quickest path is to add a search to the existing `Discover Collectors` page or create a lightweight `/studio` index.

**Create:** `src/app/studio/page.tsx` (if it doesn't exist):

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { browseArtists } from "@/app/actions/art-studio";
import ArtistBrowser from "@/components/ArtistBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Art Studios — Model Horse Hub",
    description: "Browse custom artists — painters, sculptors, and tack makers in the model horse community.",
};

export default async function StudiosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const artists = await browseArtists();

    return (
        <div className="page-container page-container-wide">
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>🎨 <span className="text-gradient">Art Studios</span></h1>
                    <p className="community-hero-subtitle">
                        Find custom painters, sculptors, and tack makers.
                    </p>
                </div>
            </div>
            <ArtistBrowser artists={artists} />
        </div>
    );
}
```

**Create:** `src/components/ArtistBrowser.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArtistProfile } from "@/app/actions/art-studio";

const STATUS_EMOJI: Record<string, string> = { open: "🟢", waitlist: "🟡", closed: "🔴" };
const STATUS_LABEL: Record<string, string> = { open: "Open", waitlist: "Waitlist", closed: "Closed" };

export default function ArtistBrowser({ artists }: { artists: ArtistProfile[] }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [specialtyFilter, setSpecialtyFilter] = useState("all");

    // Collect unique specialties from all artists
    const allSpecialties = [...new Set(artists.flatMap(a => a.specialties))].sort();

    const filtered = artists
        .filter(a => statusFilter === "all" || a.status === statusFilter)
        .filter(a => specialtyFilter === "all" || a.specialties.includes(specialtyFilter))
        .filter(a => !search || a.studioName.toLowerCase().includes(search.toLowerCase())
            || a.ownerAlias.toLowerCase().includes(search.toLowerCase())
            || a.specialties.some(s => s.toLowerCase().includes(search.toLowerCase())));

    return (
        <div className="animate-fade-in-up">
            {/* Search */}
            <div className="search-bar" style={{ marginBottom: "var(--space-md)" }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Search studios by name, artist, or specialty…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    id="studio-search"
                />
            </div>

            {/* Filter Chips */}
            <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginBottom: "var(--space-lg)" }}>
                <div className="studio-chip-grid">
                    <button className={`studio-chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All Status</button>
                    {["open", "waitlist", "closed"].map(s => (
                        <button key={s} className={`studio-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
                            {STATUS_EMOJI[s]} {STATUS_LABEL[s]}
                        </button>
                    ))}
                </div>
                {allSpecialties.length > 0 && (
                    <select
                        className="form-select"
                        value={specialtyFilter}
                        onChange={(e) => setSpecialtyFilter(e.target.value)}
                        style={{ maxWidth: 200 }}
                    >
                        <option value="all">All Specialties</option>
                        {allSpecialties.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
                <div className="empty-state"><p>No studios match your search.</p></div>
            ) : (
                <div className="discover-grid">
                    {filtered.map(a => (
                        <Link key={a.userId} href={`/studio/${a.studioSlug}`} className="discover-card" style={{ textDecoration: "none" }}>
                            <div className="discover-card-info">
                                <div className="discover-card-alias">
                                    {STATUS_EMOJI[a.status]} {a.studioName}
                                </div>
                                <div className="discover-card-stats">
                                    <span>🎨 @{a.ownerAlias}</span>
                                    {a.priceRangeMin && <span>💰 ${a.priceRangeMin}–${a.priceRangeMax}</span>}
                                </div>
                                {a.specialties.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: "var(--space-xs)" }}>
                                        {a.specialties.slice(0, 3).map(s => (
                                            <span key={s} className="studio-chip" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>{s}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
```

**Verify:** `npx next build` → visit `/studio`.

---

### Task 2.3 — Event Search Filter

**File:** `src/components/EventBrowser.tsx`

Same pattern as GroupBrowser — add a `search` state and filter by event name, location, or group name:

```typescript
const [search, setSearch] = useState("");

const filtered = events
    .filter(e => filter === "all" || e.eventType === filter)
    .filter(e => !search
        || e.name.toLowerCase().includes(search.toLowerCase())
        || e.locationName?.toLowerCase().includes(search.toLowerCase())
        || e.groupName?.toLowerCase().includes(search.toLowerCase()));
```

Add search input before the type chips.

**Verify:** `npx next build`

---

### Task 2.4 — Navigation Links

Add `/studio` to the header navigation in `src/app/layout.tsx` or the navigation component, alongside the existing community links.

Ensure the Discover page and Art Studios page are both reachable from the main nav.

**Verify:** Navigate through the app — all search/browse pages accessible.

---

## Phase 3: Feed Depth

> **Goal:** Give text posts and feed items their own URL for sharing and deeper engagement.

### Task 3.1 — Feed Post Detail Page

**Create:** `src/app/feed/[id]/page.tsx`

A dedicated page for a single feed post, showing the full text + image collage + likes + a future comment section.

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import RichText from "@/components/RichText";
import LikeToggle from "@/components/LikeToggle";
import { toggleActivityLike } from "@/app/actions/likes";

export const dynamic = "force-dynamic";

export default async function FeedPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: post } = await supabase
        .from("activity_events")
        .select("id, actor_id, event_type, metadata, image_urls, likes_count, created_at, users!activity_events_actor_id_fkey(alias_name)")
        .eq("id", id)
        .single();

    if (!post) notFound();

    const p = post as Record<string, unknown>;
    const actorAlias = (p.users as { alias_name: string } | null)?.alias_name ?? "Unknown";
    const text = ((p.metadata as { text?: string })?.text) || "";
    const imageUrls = (p.image_urls as string[]) || [];

    // Check if user liked
    const { data: liked } = await supabase
        .from("activity_likes")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("activity_id", id)
        .maybeSingle();

    // Sign image URLs
    let signedUrls: string[] = [];
    if (imageUrls.length > 0) {
        const { data: batch } = await supabase.storage.from("horse-images").createSignedUrls(imageUrls, 3600);
        signedUrls = batch?.map(b => b.signedUrl || "") || [];
    }

    return (
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <Link href="/feed" className="btn btn-ghost" style={{ marginBottom: "var(--space-md)" }}>← Back to Feed</Link>

                <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/profile/${encodeURIComponent(actorAlias)}`} style={{ fontWeight: 600 }}>
                            @{actorAlias}
                        </Link>
                        <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {new Date(p.created_at as string).toLocaleString()}
                        </span>
                    </div>

                    {text && <div style={{ marginTop: "var(--space-md)" }}><RichText content={text} /></div>}

                    {signedUrls.length > 0 && (
                        <div className="feed-image-collage" data-count={Math.min(signedUrls.length, 4)} style={{ marginTop: "var(--space-md)" }}>
                            {signedUrls.slice(0, 4).map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={url} alt={`Image ${i + 1}`} loading="lazy" />
                            ))}
                        </div>
                    )}

                    <div className="feed-action-row" style={{ marginTop: "var(--space-md)" }}>
                        <LikeToggle
                            initialLiked={!!liked}
                            initialCount={(p.likes_count as number) || 0}
                            onToggle={() => toggleActivityLike(id)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
```

---

### Task 3.2 — Update Feed Item Links

**File:** `src/components/ActivityFeed.tsx`

Currently: text posts with no `horseId` link to the user's profile. Change to link to the post detail page:

```typescript
const link = item.horseId
    ? `/community/${item.horseId}`
    : item.eventType === "text_post"
    ? `/feed/${item.id}`
    : `/profile/${encodeURIComponent(item.actorAlias)}`;
```

This gives text posts their own shareable URL while keeping other event types (new_horse, favorite, etc.) linking to the relevant horse or profile.

**Verify:** `npx next build` → click a text post in the feed → lands on `/feed/{id}`.

---

## Completion Checklist

**Phase 1: Event Enhancement**
- [ ] Migration 041 — event_comments + event_photos tables + storage RLS
- [ ] Event comment CRUD (addEventComment, deleteEventComment, getEventComments)
- [ ] Event attendee list (getEventAttendees)
- [ ] Event photo CRUD (addEventPhoto, getEventPhotos, deleteEventPhoto)
- [ ] Event detail page — attendees, photos, comments sections
- [ ] EventPhotoGallery client component
- [ ] EventCommentSection client component
- [ ] CSS for attendee chips + photo grid

**Phase 2: Discovery & Search**
- [ ] Group search filter in GroupBrowser
- [ ] Art Studio browse page (`/studio`) + ArtistBrowser component
- [ ] Event search filter in EventBrowser
- [ ] Navigation links updated

**Phase 3: Feed Depth**
- [ ] Feed post detail page (`/feed/[id]`)
- [ ] Feed item links updated (text posts → `/feed/{id}`)

**Final**
- [ ] `npx next build` — 0 errors
- [ ] All search filters work client-side

**Estimated effort:** ~10-14 hours across 3 phases
