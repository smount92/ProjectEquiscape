import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import CsvImport from"@/components/CsvImport";
import FocusLayout from"@/components/layouts/FocusLayout";

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
 <FocusLayout
  title={<><span className="text-forest">Batch Import</span></>}
  description="Import your collection from a CSV spreadsheet"
  backLink={
  <Link
   href="/dashboard"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
  >
   ← Back to Stable
  </Link>
  }
 >
  <CsvImport />
 </FocusLayout>
 );
}
