import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import FavoritesBrowser from "@/components/favorites/FavoritesBrowser";
import { getFavoritesPage } from "@/app/actions/favorites";

export const metadata = {
    title: "My Favorites",
    description: "Every horse you've hearted around the Show Ring, in one place.",
};

export default async function FavoritesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect(`/login?redirectTo=${encodeURIComponent("/favorites")}`);
    }

    const page = await getFavoritesPage({ offset: 0 });
    const entries = page.success ? page.entries : [];
    const totalCount = page.success ? page.totalCount : 0;
    const hasMore = page.success ? page.hasMore : false;

    return (
        <ExplorerLayout
            title={
                <>
                    💗 <span className="text-forest">My Favorites</span>
                </>
            }
            description={
                <>
                    Horses you ♥ around the Show Ring land here. Favorites are{" "}
                    <strong>individual horses</strong> you admire — if you&apos;re hunting for a{" "}
                    <strong>model to buy</strong>, that&apos;s your{" "}
                    <Link href="/wishlist" className="text-forest underline underline-offset-2">
                        Want List
                    </Link>
                    , which tracks catalog releases.
                </>
            }
        >
            {!page.success ? (
                <div
                    className="rounded-lg border border-input bg-card px-6 py-4 text-sm text-muted-foreground"
                    role="alert"
                >
                    ⚠️ We couldn&apos;t load your favorites just now. Please refresh to try again.
                </div>
            ) : (
                <FavoritesBrowser
                    initialEntries={entries}
                    totalCount={totalCount}
                    initialHasMore={hasMore}
                />
            )}
        </ExplorerLayout>
    );
}
