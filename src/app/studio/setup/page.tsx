import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getArtistProfile } from "@/app/actions/art-studio";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import StudioSettings from "@/components/studio/StudioSettings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
    title: "Studio settings",
    robots: { index: false },
};

/**
 * Studio settings. Server component now — v1 was a client page that
 * fetched its own user id from /api/auth/me before it could do anything,
 * which meant an empty form on every load.
 */
export default async function StudioSetupPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=%2Fstudio%2Fsetup");

    const profile = await getArtistProfile(user.id);

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="🎨"
                title={profile ? "Studio settings" : "Open your studio"}
                subtitle={
                    profile
                        ? profile.studioName
                        : "Rates, terms and everything commissioners see"
                }
                backHref={profile ? "/studio/dashboard" : "/studio"}
                backLabel={profile ? "Dashboard" : "The Art Studio"}
            />
            <StudioSettings profile={profile} />
        </FocusLayout>
    );
}
