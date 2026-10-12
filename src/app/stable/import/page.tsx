import { createClient } from"@/lib/supabase/server";
import { registryClaimLive, withRegistryClaim } from "@/lib/stats/registryClaimLive";
import { redirect } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import CsvImport from"@/components/CsvImport";
import { Button } from "@/components/ui/button";

const metadataTemplate: Metadata = {
 title:"Batch CSV Import",
 description:
"Import your model horse collection from a CSV spreadsheet. Fuzzy-match against {{registry}} reference releases and artist resins, review matches, and bulk import.",
};

export default async function ImportPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login?redirectTo=" + encodeURIComponent("/stable/import"));
 }

 return (
 // Own wide wrapper, NOT FocusLayout: its max-w-2xl (672px) crushed the
 // column-mapping table and match cards. Same header idiom, import-sized.
 <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
  <div>
  <Button asChild variant="outline" size="wide"><Link
   href="/dashboard"
  >
   ← Back to Stable
  </Link></Button>
  </div>

  <div>
  <div className="brass-heading">
   <span className="brass-heading-bar" aria-hidden="true" />
   <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground md:text-3xl">
   <span className="text-forest">Batch Import</span>
   </h1>
  </div>
  <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">
   Import your collection from a CSV spreadsheet
  </p>
  </div>

  <div className="w-full ledger-paper animate-fade-in-up">
  <CsvImport />
  </div>
 </div>
 );
}

/** The Registry claim in the description is the live count (lib/stats/registryClaim). */
export async function generateMetadata(): Promise<Metadata> {
    return withRegistryClaim(metadataTemplate, await registryClaimLive());
}
