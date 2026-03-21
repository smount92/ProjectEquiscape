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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 max-w-[var(--max-width)]">
            <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2 animate-fade-in-up">
                <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-content">
                    <h1>🎨 <span className="text-forest">Art Studios</span></h1>
                    <p className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-subtitle">
                        Find custom painters, sculptors, and tack makers.
                    </p>
                </div>
            </div>
            <ArtistBrowser artists={artists} />
        </div>
    );
}
