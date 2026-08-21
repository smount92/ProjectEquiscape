import Link from "next/link";
import { redirect } from "next/navigation";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import MatchmakerMatches from "@/components/MatchmakerMatches";
import WishlistRemoveButton from "@/components/WishlistRemoveButton";
import WishlistSearch from "@/components/WishlistSearch";
import { Button } from "@/components/ui/button";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { createClient } from "@/lib/supabase/server";
import { getWantListBoard, type WantListItem } from "@/app/wishlist/wantList";

/**
 * THE WANT LIST — purchase intent, sale alerts, and Matchmaker.
 *
 * Owner ruling: this is NOT Favorites. A favorite is a public like on one
 * particular horse. A want is a standing instruction about a reference —
 * "tell me when anyone lists one of these" — and it is private. The two are
 * deliberately not cross-linked; conflating them is what made the old page
 * read like a bookmarks folder.
 *
 * Matchmaker is the reason to be here, so it goes first and says what it
 * does before the list of things it is watching.
 *
 * Reads live in ./wantList.ts. Display and composition only.
 */

export const metadata = {
    title: "My Want List",
    description:
        "The models you're hunting for. Matchmaker watches the marketplace and tells you the moment a collector lists one.",
};

const TYPE_ICON: Record<string, string> = {
    artist_resin: "🎨",
    plastic_release: "📦",
    plastic_mold: "🏭",
};

function formatAdded(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/** The headline: what Matchmaker is, then what it has found today. */
function MatchmakerPanel({
    itemCount,
    totalMatches,
    noteOnlyCount,
}: {
    itemCount: number;
    totalMatches: number;
    noteOnlyCount: number;
}) {
    return (
        <section className="ledger-card mb-6" aria-labelledby="matchmaker-heading">
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="ledger-tab m-0" id="matchmaker-heading">
                    Matchmaker
                </span>
                {totalMatches > 0 && (
                    <span className="stamp">
                        {totalMatches} match{totalMatches === 1 ? "" : "es"}
                    </span>
                )}
            </div>

            <p className="text-secondary-foreground mt-0 mb-3 text-base leading-[1.7]">
                Put a mold, a release or a resin on this list and Matchmaker watches the whole
                marketplace for it. The moment a collector sets a matching horse For Sale or Open to
                Offers, it appears against your entry — with the asking price, the seller, and a way
                to message them.
            </p>
            <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                You stop refreshing the market every morning, and you stop finding out about the
                grail three days after somebody else bought it.
            </p>

            {totalMatches > 0 ? (
                <p className="text-forest m-0 text-sm font-semibold">
                    🔥 {totalMatches} listing{totalMatches === 1 ? " is" : "s are"} up right now
                    against your list. Look for the orange badge on the entries below.
                </p>
            ) : itemCount > 0 ? (
                <p className="text-muted-foreground m-0 text-sm">
                    Nothing on your list is for sale this minute. That&rsquo;s the usual answer — the
                    point is that you no longer have to keep checking.
                </p>
            ) : (
                <p className="text-muted-foreground m-0 text-sm">
                    Nothing to watch yet. Add the first model below.
                </p>
            )}

            {noteOnlyCount > 0 && (
                <p className="text-muted-foreground mt-3 mb-0 text-sm">
                    {noteOnlyCount} of your entr{noteOnlyCount === 1 ? "y is a" : "ies are"} free-text
                    note{noteOnlyCount === 1 ? "" : "s"} rather than a Registry entry, so Matchmaker
                    can&rsquo;t watch for {noteOnlyCount === 1 ? "it" : "them"}. If the model turns
                    up in the Registry later, re-add it from there and it starts working.
                </p>
            )}
        </section>
    );
}

/** The add flow, explained before the search box rather than after it. */
function AddPanel() {
    return (
        <section className="ledger-card mb-6" aria-labelledby="add-heading">
            <span className="ledger-tab" id="add-heading">
                Adding to the list
            </span>
            <p className="text-secondary-foreground mt-0 mb-4 text-sm leading-relaxed">
                Type a name below. The search runs against the Registry — base molds, OF releases and
                artist resins — and picking a result puts it straight on the list. If the model
                isn&rsquo;t cataloged yet, add the name as a plain note instead; Matchmaker
                can&rsquo;t watch a note, but you&rsquo;ll have it written down. You can also add
                from any Registry page with the bookmark button.
            </p>
            <WishlistSearch />
        </section>
    );
}

function WantCard({ item }: { item: WantListItem }) {
    const title = item.title || "Custom entry";
    const icon = (item.itemType && TYPE_ICON[item.itemType]) || "📝";
    const href = item.catalog_id
        ? referenceHref({ id: item.catalog_id, maker: item.maker, title })
        : null;

    return (
        <li className="flex">
            <article
                className="ledger-card group hover:border-forest/50 relative flex flex-1 flex-col py-5 pr-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                id={`wishlist-${item.id}`}
            >
                <div className="min-w-0 flex-1 pr-6">
                    {href ? (
                        <Link href={href} className="text-foreground no-underline">
                            <h3 className="hover:text-forest m-0 font-serif text-base font-bold">
                                {icon} {title}
                            </h3>
                        </Link>
                    ) : (
                        <h3 className="text-foreground m-0 font-serif text-base font-bold">
                            {icon} {title}
                        </h3>
                    )}

                    {item.maker && <p className="text-forest m-0 mt-1 text-sm">{item.maker}</p>}
                    {item.scale && (
                        <p className="text-muted-foreground m-0 text-sm">📏 {item.scale}</p>
                    )}
                    {item.notes && (
                        <p className="text-muted-foreground m-0 mt-2 text-sm italic">
                            📝 {item.notes}
                        </p>
                    )}

                    <p className="text-muted-foreground m-0 mt-2 text-xs">
                        Added {formatAdded(item.created_at)}
                        {!item.catalog_id && " · not in the Registry, so not watched"}
                    </p>
                </div>

                {item.matches.length > 0 && (
                    <MatchmakerMatches matchCount={item.matches.length} matches={item.matches} />
                )}

                <WishlistRemoveButton wishlistId={item.id} />
            </article>
        </li>
    );
}

/** Where to go when the list is quiet. */
function MarketPointers() {
    return (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
                <h3 className="mb-1 font-serif text-lg font-bold">Not waiting? Go look.</h3>
                <p className="text-secondary-foreground mb-4 text-sm">
                    Every horse for sale on Model Horse Hub, each one opening onto its passport —
                    show record, condition, ownership history and the message-the-seller flow.
                </p>
                <Button asChild variant="outline" size="wide">
                    <Link href="/market" id="wishlist-market-link">
                        Browse the market →
                    </Link>
                </Button>
            </div>
            <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
                <h3 className="mb-1 font-serif text-lg font-bold">What should it cost?</h3>
                <p className="text-secondary-foreground mb-4 text-sm">
                    The Blue Book gives average, median and range from completed sales, so you know
                    whether the one that just turned up is a fair ask. Free, always.
                </p>
                <Button asChild variant="outline" size="wide">
                    <Link href="/market/guide" id="wishlist-bluebook-link">
                        Open the Blue Book →
                    </Link>
                </Button>
            </div>
        </div>
    );
}

export default async function WishlistPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?redirectTo=" + encodeURIComponent("/wishlist"));
    }

    const { items, totalMatches, noteOnlyCount } = await getWantListBoard(user.id);

    const subtitle =
        items.length === 0
            ? "Purchase intent, and the alert that follows it"
            : `${items.length} model${items.length === 1 ? "" : "s"} watched · ${
                  totalMatches === 0 ? "none up for sale" : `${totalMatches} up for sale`
              }`;

    return (
        <ExplorerLayout noHeader frameless>
            <div className="animate-fade-in-up mx-auto max-w-[1100px]">
                <PageMasthead
                    icon="🔖"
                    title="Want List"
                    subtitle={subtitle}
                    actions={
                        <Button asChild variant="outline">
                            <Link href="/market" id="wishlist-masthead-market">
                                Browse the market
                            </Link>
                        </Button>
                    }
                />

                <MatchmakerPanel
                    itemCount={items.length}
                    totalMatches={totalMatches}
                    noteOnlyCount={noteOnlyCount}
                />

                <AddPanel />

                {items.length === 0 ? (
                    <section className="ledger-card py-12 text-center" aria-labelledby="empty-heading">
                        <div className="mb-4 text-[3rem]" aria-hidden="true">
                            🔖
                        </div>
                        <h2 id="empty-heading" className="mb-2 font-serif text-xl font-bold">
                            Nothing on the list yet
                        </h2>
                        <p className="text-secondary-foreground mx-auto m-0 max-w-[460px] text-sm leading-relaxed">
                            The resin you have been chasing for six years and the OF you need to
                            finish a run go on the same list. Search for one above, or tap the
                            bookmark on any Registry entry.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <Button asChild variant="outline" size="wide">
                                <Link href="/catalog" id="wishlist-registry-link">
                                    Search the Registry →
                                </Link>
                            </Button>
                        </div>
                    </section>
                ) : (
                    <section aria-labelledby="list-heading">
                        <span className="ledger-tab" id="list-heading">
                            The list
                        </span>
                        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 p-0">
                            {items.map((item) => (
                                <WantCard key={item.id} item={item} />
                            ))}
                        </ul>
                    </section>
                )}

                <MarketPointers />
            </div>
        </ExplorerLayout>
    );
}
