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

    // Barns the artist RUNS — candidates for the studio's community
    // room (203). A barn you merely joined isn't yours to hang the
    // studio shingle on.
    let ownBarns: { id: string; name: string }[] = [];
    const { data: memberships } = await supabase
        .from("group_memberships")
        .select("group_id, role, groups:group_id(id, name)")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"]);
    ownBarns = (memberships ?? [])
        .map((m) => {
            const g = m.groups as unknown as { id: string; name: string } | null;
            return g ? { id: g.id, name: g.name } : null;
        })
        .filter((g): g is { id: string; name: string } => !!g)
        .sort((a, b) => a.name.localeCompare(b.name));

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
            <StudioSettings profile={profile} ownBarns={ownBarns} />
        </FocusLayout>
    );
}
