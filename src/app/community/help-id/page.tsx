import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicImageUrl } from "@/lib/utils/storage";
import HelpIdRequestForm from "@/components/HelpIdRequestForm";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

/**
 * Help Me ID This Model — the community identification desk.
 *
 * The Commons audit rated the model itself good (one photo, open
 * suggestions, upvotes, the owner accepts an answer, the accepted
 * answer can become a horse in their stable) and this pass changes none
 * of it. What changed is the material: the requests were generic white
 * cards with pill badges sitting on the site's ledger paper. They are
 * now ledger leaves with the photo mounted on them and a rubber stamp
 * for status, which is how every other queue on the Hub reads.
 */

export const metadata: Metadata = {
    title: "Help Me ID This Model",
    description:
        "Can't identify a model horse? Upload a photo and let the community help! Our collectors can identify from 10,500+ reference releases and artist resins.",
};

interface HelpIdRequest {
    id: string;
    user_id: string;
    image_url: string;
    description: string | null;
    status: string;
    created_at: string;
    userName: string;
}

function RequestCard({
    request,
    imageUrl,
    suggestionCount,
    resolved,
}: {
    request: HelpIdRequest;
    imageUrl: string | undefined;
    suggestionCount: number;
    resolved: boolean;
}) {
    const description = request.description
        ? request.description.length > 100
            ? `${request.description.substring(0, 100)}…`
            : request.description
        : resolved
          ? "No description"
          : "No description provided";

    return (
        <article
            className={`ledger-card relative flex h-full flex-col gap-3 transition-all ${
                resolved ? "opacity-85 hover:opacity-100" : ""
            }`}
            id={`help-id-${request.id}`}
        >
            {/* The photo, mounted on the leaf rather than bleeding to
                its edges — the ledger's red margin line stays visible. */}
            <div className="border-forest/25 relative aspect-square overflow-hidden rounded-md border bg-[var(--muted)]">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={resolved ? "Identified model" : "Mystery model"}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">🐴</div>
                )}
            </div>

            <div>
                <span className={`stamp ${resolved ? "" : "stamp-red"}`}>
                    {resolved ? "Identified" : "Open"}
                </span>
            </div>

            <Link
                href={`/community/help-id/${request.id}`}
                className="text-secondary-foreground line-clamp-2 text-sm leading-relaxed no-underline after:absolute after:inset-0 after:content-['']"
            >
                {description}
            </Link>

            <div className="text-muted-foreground border-forest/15 mt-auto flex items-center justify-between border-t pt-2 text-xs">
                <Link
                    href={`/profile/${encodeURIComponent(request.userName)}`}
                    className="relative z-10 hover:underline"
                >
                    by {request.userName}
                </Link>
                <span className="tabular-nums">
                    💬 {suggestionCount} suggestion{suggestionCount !== 1 ? "s" : ""}
                </span>
            </div>
        </article>
    );
}

export default async function HelpIdPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all requests (most recent first) — NO join to users (FK is auth.users, not public.users)
    const { data: rawRequests } = await supabase
        .from("id_requests")
        .select("id, user_id, image_url, description, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

    const rawList = (rawRequests ?? []) as {
        id: string;
        user_id: string;
        image_url: string;
        description: string | null;
        status: string;
        created_at: string;
    }[];

    // Batch-fetch alias names from public.users
    const userIds = [...new Set(rawList.map((r) => r.user_id))];
    const userNameMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: usersData } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", userIds);
        if (usersData) {
            for (const u of usersData as { id: string; alias_name: string }[]) {
                userNameMap.set(u.id, u.alias_name);
            }
        }
    }

    const requests: HelpIdRequest[] = rawList.map((r) => ({
        ...r,
        userName: userNameMap.get(r.user_id) ?? "Unknown",
    }));

    // Get suggestion counts for each request
    const requestIds = requests.map((r) => r.id);
    let suggestionCounts = new Map<string, number>();
    if (requestIds.length > 0) {
        const { data: rawCounts } = await supabase
            .from("id_suggestions")
            .select("request_id")
            .in("request_id", requestIds);

        if (rawCounts) {
            const counts = new Map<string, number>();
            (rawCounts as { request_id: string }[]).forEach((r) => {
                counts.set(r.request_id, (counts.get(r.request_id) || 0) + 1);
            });
            suggestionCounts = counts;
        }
    }

    // Generate signed URLs for images
    const signedUrlMap = new Map<string, string>();
    for (const req of requests) {
        if (req.image_url) {
            const signedUrl = getPublicImageUrl(req.image_url);
            signedUrlMap.set(req.id, signedUrl);
        }
    }

    const openRequests = requests.filter((r) => r.status === "open");
    const resolvedRequests = requests.filter((r) => r.status === "resolved");

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="🔍"
                title="Help Me ID This Model"
                subtitle="Upload a mystery model and let the community help identify it"
                backHref="/community"
                backLabel="Show Ring"
            />

            {/* Submit New Request Form */}
            <HelpIdRequestForm />

            {/* Open Requests */}
            {openRequests.length > 0 && (
                <section className="mt-12">
                    <h2 className="text-forest mb-5 font-serif text-lg font-bold tracking-[0.14em] uppercase">
                        Open requests ({openRequests.length})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                        {openRequests.map((req) => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                imageUrl={signedUrlMap.get(req.id)}
                                suggestionCount={suggestionCounts.get(req.id) || 0}
                                resolved={false}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Resolved Requests */}
            {resolvedRequests.length > 0 && (
                <section className="mt-12">
                    <h2 className="text-muted-foreground mb-5 font-serif text-lg font-bold tracking-[0.14em] uppercase">
                        Identified ({resolvedRequests.length})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                        {resolvedRequests.map((req) => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                imageUrl={signedUrlMap.get(req.id)}
                                suggestionCount={suggestionCounts.get(req.id) || 0}
                                resolved
                            />
                        ))}
                    </div>
                </section>
            )}

            {openRequests.length === 0 && resolvedRequests.length === 0 && (
                <div className="ledger-card mt-12 py-12 text-center">
                    <p className="mb-4 text-[2rem]" aria-hidden="true">
                        🔍
                    </p>
                    <p className="text-secondary-foreground">
                        No ID requests yet. Be the first to submit one!
                    </p>
                </div>
            )}
        </ExplorerLayout>
    );
}
