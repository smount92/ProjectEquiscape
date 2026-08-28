"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getOwnedCatalogIds } from "@/app/actions/owned";

/**
 * The conga's first tendril: quiet "in your stable" marks on timeline
 * rows the signed-in viewer owns.
 *
 * Reference pages are static and anonymous by design, so ownership is
 * painted on client-side after mount: one fetch for the whole page via
 * OwnedProvider, consumed by feather-weight OwnedMark chips. Anonymous
 * visitors fetch once, get an empty set, and see nothing — the page is
 * complete without this layer.
 */
const OwnedContext = createContext<ReadonlySet<string>>(new Set());

export function OwnedProvider({
    ids,
    children,
}: {
    ids: string[];
    children: React.ReactNode;
}) {
    const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
    useEffect(() => {
        let alive = true;
        getOwnedCatalogIds(ids).then((list) => {
            if (alive && list.length > 0) setOwned(new Set(list));
        });
        return () => {
            alive = false;
        };
        // ids are stable per render of a static page; re-fetching on array
        // identity would refetch every hydration for no new information.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <OwnedContext.Provider value={owned}>{children}</OwnedContext.Provider>;
}

export function OwnedMark({ id }: { id: string }) {
    const owned = useContext(OwnedContext);
    if (!owned.has(id)) return null;
    return (
        <span
            className="border-forest/50 bg-forest/10 text-forest ml-2 inline-block rounded-full border px-2 py-px align-[2px] text-[0.65rem] font-bold"
            title="A horse in your stable is linked to this release."
        >
            🐴 in your stable
        </span>
    );
}
