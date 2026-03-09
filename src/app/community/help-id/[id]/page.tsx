import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSignedImageUrl } from "@/lib/utils/storage";
import HelpIdDetailClient from "@/components/HelpIdDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Help ID Request — Model Horse Hub",
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

    // Fetch the request
    const { data: request } = await supabase
        .from("id_requests")
        .select(`
      id, user_id, image_url, description, status, accepted_suggestion_id, created_at,
      users:user_id(alias_name)
    `)
        .eq("id", id)
        .single();

    if (!request) notFound();

    interface RequestRow {
        id: string;
        user_id: string;
        image_url: string;
        description: string | null;
        status: string;
        accepted_suggestion_id: string | null;
        created_at: string;
        users: { alias_name: string } | null;
    }
    const req = request as unknown as RequestRow;

    // Get signed URL for the image
    const signedImageUrl = req.image_url
        ? await getSignedImageUrl(supabase, req.image_url)
        : null;

    // Fetch suggestions with user info
    const { data: rawSuggestions } = await supabase
        .from("id_suggestions")
        .select(`
      id, user_id, reference_release_id, artist_resin_id, free_text, upvotes, created_at,
      users:user_id(alias_name)
    `)
        .eq("request_id", id)
        .order("upvotes", { ascending: false });

    interface SuggestionRow {
        id: string;
        user_id: string;
        reference_release_id: string | null;
        artist_resin_id: string | null;
        free_text: string | null;
        upvotes: number;
        created_at: string;
        users: { alias_name: string } | null;
    }

    const sugRows = (rawSuggestions as unknown as SuggestionRow[]) ?? [];

    // Enrich suggestions with reference display names
    const releaseIds = sugRows.filter((s) => s.reference_release_id).map((s) => s.reference_release_id!);
    const resinIds = sugRows.filter((s) => s.artist_resin_id).map((s) => s.artist_resin_id!);

    let releaseMap = new Map<string, string>();
    let resinMap = new Map<string, string>();

    if (releaseIds.length > 0) {
        const { data: releases } = await supabase
            .from("reference_releases")
            .select("id, release_name, model_number, reference_molds(mold_name, manufacturer)")
            .in("id", releaseIds);

        if (releases) {
            for (const r of releases as unknown as { id: string; release_name: string; model_number: string | null; reference_molds: { mold_name: string; manufacturer: string } | null }[]) {
                const display = r.reference_molds
                    ? `${r.reference_molds.manufacturer} ${r.reference_molds.mold_name} — ${r.release_name}${r.model_number ? ` (#${r.model_number})` : ""}`
                    : r.release_name;
                releaseMap.set(r.id, display);
            }
        }
    }

    if (resinIds.length > 0) {
        const { data: resins } = await supabase
            .from("artist_resins")
            .select("id, resin_name, sculptor_alias")
            .in("id", resinIds);

        if (resins) {
            for (const r of resins as { id: string; resin_name: string; sculptor_alias: string }[]) {
                resinMap.set(r.id, `${r.sculptor_alias} — ${r.resin_name}`);
            }
        }
    }

    const suggestions = sugRows.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        free_text: s.free_text,
        upvotes: s.upvotes,
        created_at: s.created_at,
        userName: s.users?.alias_name ?? "Unknown",
        releaseDisplay: s.reference_release_id ? releaseMap.get(s.reference_release_id) || null : null,
        resinDisplay: s.artist_resin_id ? resinMap.get(s.artist_resin_id) || null : null,
        isAccepted: s.id === req.accepted_suggestion_id,
    }));

    const isOwner = user.id === req.user_id;
    const isResolved = req.status === "resolved";

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">Mystery Model</span>
                            {isResolved && (
                                <span style={{
                                    marginLeft: "var(--space-md)",
                                    fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                    padding: "4px 12px",
                                    background: "rgba(92, 224, 160, 0.15)",
                                    color: "var(--color-accent-success)",
                                    borderRadius: "var(--radius-full)",
                                    fontWeight: 600,
                                }}>
                                    ✅ Resolved
                                </span>
                            )}
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Submitted by {req.users?.alias_name ?? "Unknown"} on{" "}
                            {new Date(req.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <Link href="/community/help-id" className="btn btn-ghost">
                        ← Back to Help ID
                    </Link>
                </div>

                {/* Main content grid */}
                <div className="help-id-detail-layout">
                    {/* Photo */}
                    <div className="help-id-detail-photo">
                        {signedImageUrl ? (
                            <img
                                src={signedImageUrl}
                                alt="Mystery model"
                                className="help-id-detail-img"
                            />
                        ) : (
                            <div className="help-id-card-placeholder" style={{ height: 300 }}>🐴</div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="help-id-detail-info">
                        <h2 style={{ fontSize: "calc(var(--font-size-md) * var(--font-scale))", fontWeight: 600, marginBottom: "var(--space-md)" }}>
                            Description
                        </h2>
                        <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                            {req.description || "No description provided."}
                        </p>
                    </div>
                </div>

                {/* Client-side interactive section */}
                <HelpIdDetailClient
                    requestId={req.id}
                    isOwner={isOwner}
                    isResolved={isResolved}
                    acceptedSuggestionId={req.accepted_suggestion_id}
                    suggestions={suggestions}
                />
            </div>
        </div>
    );
}
