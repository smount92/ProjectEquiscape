import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import SuggestNewEntryForm from"@/components/SuggestNewEntryForm";

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
 <div className="mx-auto max-w-[720] max-w-[var(--max-width)] px-6 py-[0]">
 <nav className="text-muted animate-fade-in-up mb-6 flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))]">
 <Link href="/catalog">📚 Catalog</Link>
 <span className="text-muted mb-6-sep flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))]">
 ›
 </span>
 <span>Suggest New Entry</span>
 </nav>

 <div className="bg-card border-edge animate-fade-in-up rounded-lg border p-8 shadow-md transition-all">
 <h1
 className="mb-1 text-[calc(1.5rem*var(--font-scale))]"
 style={{ fontFamily:"var(--font-display)" }}
 >
 📗 Suggest a New Catalog Entry
 </h1>
 <p className="text-muted mb-6">
 Can&apos;t find a model in the catalog? Submit the details below and the community will review your
 suggestion.
 </p>

 <SuggestNewEntryForm />
 </div>
 </div>
 );
}
