import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfile, getArtistCommissions } from"@/app/actions/art-studio";
import CommissionBoard from"@/components/CommissionBoard";
import CommandCenterLayout from"@/components/layouts/CommandCenterLayout";


export const metadata = {
 title:"Studio Dashboard — Model Horse Hub",
};

export default async function StudioDashboardPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const profile = await getArtistProfile(user.id);
 if (!profile) redirect("/studio/setup");

 const commissions = await getArtistCommissions();

 // Stats
 const activeStatuses = ["accepted","in_progress","review","revision"];
 const activeCommissions = commissions.filter((c) => activeStatuses.includes(c.status));
 const pendingRequests = commissions.filter((c) => c.status ==="requested");
 const completedTotal = commissions.filter((c) => c.status ==="completed" || c.status ==="delivered");

 return (
 <CommandCenterLayout
  title={<><span className="text-forest">{profile.studioName}</span></>}
  description="Studio Dashboard"
  headerActions={
  <>
   <Link
   href={`/studio/${profile.studioSlug}`}
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   >
   👁️ Public Page
   </Link>
   <Link
   href="/studio/setup"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   >
   ✏️ Edit Studio
   </Link>
  </>
  }
  mainContent={
  <>
   {/* Stats Bar */}
   <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 px-6 py-6">
   <div className="flex flex-wrap gap-6">
    <div className="flex flex-col items-center gap-[2px]">
    <span className="text-forest text-xl font-extrabold">
     {activeCommissions.length}/{profile.maxSlots}
    </span>
    <span className="text-stone-500 text-xs tracking-wider uppercase">
     Slots Filled
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span
     className={`text-xl font-extrabold ${pendingRequests.length > 0 ? "text-amber-500" : "text-forest"}`}
    >
     {pendingRequests.length}
    </span>
    <span className="text-stone-500 text-xs tracking-wider uppercase">
     Pending Requests
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span className="text-forest text-xl font-extrabold">
     {completedTotal.length}
    </span>
    <span className="text-stone-500 text-xs tracking-wider uppercase">
     Completed
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span
     className={`studio-status-badge status-${profile.status} text-xs`}
    >
     {profile.status ==="open" ?"🟢" : profile.status ==="waitlist" ?"🟡" :"🔴"}{""}
     {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
    </span>
    <span className="text-stone-500 text-xs tracking-wider uppercase">
     Status
    </span>
    </div>
   </div>
   </div>

   {/* Commission Board */}
   <CommissionBoard commissions={commissions} />
  </>
  }
 />
 );
}
