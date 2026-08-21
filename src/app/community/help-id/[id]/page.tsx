import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicImageUrl } from "@/lib/utils/storage";
import HelpIdDetailClient from "@/components/HelpIdDetailClient";
import ScrapbookLayout from "@/components/layouts/ScrapbookLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

/**
 * A single Help ID request.
 *
 * Restyle only. The page used to open with a bare <h1> and a pill badge
 * where every other page on the site opens with a leather masthead, and
 * the photo and description sat in generic white cards. It now wears
 * the standard masthead (with the open/resolved state as a rubber stamp
 * in the subtitle slot) and the request's own details read as ledger
 * entries on the scrapbook's paper.
 */

export const metadata: Metadata = {
    title: "Help ID Request",
    description: "View a mystery model identification request and community suggestions.",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function HelpIdDetailPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: request } = await supabase
        .from("id_requests")
        .select("id, user_id, image_url, description, status, accepted_suggestion_id, created_at")
        .eq("id", id)
        .single();

    if (!request) notFound();

    const req = request as {
        id: string;
        user_id: string;
        image_url: string;
        description: string | null;
        status: string;
        accepted_suggestion_id: string | null;
        created_at: string;
    };

    const { data: reqUser } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", req.user_id)
        .single();
    const requesterName = (reqUser as { alias_name: string } | null)?.alias_name ?? "Unknown";

    const signedImageUrl = req.image_url ? getPublicImageUrl(req.image_url) : null;

    const { data: rawSuggestions } = await supabase
        .from("id_suggestions")
        .select("id, user_id, catalog_id, free_text, upvotes, created_at")
        .eq("request_id", id)
        .order("upvotes", { ascending: false });

    const sugRows = (rawSuggestions ?? []) as {
        id: string;
        user_id: string;
        catalog_id: string | null;
        free_text: string | null;
        upvotes: number;
        created_at: string;
    }[];

    const sugUserIds = [...new Set(sugRows.map((s) => s.user_id))];
    const sugUserMap = new Map<string, string>();
    if (sugUserIds.length > 0) {
        const { data: sugUsers } = await supabase
            .from("users")
            .select("id, alias_name")
            .in("id", sugUserIds);
        if (sugUsers) {
            for (const u of sugUsers as { id: string; alias_name: string }[]) {
                sugUserMap.set(u.id, u.alias_name);
            }
        }
    }

    const catalogIds = sugRows.filter((s) => s.catalog_id).map((s) => s.catalog_id!);
    const catalogDisplayMap = new Map<string, string>();

    if (catalogIds.length > 0) {
        const { data: catalogItems } = await supabase
            .from("catalog_items")
            .select("id, title, maker, item_type")
            .in("id", catalogIds);

        if (catalogItems) {
            for (const c of catalogItems as {
                id: string;
                title: string;
                maker: string;
                item_type: string;
            }[]) {
                catalogDisplayMap.set(c.id, `${c.maker} ${c.title}`);
            }
        }
    }

    const suggestions = sugRows.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        free_text: s.free_text,
        upvotes: s.upvotes,
        created_at: s.created_at,
        userName: sugUserMap.get(s.user_id) ?? "Unknown",
        catalogId: s.catalog_id,
        releaseDisplay: s.catalog_id ? catalogDisplayMap.get(s.catalog_id) || null : null,
        resinDisplay: null as string | null,
        isAccepted: s.id === req.accepted_suggestion_id,
    }));

    const isOwner = user.id === req.user_id;
    const isResolved = req.status === "resolved";

    return (
        <ScrapbookLayout
            breadcrumbs={
                <PageMasthead
                    icon={isResolved ? "✅" : "🔍"}
                    title="Mystery Model"
                    subtitle={`Submitted by ${requesterName} on ${new Date(
                        req.created_at
                    ).toLocaleDateString()}`}
                    backHref="/community/help-id"
                    backLabel="Help ID"
                />
            }
            leftContent={
                <div className="ledger-card">
                    <span className={`stamp ${isResolved ? "" : "stamp-red"} mb-3 inline-block`}>
                        {isResolved ? "Identified" : "Open"}
                    </span>
                    <div className="border-forest/25 overflow-hidden rounded-md border bg-[var(--muted)]">
                        {signedImageUrl ? (
                            <img
                                src={signedImageUrl}
                                alt="Mystery model"
                                className="block h-auto max-h-[500px] w-full object-contain"
                            />
                        ) : (
                            <div className="flex h-[300px] items-center justify-center text-6xl">
                                🐴
                            </div>
                        )}
                    </div>
                </div>
            }
            rightContent={
                <div>
                    <span className="ledger-tab">Description</span>
                    <p className="text-secondary-foreground leading-[1.7]">
                        {req.description || "No description provided."}
                    </p>
                </div>
            }
            belowContent={
                <HelpIdDetailClient
                    requestId={req.id}
                    isOwner={isOwner}
                    isResolved={isResolved}
                    acceptedSuggestionId={req.accepted_suggestion_id}
                    suggestions={suggestions}
                />
            }
        />
    );
}
