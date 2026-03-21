import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getArtistProfileBySlug } from "@/app/actions/art-studio";
import CommissionRequestForm from "@/components/CommissionRequestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const profile = await getArtistProfileBySlug(slug);
    return {
        title: profile
            ? `Request Commission — ${profile.studioName} | Model Horse Hub`
            : "Studio Not Found",
    };
}

export default async function CommissionRequestPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const profile = await getArtistProfileBySlug(slug);
    if (!profile) notFound();

    if (profile.status === "closed") {
        return (
            <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
                <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up" style={{ maxWidth: 600, margin: "0 auto", padding: "var(--space-2xl)", textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>🔴</div>
                    <h1 style={{ fontSize: "calc(1.3rem * var(--font-scale))" }}>Commissions Closed</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-sm)" }}>
                        {profile.studioName} is not accepting commissions right now.
                    </p>
                    <Link href={`/studio/${slug}`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ marginTop: "var(--space-lg)" }}>
                        ← Back to Studio
                    </Link>
                </div>
            </div>
        );
    }

    if (user.id === profile.userId) {
        return (
            <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
                <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up" style={{ maxWidth: 600, margin: "0 auto", padding: "var(--space-2xl)", textAlign: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>🎨</div>
                    <h1 style={{ fontSize: "calc(1.3rem * var(--font-scale))" }}>This is your studio!</h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-sm)" }}>
                        You can&apos;t commission yourself. Manage your commissions from the dashboard.
                    </p>
                    <Link href="/studio/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" style={{ marginTop: "var(--space-lg)" }}>
                        📊 Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up" style={{ maxWidth: 600, margin: "0 auto", padding: "var(--space-2xl)" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}>🎨</div>
                    <h1 style={{ fontSize: "calc(1.3rem * var(--font-scale))" }}>
                        <span className="text-forest">Request a Commission</span>
                    </h1>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))", marginTop: "var(--space-xs)" }}>
                        from <strong>{profile.studioName}</strong> by @{profile.ownerAlias}
                    </p>
                    {profile.status === "waitlist" && (
                        <p style={{ color: "var(--color-accent-warm)", fontSize: "calc(0.8rem * var(--font-scale))", marginTop: "var(--space-xs)" }}>
                            🟡 This artist is currently on waitlist — your request will be queued.
                        </p>
                    )}
                </div>

                <CommissionRequestForm artist={profile} />

                <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
                    <Link href={`/studio/${slug}`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                        ← Back to Studio
                    </Link>
                </div>
            </div>
        </div>
    );
}
