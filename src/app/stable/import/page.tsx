import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import CsvImport from"@/components/CsvImport";

export const metadata: Metadata = {
 title:"Batch CSV Import — Model Horse Hub",
 description:
"Import your model horse collection from a CSV spreadsheet. Fuzzy-match against 10,500+ reference releases and artist resins, review matches, and bulk import.",
};

export default async function ImportPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="animate-fade-in-up">
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div>
 <h1>
 <span className="text-forest">Batch Import</span>
 </h1>
 <p className="text-muted mt-1">Import your collection from a CSV spreadsheet</p>
 </div>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Stable
 </Link>
 </div>

 <CsvImport />
 </div>
 </div>
 );
}
