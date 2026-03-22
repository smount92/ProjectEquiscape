import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfile, getArtistCommissions } from"@/app/actions/art-studio";
import CommissionBoard from"@/components/CommissionBoard";

export const dynamic ="force-dynamic";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 {/* Header */}
 <div className="animate-fade-in-up mb-8 rounded-lg border border-[rgba(139,92,246,0.15)] bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.06))] px-6 py-8">
 <div className="max-w-[800px]">
 <div
 className="justify-between gap-4"
 style={{ display:"flex", alignItems:"center", flexWrap:"wrap" }}
 >
 <div>
 <h1 className="m-0 text-2xl">
 <span className="text-forest">{profile.studioName}</span>
 </h1>
 <p className="text-muted mt-1 text-sm">Studio Dashboard</p>
 </div>
 <div className="gap-2" style={{ display:"flex", flexWrap:"wrap" }}>
 <Link
 href={`/studio/${profile.studioSlug}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 👁️ Public Page
 </Link>
 <Link
 href="/studio/setup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ✏️ Edit Studio
 </Link>
 </div>
 </div>

 {/* Stats Bar */}
 <div className="mt-6 flex flex-wrap gap-6 border-t border-[rgba(0,0,0,0.06)] pt-6">
 <div className="flex flex-col items-center gap-[2px]">
 <span className="text-forest text-xl font-extrabold">
 {activeCommissions.length}/{profile.maxSlots}
 </span>
 <span className="text-muted text-xs tracking-wider uppercase">
 Slots Filled
 </span>
 </div>
 <div className="flex flex-col items-center gap-[2px]">
 <span
 className="text-forest text-xl font-extrabold"
 style={{ color: pendingRequests.length > 0 ?"var(--color-accent-warm)" : undefined }}
 >
 {pendingRequests.length}
 </span>
 <span className="text-muted text-xs tracking-wider uppercase">
 Pending Requests
 </span>
 </div>
 <div className="flex flex-col items-center gap-[2px]">
 <span className="text-forest text-xl font-extrabold">
 {completedTotal.length}
 </span>
 <span className="text-muted text-xs tracking-wider uppercase">
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
 <span className="text-muted text-xs tracking-wider uppercase">
 Status
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Commission Board */}
 <CommissionBoard commissions={commissions} />
 </div>
 );
}
