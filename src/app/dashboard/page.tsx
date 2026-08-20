import { createClient } from"@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { redirect } from"next/navigation";
import { Suspense } from"react";
import DashboardToast from"@/components/DashboardToast";
import DashboardV2 from"./DashboardV2";


/** Skeleton shown while the stable ledger loads */
function DashboardSkeleton() {
 return (
 <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]">
  {/* Main Column Skeleton — Horse Card Grid */}
  <main className="min-w-0">
   <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
    {Array.from({ length: 12 }).map((_, i) => (
     <div key={i} className="bg-card border-input animate-pulse rounded-lg border shadow-sm">
      <div className="aspect-square rounded-t-lg bg-muted" />
      <div className="space-y-2 p-3">
       <div className="h-4 w-3/4 rounded bg-muted" />
       <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
     </div>
    ))}
   </div>
  </main>

  {/* Sidebar Skeleton — Stat Cards */}
  <aside className="space-y-6">
   <div className="bg-card border-input animate-pulse rounded-lg border p-6 shadow-md">
    <div className="mb-4 h-4 w-1/2 rounded bg-muted" />
    <div className="space-y-3">
     {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex justify-between">
       <div className="h-3 w-24 rounded bg-muted" />
       <div className="h-3 w-12 rounded bg-muted" />
      </div>
     ))}
    </div>
   </div>
   <div className="bg-card border-input animate-pulse rounded-lg border p-6 shadow-md">
    <div className="mb-4 h-4 w-1/3 rounded bg-muted" />
    <div className="space-y-2">
     {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-8 rounded bg-muted" />
     ))}
    </div>
   </div>
  </aside>
 </div>
 );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 const params = await searchParams;

 // Fast query for profile name (needed for the masthead)
 const { data: profile } = await supabase.from("users").select("alias_name").eq("id", user.id).single<{ alias_name: string }>();

 return (
 <div className="mx-auto w-full max-w-[1920px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
  <Suspense fallback={null}>
  <DashboardToast />
  </Suspense>
  <Suspense fallback={<DashboardSkeleton />}>
  <DashboardV2 userId={user.id} aliasName={profile?.alias_name ?? null} searchParams={params} />
  </Suspense>
 </div>
 );
}
