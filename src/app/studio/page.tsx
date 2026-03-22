import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { browseArtists } from"@/app/actions/art-studio";
import ArtistBrowser from"@/components/ArtistBrowser";

export const dynamic ="force-dynamic";

export const metadata = {
 title:"Art Studios — Model Horse Hub",
 description:"Browse custom artists — painters, sculptors, and tack makers in the model horse community.",
};

export default async function StudiosPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const artists = await browseArtists();

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <div className="animate-fade-in-up mb-8">
 <h1 className="text-2xl font-bold tracking-tight">
 🎨 <span className="text-forest">Art Studios</span>
 </h1>
 <p className="mt-2 max-w-xl text-base text-stone-500">
 Find custom painters, sculptors, and tack makers.
 </p>
 </div>
 <ArtistBrowser artists={artists} />
 </div>
 );
}
