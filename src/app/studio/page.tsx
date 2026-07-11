import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { browseArtists } from"@/app/actions/art-studio";
import ArtistBrowser from"@/components/ArtistBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";


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
 <ExplorerLayout noHeader>
  <PageMasthead
   icon="🎨"
   title="Art Studios"
   subtitle="Find custom painters, sculptors, and tack makers"
  />
  <ArtistBrowser artists={artists} />
 </ExplorerLayout>
 );
}
