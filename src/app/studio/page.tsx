import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { browseArtists } from"@/app/actions/art-studio";
import ArtistBrowser from"@/components/ArtistBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


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
 <ExplorerLayout
  title={<>🎨 <span className="text-forest">Art Studios</span></>}
  description="Find custom painters, sculptors, and tack makers."
 >
  <ArtistBrowser artists={artists} />
 </ExplorerLayout>
 );
}
