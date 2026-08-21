import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getArtistProfileBySlug, getSlotUsage } from "@/app/actions/art-studio";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import RequestForm from "@/components/studio/RequestForm";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { intakeFor, slotState } from "@/lib/studio/pipeline";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const profile = await getArtistProfileBySlug(slug);
    return {
        title: profile ? `Request a commission — ${profile.studioName}` : "Studio not found",
        robots: { index: false },
    };
}

export default async function RequestCommissionPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?redirectTo=%2Fstudio%2F${encodeURIComponent(slug)}%2Frequest`);

    const profile = await getArtistProfileBySlug(slug);
    if (!profile) notFound();

    const slots = slotState(
        await getSlotUsage(profile.userId),
        profile.maxSlots,
        profile.status,
    );
    const intake = intakeFor(slots, profile.waitlistOpen);

    const masthead = (
        <PageMasthead
            compact
            icon="🎨"
            title={profile.studioName}
            subtitle="Commission request"
            backHref={`/studio/${profile.studioSlug}`}
            backLabel="Back to the studio"
        />
    );

    // The artist's own studio.
    if (user.id === profile.userId) {
        return (
            <FocusLayout noHeader>
                {masthead}
                <div className="bg-card border-input rounded-lg border p-8 text-center shadow-md">
                    <div className="mb-3 text-[2.5rem]">🎨</div>
                    <h2 className="mb-2 font-serif text-xl font-bold">This is your studio</h2>
                    <p className="text-secondary-foreground mb-6 text-sm">
                        You can&rsquo;t commission yourself — but your dashboard has the requests
                        waiting on you.
                    </p>
                    <Button asChild size="wide">
                        <Link href="/studio/dashboard">Open your dashboard</Link>
                    </Button>
                </div>
            </FocusLayout>
        );
    }

    // Closed. Never a dead end: say when, and give them somewhere to go.
    if (!intake.accepting) {
        return (
            <FocusLayout noHeader>
                {masthead}
                <div className="bg-card border-input rounded-lg border p-8 text-center shadow-md">
                    <div className="mb-3 text-[2.5rem]">🚪</div>
                    <h2 className="mb-2 font-serif text-xl font-bold">
                        {profile.studioName} isn&rsquo;t taking commissions
                    </h2>
                    <p className="text-secondary-foreground mb-2 text-sm leading-relaxed">
                        {profile.statusNote ||
                            "Artists close intake while they work through the bench. It's worth checking back."}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button asChild variant="outline" size="wide">
                            <Link href={`/profile/${encodeURIComponent(profile.ownerAlias)}`}>
                                Follow @{profile.ownerAlias}
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="wide">
                            <Link href="/studio">Browse open studios →</Link>
                        </Button>
                    </div>
                </div>
            </FocusLayout>
        );
    }

    return (
        <FocusLayout noHeader>
            {masthead}
            <RequestForm artist={profile} asWaitlist={intake.asWaitlist} />
        </FocusLayout>
    );
}
