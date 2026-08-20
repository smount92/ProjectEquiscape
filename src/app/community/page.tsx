import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { Suspense } from"react";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import ShowRingV2 from"./ShowRingV2";


export const metadata = {
 title:"The Show Ring",
 description:"Browse the community showcase of model horses cataloged by collectors around the world.",
};

/** Skeleton shown while the Show Ring loads */
function ShowRingSkeleton() {
 return (
 <div className="space-y-6">
  {/* Search bar skeleton */}
  <div className="animate-pulse rounded-xl bg-muted p-4">
   <div className="h-10 rounded-lg bg-muted" />
  </div>
  {/* Grid skeleton — 12 card placeholders */}
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
   {Array.from({ length: 12 }).map((_, i) => (
    <div key={i} className="animate-pulse rounded-lg border border-input bg-card shadow-sm">
     <div className="aspect-square rounded-t-lg bg-muted" />
     <div className="space-y-2 p-3">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-1/3 rounded bg-muted" />
     </div>
    </div>
   ))}
  </div>
 </div>
 );
}

export default async function CommunityPage({
 searchParams,
}: {
 searchParams: Promise<{ q?: string; finishType?: string; tradeStatus?: string; sortBy?: string }>;
}) {
 const params = await searchParams;
 const supabase = await createClient();

 // Auth check — community requires login (RLS needs authenticated user)
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 // Preserve intent through the login round-trip (matches proxy.ts;
 // loginAction honors it via safeRedirectPath).
 redirect("/login?redirectTo=" + encodeURIComponent("/community"));
 }

 return (
 // The leather masthead inside ShowRingV2 IS the page header
 // (title + description live on the band).
 <ExplorerLayout noHeader>
  <Suspense fallback={<ShowRingSkeleton />}>
  <ShowRingV2 searchParams={params} />
  </Suspense>
 </ExplorerLayout>
 );
}
