import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import SuggestNewEntryForm from"@/components/SuggestNewEntryForm";
import FocusLayout from"@/components/layouts/FocusLayout";
import CatalogSubMasthead from"@/components/catalog/CatalogSubMasthead";

export const metadata = {
 title:"Suggest New Catalog Entry",
 description:"Suggest a model that's missing from the reference catalog.",
};

export default async function SuggestNewEntryPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 return (
 <FocusLayout noHeader>
  <CatalogSubMasthead
   icon="📗"
   title="Suggest a New Entry"
   subtitle="Community-reviewed additions to the catalog"
  />
  <div className="bg-card border-input rounded-lg border p-8 shadow-md transition-all">
  <SuggestNewEntryForm />
  </div>
 </FocusLayout>
 );
}
