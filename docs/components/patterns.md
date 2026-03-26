# Component Patterns

Recurring patterns used across the 107 client components.

---

## Pattern 1: Server Action Call with Status

The most common pattern — a client component calls a server action and manages loading/error/success state.

```tsx
"use client";
import { useState } from "react";
import { doThing } from "@/app/actions/domain";

export default function MyComponent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleAction() {
        setLoading(true);
        setError("");
        const result = await doThing(data);
        if (!result.success) {
            setError(result.error || "Something went wrong.");
        }
        setLoading(false);
    }

    return (
        <>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" onClick={handleAction} disabled={loading}>
                {loading ? "Working..." : "Do Thing"}
            </button>
        </>
    );
}
```

**Used by:** `MakeOfferModal`, `TransferModal`, `CommissionRequestForm`, `RatingForm`, `ShowEntryForm`, and most mutation components.

---

## Pattern 2: Toggle with Optimistic UI

For binary toggles (like, follow, favorite), the UI updates immediately before the server confirms.

```tsx
"use client";
import { useState, useOptimistic } from "react";
import { toggleFollow } from "@/app/actions/follows";

export default function FollowButton({ userId, initialFollowing }: Props) {
    const [isFollowing, setIsFollowing] = useState(initialFollowing);

    async function handleToggle() {
        setIsFollowing(!isFollowing); // Optimistic
        const result = await toggleFollow(userId);
        if (!result.success) {
            setIsFollowing(isFollowing); // Revert
        }
    }

    return (
        <button onClick={handleToggle}>
            {isFollowing ? "Unfollow" : "Follow"}
        </button>
    );
}
```

**Used by:** `FollowButton`, `LikeToggle`, `FavoriteButton`, `WishlistButton`, `VoteButton`.

---

## Pattern 3: Modal with Form

Modals use **shadcn/ui `<Dialog>`** (Radix-based) for controlled visibility with form submission.

```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ExampleModal({ isOpen, onClose }: Props) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Title</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <Input name="field" placeholder="Enter value" />
                    <DialogFooter>
                        <Button type="submit">Submit</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

**Components:** `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogFooter>` from `@/components/ui/dialog`.

**Used by:** `MakeOfferModal`, `DeleteHorseModal`, `TransferModal`, `ImageCropModal`, `SuggestReferenceModal`, and all other modals.

> **Exception:** `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation.

---

## Pattern 4: Server Component → Client Component Data Flow

Pages are Server Components that fetch data and pass it as props to Client Components.

```tsx
// page.tsx (Server Component)
import { getHoofprint } from "@/app/actions/hoofprint";
import HoofprintTimeline from "@/components/HoofprintTimeline";

export default async function HoofprintPage({ params }: Props) {
    const { timeline, ownershipChain, lifeStage } = await getHoofprint(params.id);
    
    return <HoofprintTimeline 
        timeline={timeline}
        ownershipChain={ownershipChain}
        lifeStage={lifeStage}
    />;
}
```

This pattern ensures:
- Data fetching happens on the server with RLS
- Client components receive pre-fetched data as props
- No loading spinners on initial render (SSR)

---

## Pattern 5: Toast Notifications

The `DashboardToast` component provides app-wide toast notifications, controlled via URL search params.

```tsx
// After a server action, redirect with toast param:
redirect(`/dashboard?toast=Horse+added+successfully`);
```

The `DashboardShell` reads the `toast` search param and displays a temporary notification.

**Used by:** Horse add, transfer claim, settings update, and other mutation flows.

---

## Pattern 6: Infinite Scroll / Load More

Feed-like components use a "Load More" pattern with cursor-based pagination.

```tsx
"use client";
import { useState } from "react";

export default function Feed({ initialItems, hasMore }: Props) {
    const [items, setItems] = useState(initialItems);
    const [cursor, setCursor] = useState(initialItems.at(-1)?.createdAt);

    async function loadMore() {
        const next = await getMoreItems(cursor);
        setItems([...items, ...next.data]);
        setCursor(next.data.at(-1)?.createdAt);
    }

    return (
        <>
            {items.map(item => <ItemCard key={item.id} {...item} />)}
            {hasMore && <button onClick={loadMore}>Load More</button>}
        </>
    );
}
```

**Used by:** `UniversalFeed`, `LoadMoreFeed`, `ActivityFeed`.

---

## Pattern 7: Tailwind Utility Styling

Components use Tailwind CSS v4 utility classes for styling directly in JSX:

```tsx
export default function MyComponent() {
    return <div className="rounded-lg border border-edge bg-card p-6 shadow-md">
        <h2 className="text-lg font-bold text-ink">Hello</h2>
    </div>;
}
```

> **Convention:** CSS Modules have been eliminated. Use Tailwind utility classes for all new styling.

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|----------|------|
| Fetch data in client components | Pass data from Server Component via props |
| Use `useEffect` for initial data | Use Server Component async fetching |
| Create inline styles for static values | Use Tailwind utility classes or global design tokens |
| Call `getAdminClient()` from client | Always use server actions for mutations |
| Hard-code colors | Use Tailwind theme tokens (`text-forest`, `bg-card`) or CSS properties (`var(--color-*)`) |
| Use createPortal for modals | Use shadcn `<Dialog>` (exception: PhotoLightbox) |
| Use raw HTML form inputs | Use shadcn `<Input>`, `<Textarea>`, `<Select>` |

---

**Next:** [Component Catalog](catalog.md) · [Design System](design-system.md)
