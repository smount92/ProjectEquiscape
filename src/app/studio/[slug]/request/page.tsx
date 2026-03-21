import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getArtistProfileBySlug } from "@/app/actions/art-studio";
import CommissionRequestForm from "@/components/CommissionRequestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const profile = await getArtistProfileBySlug(slug);
    return {
        title: profile ? `Request Commission — ${profile.studioName} | Model Horse Hub` : "Studio Not Found",
    };
}

export default async function CommissionRequestPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const profile = await getArtistProfileBySlug(slug);
    if (!profile) notFound();

    if (profile.status === "closed") {
        return (
            <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
                <div
                    className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ textAlign: "center" }}
                >
                    <div className="mb-4 text-[2.5rem]">🔴</div>
                    <h1 className="text-[calc(1.3rem*var(--font-scale))]">Commissions Closed</h1>
                    <p className="text-muted mt-2">{profile.studioName} is not accepting commissions right now.</p>
                    <Link
                        href={`/studio/${slug}`}
                        className="hover:no-underline-min-h)] text-ink-light border-edge mt-6 inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← Back to Studio
                    </Link>
                </div>
            </div>
        );
    }

    if (user.id === profile.userId) {
        return (
            <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
                <div
                    className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ textAlign: "center" }}
                >
                    <div className="mb-4 text-[2.5rem]">🎨</div>
                    <h1 className="text-[calc(1.3rem*var(--font-scale))]">This is your studio!</h1>
                    <p className="text-muted mt-2">
                        You can&apos;t commission yourself. Manage your commissions from the dashboard.
                    </p>
                    <Link
                        href="/studio/dashboard"
                        className="hover:no-underline-min-h)] bg-forest text-inverse mt-6 inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                    >
                        📊 Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
            <div className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                {/* Header */}
                <div className="mb-8" style={{ textAlign: "center" }}>
                    <div className="mb-2 text-[2.5rem]">🎨</div>
                    <h1 className="text-[calc(1.3rem*var(--font-scale))]">
                        <span className="text-forest">Request a Commission</span>
                    </h1>
                    <p className="text-muted mt-1 text-[calc(0.85rem*var(--font-scale))]">
                        from <strong>{profile.studioName}</strong> by @{profile.ownerAlias}
                    </p>
                    {profile.status === "waitlist" && (
                        <p className="mt-1 text-[calc(0.8rem*var(--font-scale))] text-[var(--color-accent-warm)]">
                            🟡 This artist is currently on waitlist — your request will be queued.
                        </p>
                    )}
                </div>

                <CommissionRequestForm artist={profile} />

                <div className="mt-4" style={{ textAlign: "center" }}>
                    <Link
                        href={`/studio/${slug}`}
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← Back to Studio
                    </Link>
                </div>
            </div>
        </div>
    );
}
