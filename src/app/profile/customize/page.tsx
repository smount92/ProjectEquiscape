/**
 * /profile/customize — the member's own profile settings.
 *
 * Its own route rather than a tab inside /settings: that page is
 * another surface's territory, and profile cosmetics belong next to
 * the profile they change.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import ProfileCustomizer from "@/components/profile/ProfileCustomizer";
import { getMyCustomization } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
    title: "Customize your profile",
    description: "Choose your profile's trim, nameplate, banner and featured horses.",
};

export default async function CustomizeProfilePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=%2Fprofile%2Fcustomize");

    const { data: me } = await supabase
        .from("users")
        .select("alias_name")
        .eq("id", user.id)
        .maybeSingle<{ alias_name: string }>();

    const state = await getMyCustomization();
    if (!state || !me) redirect("/settings");

    return (
        // noHeader: PageMasthead below is this page's header.
        <FocusLayout noHeader>
            <PageMasthead
                icon="🎨"
                title="Make it yours"
                subtitle="Trim, nameplate, banner and the horses that lead your stable"
            />
            <div className="mx-auto w-full max-w-[680px]">
                <p className="text-secondary-foreground mb-8 text-sm">
                    Everything here is cosmetic and public — it changes how{" "}
                    <Link href={`/profile/${encodeURIComponent(me.alias_name)}`}>your profile</Link>{" "}
                    looks to other collectors. Nothing here hides you from anyone or changes what the
                    show record says.
                </p>
                <ProfileCustomizer
                    alias={me.alias_name}
                    initial={state.customization}
                    initialBannerUrl={state.bannerUrl}
                    horses={state.horses}
                    available={state.available}
                />
            </div>
        </FocusLayout>
    );
}
