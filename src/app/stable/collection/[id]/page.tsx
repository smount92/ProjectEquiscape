import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import CollectionManager from "@/components/CollectionManager";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import CollectionBrowser from "@/components/stable/CollectionBrowser";
import { getStablePage, getStableSummary } from "@/app/actions/stable";
import { pageOf, parseStableSearchParams, perOf } from "@/lib/stable/filterParams";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data } = await supabase.from("user_collections").select("name").eq("id", id).single<{ name: string }>();

    return {
        title: data ? `${data.name} — Digital Stable` : "Collection Not Found",
        description: data ? `View models in the"${data.name}" collection.` : "Collection not found.",
    };
}

export default async function CollectionPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { id: collectionId } = await params;
    // Only the place in the list comes from the URL here (?page=&per=); the
    // collection itself is the one filter.
    const place = parseStableSearchParams(await searchParams);
    const per = perOf(place);
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch collection details (RLS ensures owner-only)
    const { data: collection } = await supabase
        .from("user_collections")
        .select("id, name, description, created_at")
        .eq("id", collectionId)
        .single<{ id: string; name: string; description: string | null; created_at: string }>();

    if (!collection) {
        notFound();
    }

    const [pageResult, summaryResult] = await Promise.all([
        getStablePage({ collection: collectionId, page: pageOf(place), per }),
        getStableSummary(),
    ]);
    const cards = pageResult.success ? pageResult.cards : [];
    const totalCount = pageResult.success ? pageResult.totalCount : 0;
    const page = pageResult.success ? pageResult.page : 1;
    const pageCount = pageResult.success ? pageResult.pageCount : 1;
    const colStats = summaryResult.success
        ? summaryResult.summary.collections.find((c) => c.id === collectionId)
        : undefined;
    const collectionVaultValue = colStats?.value ?? 0;
    const avgValue = totalCount > 0 && collectionVaultValue > 0 ? collectionVaultValue / totalCount : 0;

    return (
        <ExplorerLayout title={<>📁 {collection.name}</>} description={collection.description || undefined}>
            {/* Breadcrumb */}
            <nav
                className="animate-fade-in-up mb-6 flex items-center gap-2 text-sm text-secondary-foreground"
                aria-label="Breadcrumb"
            >
                <Link href="/dashboard">Digital Stable</Link>
                <span className="separator" aria-hidden="true">
                    /
                </span>
                <span>📁 {collection.name}</span>
            </nav>

            {/* Collection Header */}
            <div className="collection-hero animate-fade-in-up max-sm:flex-col max-sm:p-6 max-sm:text-center">
                <div className="shrink-0 text-[2.5rem]">📁</div>
                <div className="mb-1 text-2xl font-bold text-foreground">
                    <span className="text-sm text-muted-foreground">
                        {totalCount} model{totalCount !== 1 ? "" : "s"} in this collection
                    </span>
                    <div className="mt-2">
                        <CollectionManager collection={collection} />
                    </div>
                </div>
            </div>

            {/* 🔒 Collection Stats — PRIVATE analytics */}
            {totalCount > 0 && (
                <div className="animate-fade-in-up mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-input bg-card px-4 py-6 text-center shadow-md transition-all">
                        <div className="text-2xl leading-none">🐴</div>
                        <div className="analytics-value max-[400px]:text-xl">{totalCount}</div>
                        <div className="text-xs font-medium tracking-[0.05em] text-muted-foreground uppercase">
                            Models
                        </div>
                    </div>
                    <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-input bg-card px-4 py-6 text-center shadow-md transition-all">
                        <div className="text-2xl leading-none">💰</div>
                        <div className="analytics-value max-[400px]:text-xl">
                            {collectionVaultValue > 0
                                ? `$${collectionVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                : "—"}
                        </div>
                        <div className="text-xs font-medium tracking-[0.05em] text-muted-foreground uppercase">
                            Collection Value
                        </div>
                    </div>
                    <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-input bg-card px-4 py-6 text-center shadow-md transition-all">
                        <div className="text-2xl leading-none">📊</div>
                        <div className="analytics-value max-[400px]:text-xl">
                            {avgValue > 0
                                ? `$${avgValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                : "—"}
                        </div>
                        <div className="text-xs font-medium tracking-[0.05em] text-muted-foreground uppercase">
                            Avg. Value
                        </div>
                    </div>
                </div>
            )}

            {/* Grid — shared StableHorseCard + numbered pages */}
            {totalCount === 0 ? (
                <div className="animate-fade-in-up rounded-lg border border-input bg-card px-8 py-12 text-center shadow-md transition-all">
                    <div className="mb-4 text-5xl">📂</div>
                    <h2>This collection is empty</h2>
                    <p>
                        Add models to this collection from the &quot;Add to Stable&quot; form or by editing an existing
                        model.
                    </p>
                    <Button asChild>
                        <Link href="/add-horse">🐴 Add to Stable</Link>
                    </Button>
                </div>
            ) : (
                <CollectionBrowser cards={cards} totalCount={totalCount} page={page} per={per} pageCount={pageCount} />
            )}
        </ExplorerLayout>
    );
}
