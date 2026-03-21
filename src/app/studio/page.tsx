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
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const artists = await browseArtists();

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                    <h1>
                        🎨 <span className="text-forest">Art Studios</span>
                    </h1>
                    <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                        Find custom painters, sculptors, and tack makers.
                    </p>
                </div>
            </div>
            <ArtistBrowser artists={artists} />
        </div>
    );
}
