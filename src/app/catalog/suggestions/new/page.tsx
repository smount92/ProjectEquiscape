import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import SuggestNewEntryForm from"@/components/SuggestNewEntryForm";
import FocusLayout from"@/components/layouts/FocusLayout";

export const metadata = {
 title:"Suggest New Catalog Entry — Model Horse Hub",
 description:"Suggest a model that's missing from the reference catalog.",
};

export default async function SuggestNewEntryPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 return (
 <FocusLayout
  title="📗 Suggest a New Catalog Entry"
  description="Can't find a model in the catalog? Submit the details below and the community will review your suggestion."
  backLink={
  <nav className="text-muted-foreground flex items-center gap-1 text-sm">
   <Link href="/catalog">📚 Catalog</Link>
   <span className="text-muted-foreground">›</span>
   <span>Suggest New Entry</span>
  </nav>
  }
 >
  <div className="bg-white border-input rounded-lg border p-8 shadow-md transition-all">
  <SuggestNewEntryForm />
  </div>
 </FocusLayout>
 );
}
