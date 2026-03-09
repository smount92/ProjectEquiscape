import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSignedImageUrl } from "@/lib/utils/storage";
import HelpIdRequestForm from "@/components/HelpIdRequestForm";

export const metadata: Metadata = {
    title: "Help Me ID This Model — Model Horse Hub",
    description:
        "Can't identify a model horse? Upload a photo and let the community help! Our collectors can identify from 10,500+ reference releases and artist resins.",
};

export const dynamic = "force-dynamic";

interface IdRequest {
    id: string;
    user_id: string;
    image_url: string;
    description: string | null;
    status: string;
    created_at: string;
    users: { alias_name: string } | null;
    suggestion_count: number;
}

export default async function HelpIdPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch all open requests (most recent first)
    const { data: rawRequests } = await supabase
        .from("id_requests")
        .select(`
      id, user_id, image_url, description, status, created_at,
      users:user_id(alias_name)
    `)
        .order("created_at", { ascending: false })
        .limit(50);

    const requests = (rawRequests as unknown as Omit<IdRequest, "suggestion_count">[]) ?? [];

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
            const signedUrl = await getSignedImageUrl(supabase, req.image_url);
            signedUrlMap.set(req.id, signedUrl);
        }
    }

    const openRequests = requests.filter((r) => r.status === "open");
    const resolvedRequests = requests.filter((r) => r.status === "resolved");

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">Help Me ID This Model</span>
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Upload a mystery model and let the community help identify it
                        </p>
                    </div>
                    <Link href="/community" className="btn btn-ghost">
                        ← Back to Show Ring
                    </Link>
                </div>

                {/* Submit New Request Form */}
                <HelpIdRequestForm />

                {/* Open Requests */}
                {openRequests.length > 0 && (
                    <section style={{ marginTop: "var(--space-2xl)" }}>
                        <h2 style={{ fontSize: "calc(var(--font-size-lg) * var(--font-scale))", fontWeight: 700, marginBottom: "var(--space-lg)" }}>
                            🔍 Open Requests ({openRequests.length})
                        </h2>
                        <div className="help-id-grid">
                            {openRequests.map((req) => (
                                <Link
                                    key={req.id}
                                    href={`/community/help-id/${req.id}`}
                                    className="help-id-card"
                                    id={`help-id-${req.id}`}
                                >
                                    <div className="help-id-card-image">
                                        {signedUrlMap.get(req.id) ? (
                                            <img
                                                src={signedUrlMap.get(req.id)!}
                                                alt="Mystery model"
                                                className="help-id-card-img"
                                            />
                                        ) : (
                                            <div className="help-id-card-placeholder">🐴</div>
                                        )}
                                        <span className="help-id-status-badge open">Open</span>
                                    </div>
                                    <div className="help-id-card-info">
                                        <p className="help-id-card-desc">
                                            {req.description
                                                ? req.description.length > 100
                                                    ? req.description.substring(0, 100) + "…"
                                                    : req.description
                                                : "No description provided"}
                                        </p>
                                        <div className="help-id-card-meta">
                                            <span>by {(req.users as { alias_name: string } | null)?.alias_name ?? "Unknown"}</span>
                                            <span>💬 {suggestionCounts.get(req.id) || 0} suggestion{(suggestionCounts.get(req.id) || 0) !== 1 ? "s" : ""}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Resolved Requests */}
                {resolvedRequests.length > 0 && (
                    <section style={{ marginTop: "var(--space-2xl)" }}>
                        <h2 style={{ fontSize: "calc(var(--font-size-lg) * var(--font-scale))", fontWeight: 700, marginBottom: "var(--space-lg)", color: "var(--color-text-secondary)" }}>
                            ✅ Resolved ({resolvedRequests.length})
                        </h2>
                        <div className="help-id-grid">
                            {resolvedRequests.map((req) => (
                                <Link
                                    key={req.id}
                                    href={`/community/help-id/${req.id}`}
                                    className="help-id-card resolved"
                                    id={`help-id-${req.id}`}
                                >
                                    <div className="help-id-card-image">
                                        {signedUrlMap.get(req.id) ? (
                                            <img
                                                src={signedUrlMap.get(req.id)!}
                                                alt="Identified model"
                                                className="help-id-card-img"
                                            />
                                        ) : (
                                            <div className="help-id-card-placeholder">🐴</div>
                                        )}
                                        <span className="help-id-status-badge resolved">Resolved</span>
                                    </div>
                                    <div className="help-id-card-info">
                                        <p className="help-id-card-desc">
                                            {req.description
                                                ? req.description.length > 100
                                                    ? req.description.substring(0, 100) + "…"
                                                    : req.description
                                                : "No description"}
                                        </p>
                                        <div className="help-id-card-meta">
                                            <span>by {(req.users as { alias_name: string } | null)?.alias_name ?? "Unknown"}</span>
                                            <span>💬 {suggestionCounts.get(req.id) || 0}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {openRequests.length === 0 && resolvedRequests.length === 0 && (
                    <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)", marginTop: "var(--space-2xl)" }}>
                        <p style={{ fontSize: "2rem", marginBottom: "var(--space-md)" }}>🔍</p>
                        <p style={{ color: "var(--color-text-secondary)" }}>No ID requests yet. Be the first to submit one!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
