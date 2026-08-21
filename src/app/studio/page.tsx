import type { Metadata } from "next";
import Link from "next/link";

import { browseArtists } from "@/app/actions/art-studio";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import StudioDirectory from "@/components/studio/StudioDirectory";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * The Art Studio directory.
 *
 * Open to everyone. v1 redirected to /login, which meant an artist could
 * not share the directory — or their own studio inside it — anywhere the
 * hobby actually talks to each other.
 */

export const metadata: Metadata = {
    title: "Model Horse Commission Artists — Customizers, Finishwork & Tack",
    description:
        "Find customizers, finishwork artists, china painters and tack makers taking model horse commissions. Live commission status, rates by scale, written terms, and finished work with verified show records.",
    alternates: { canonical: "/studio" },
};

export default async function StudioDirectoryPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const studios = await browseArtists();
    const openCount = studios.filter((s) => s.effectiveStatus === "open").length;

    let hasStudio = false;
    if (user) {
        const { data } = await supabase
            .from("artist_profiles")
            .select("studio_slug")
            .eq("user_id", user.id)
            .maybeSingle();
        hasStudio = !!data;
    }

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="🎨"
                title="The Art Studio"
                subtitle={
                    studios.length === 0
                        ? "Commission customizers, finishwork artists and tack makers"
                        : `${studios.length} stud${studios.length === 1 ? "io" : "ios"} · ${openCount} open for commissions`
                }
                actions={
                    user ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href={hasStudio ? "/studio/dashboard" : "/studio/setup"}>
                                {hasStudio ? "My studio" : "Open a studio"}
                            </Link>
                        </Button>
                    ) : null
                }
            />

            <StudioDirectory studios={studios} />

            <div className="mt-10 grid gap-4 md:grid-cols-2">
                <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
                    <h3 className="mb-1 font-serif text-lg font-bold">
                        🎨 Take commissions? Open a studio
                    </h3>
                    <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                        Publish your rates by scale, set your terms once, and control intake with
                        slots that flip you to a waitlist when the bench fills. Your finished
                        horses appear on your page automatically — with every ribbon they go on to
                        win.
                    </p>
                    <Button asChild variant="outline" size="wide">
                        <Link href={hasStudio ? "/studio/setup" : "/studio/setup"}>
                            {hasStudio ? "Edit your studio →" : "Open your studio →"}
                        </Link>
                    </Button>
                </div>

                <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
                    <h3 className="mb-1 font-serif text-lg font-bold">
                        📋 Commissioning someone?
                    </h3>
                    <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                        Send a request with your references and budget, get a written quote with
                        the terms attached, and follow the work in progress. Everything you agree
                        is on the record — and when it&rsquo;s finished you can file the cost
                        straight into your horse&rsquo;s vault.
                    </p>
                    <Button asChild variant="outline" size="wide">
                        <Link href="/studio/my-commissions">Your commissions →</Link>
                    </Button>
                </div>
            </div>

            <div className="border-input bg-card/50 mt-6 rounded-lg border p-6 text-xs leading-relaxed backdrop-blur-sm">
                <p className="m-0">
                    🤝 Model Horse Hub never handles commission money and never takes a cut.
                    Deposits and payments are arranged directly between the commissioner and the
                    artist; what we keep is the record of what you agreed, when — and the show
                    results that prove an artist&rsquo;s work.
                </p>
            </div>
        </ExplorerLayout>
    );
}
