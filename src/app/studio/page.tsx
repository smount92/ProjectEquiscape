import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { browseArtists } from "@/app/actions/art-studio";
import ArtistBrowser from "@/components/ArtistBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Art Studios — Model Horse Hub",
    description: "Browse custom artists — painters, sculptors, and tack makers in the model horse community.",
};

export default async function StudiosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const artists = await browseArtists();

    return (
        <div className="page-container page-container-wide">
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>🎨 <span className="text-gradient">Art Studios</span></h1>
                    <p className="community-hero-subtitle">
                        Find custom painters, sculptors, and tack makers.
                    </p>
                </div>
            </div>
            <ArtistBrowser artists={artists} />
        </div>
    );
}
