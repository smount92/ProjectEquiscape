import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicImageUrl } from "@/lib/utils/storage";
import HelpIdRequestForm from "@/components/HelpIdRequestForm";

export const metadata: Metadata = {
    title: "Help Me ID This Model — Model Horse Hub",
    description:
        "Can't identify a model horse? Upload a photo and let the community help! Our collectors can identify from 10,500+ reference releases and artist resins.",
};

export const dynamic = "force-dynamic";

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

    const requests = rawList.map((r) => ({
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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="animate-fade-in-up">
                <div className="shelf-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <div>
                        <h1>
                            <span className="text-forest">Help Me ID This Model</span>
                        </h1>
                        <p className="text-muted mt-1" >
                            Upload a mystery model and let the community help identify it
                        </p>
                    </div>
                    <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                        ← Back to Show Ring
                    </Link>
                </div>

                {/* Submit New Request Form */}
                <HelpIdRequestForm />

                {/* Open Requests */}
                {openRequests.length > 0 && (
                    <section className="mt-12" >
                        <h2 className="text-lg font-bold mb-6" >
                            🔍 Open Requests ({openRequests.length})
                        </h2>
                        <div className="grid grid-cols-[repeat(auto-fill, minmax(280px, 1fr))] gap-6">
                            {openRequests.map((req) => (
                                <Link
                                    key={req.id}
                                    href={`/community/help-id/${req.id}`}
                                    className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col"
                                    id={`help-id-${req.id}`}
                                >
                                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-image">
                                        {signedUrlMap.get(req.id) ? (
                                            <img
                                                src={signedUrlMap.get(req.id)!}
                                                alt="Mystery model"
                                                className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-img"
                                            />
                                        ) : (
                                            <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-placeholder">🐴</div>
                                        )}
                                        <span className="bg-[rgba(240, 208, 108, 0.85)] text-white border border-[rgba(240, 208, 108, 0.5)] open">Open</span>
                                    </div>
                                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-info">
                                        <p className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-desc">
                                            {req.description
                                                ? req.description.length > 100
                                                    ? req.description.substring(0, 100) + "…"
                                                    : req.description
                                                : "No description provided"}
                                        </p>
                                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-meta">
                                            <span>by {req.userName}</span>
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
                    <section className="mt-12" >
                        <h2 className="text-lg font-bold mb-6 text-ink-light" >
                            ✅ Resolved ({resolvedRequests.length})
                        </h2>
                        <div className="grid grid-cols-[repeat(auto-fill, minmax(280px, 1fr))] gap-6">
                            {resolvedRequests.map((req) => (
                                <Link
                                    key={req.id}
                                    href={`/community/help-id/${req.id}`}
                                    className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col resolved"
                                    id={`help-id-${req.id}`}
                                >
                                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-image">
                                        {signedUrlMap.get(req.id) ? (
                                            <img
                                                src={signedUrlMap.get(req.id)!}
                                                alt="Identified model"
                                                className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-img"
                                            />
                                        ) : (
                                            <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-placeholder">🐴</div>
                                        )}
                                        <span className="bg-[rgba(240, 208, 108, 0.85)] text-white border border-[rgba(240, 208, 108, 0.5)] resolved">Resolved</span>
                                    </div>
                                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-info">
                                        <p className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-desc">
                                            {req.description
                                                ? req.description.length > 100
                                                    ? req.description.substring(0, 100) + "…"
                                                    : req.description
                                                : "No description"}
                                        </p>
                                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg overflow-hidden no-underline transition-all flex flex-col-meta">
                                            <span>by {req.userName}</span>
                                            <span>💬 {suggestionCounts.get(req.id) || 0}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {openRequests.length === 0 && resolvedRequests.length === 0 && (
                    <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-[var(--space-3xl)] mt-12" style={{ textAlign: "center" }}>
                        <p className="text-[2rem] mb-4" >🔍</p>
                        <p className="text-ink-light" >No ID requests yet. Be the first to submit one!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
