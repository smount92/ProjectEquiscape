import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import SuggestNewEntryForm from"@/components/SuggestNewEntryForm";
import FocusLayout from"@/components/layouts/FocusLayout";
import CatalogSubMasthead from"@/components/catalog/CatalogSubMasthead";

export const metadata = {
 title:"Suggest New Catalog Entry",
 description:"Suggest a model that's missing from the reference catalog.",
};

/** Internal-path-only guard so ?redirectTo= can never open-redirect. */
function safeInternalPath(value: string | string[] | undefined): string | null {
 const raw = Array.isArray(value) ? value[0] : value;
 if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
 return raw;
}

export default async function SuggestNewEntryPage({
 searchParams,
}: {
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 const redirectTo = safeInternalPath((await searchParams).redirectTo);
 // /catalog/* is on the middleware's public list, so the login wall never
 // appends redirectTo for this page — carry the FULL intended URL ourselves
 // (house idiom, see /discover /feed) so "Suggest a new entry?" survives
 // the login round-trip, search context and all.
 if (!user) {
 const self = "/catalog/suggestions/new" + (redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "");
 redirect("/login?redirectTo=" + encodeURIComponent(self));
 }

 return (
 <FocusLayout noHeader>
  <CatalogSubMasthead
   icon="📗"
   title="Suggest a New Entry"
   subtitle="Community-reviewed additions to the catalog"
  />
  {redirectTo && (
  <p className="mb-3">
   <Link href={redirectTo} className="text-sm text-forest hover:underline">
   ← Back to your catalog search
   </Link>
  </p>
  )}
  <div className="bg-card border-input rounded-lg border p-8 shadow-md transition-all">
  <SuggestNewEntryForm />
  </div>
 </FocusLayout>
 );
}
