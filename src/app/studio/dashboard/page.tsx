import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfile, getArtistCommissions } from"@/app/actions/art-studio";
import CommissionBoard from"@/components/CommissionBoard";
import CommandCenterLayout from"@/components/layouts/CommandCenterLayout";
import { Button } from "@/components/ui/button";
import { Eye, Pencil } from "lucide-react";


export const metadata = {
 title:"Studio Dashboard",
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
   <Button asChild variant="outline" size="wide"><Link
   href={`/studio/${profile.studioSlug}`}
   className="inline-flex items-center gap-2"
   >
   <Eye className="h-4 w-4" /> Public Page
   </Link></Button>
   <Button asChild variant="outline" size="wide"><Link
   href="/studio/setup"
   className="inline-flex items-center gap-2"
   >
   <Pencil className="h-4 w-4" /> Edit Studio
   </Link></Button>
  </>
  }
  mainContent={
  <>
   {/* Stats Bar */}
   <div className="rounded-lg border border-input bg-muted px-6 py-6">
   <div className="flex flex-wrap gap-6">
    <div className="flex flex-col items-center gap-[2px]">
    <span className="text-forest text-xl font-extrabold">
     {activeCommissions.length}/{profile.maxSlots}
    </span>
    <span className="text-muted-foreground text-xs tracking-wider uppercase">
     Slots Filled
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span
     className={`text-xl font-extrabold ${pendingRequests.length > 0 ? "text-warning" : "text-forest"}`}
    >
     {pendingRequests.length}
    </span>
    <span className="text-muted-foreground text-xs tracking-wider uppercase">
     Pending Requests
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span className="text-forest text-xl font-extrabold">
     {completedTotal.length}
    </span>
    <span className="text-muted-foreground text-xs tracking-wider uppercase">
     Completed
    </span>
    </div>
    <div className="flex flex-col items-center gap-[2px]">
    <span
     className={`studio-status-badge status-${profile.status} inline-flex items-center gap-1.5 text-xs`}
    >
     <span className={`inline-block h-2 w-2 rounded-full ${profile.status ==="open" ?"bg-success" : profile.status ==="waitlist" ?"bg-warning" :"bg-destructive"}`} />
     {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
    </span>
    <span className="text-muted-foreground text-xs tracking-wider uppercase">
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
