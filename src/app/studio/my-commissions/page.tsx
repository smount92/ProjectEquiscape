import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getClientCommissions } from"@/app/actions/art-studio";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


export const metadata = {
 title:"My Commissions — Model Horse Hub",
};

const STATUS_STYLES: Record<string, string> = {
 requested: "bg-stone-500/20 text-secondary-foreground border-stone-500/40",
 accepted: "bg-blue-500/20 text-blue-600 border-blue-500/40",
 in_progress: "bg-amber-500/20 text-amber-600 border-amber-500/40",
 review: "bg-violet-500/20 text-violet-600 border-violet-500/40",
 revision: "bg-orange-500/20 text-orange-600 border-orange-500/40",
 completed: "bg-green-500/20 text-green-600 border-green-500/40",
 delivered: "bg-teal-500/20 text-teal-600 border-teal-500/40",
 declined: "bg-red-500/20 text-red-600 border-red-500/40",
 cancelled: "bg-red-500/20 text-red-600 border-red-500/40",
};

export default async function MyCommissionsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const commissions = await getClientCommissions();

 // Group by status
 const active = commissions.filter((c) =>
 ["requested","accepted","in_progress","review","revision"].includes(c.status),
 );
 const completed = commissions.filter((c) => ["completed","delivered"].includes(c.status));
 const closed = commissions.filter((c) => ["declined","cancelled"].includes(c.status));

 const renderGroup = (title: string, items: typeof commissions, emoji: string) => {
 if (items.length === 0) return null;
 return (
  <div className="mb-8">
  <h2 className="mb-4 text-lg">
   {emoji} {title} ({items.length})
  </h2>
  <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-md:grid-cols-1">
   {items.map((c) => (
   <Link
    key={c.id}
    href={`/studio/commission/${c.id}`}
    className="border-input flex flex-col rounded-lg border bg-muted p-6 text-inherit no-underline transition-all hover:-translate-y-[1px] hover:border-purple-300"
   >
    <div className="mb-2 flex items-center justify-between gap-2">
    <span className="text-base font-bold">
     {c.commissionType}
    </span>
    <span
     className={`inline-flex items-center rounded-full px-[10px] py-[3px] text-xs font-semibold whitespace-nowrap border ${STATUS_STYLES[c.status] || "bg-stone-500/20 text-secondary-foreground border-stone-500/40"}`}
    >
     {c.statusLabel}
    </span>
    </div>
    <div className="text-muted-foreground mb-2 flex gap-4 text-sm">
    <span>🎨 @{c.artistAlias}</span>
    {c.priceQuoted && <span>💰 ${c.priceQuoted}</span>}
    </div>
    <p className="text-secondary-foreground mb-2 text-sm leading-normal">
    {c.description.length > 100 ? c.description.substring(0, 100) +"…" : c.description}
    </p>
    <div
    className="text-muted-foreground mt-auto pt-2 text-xs"
    >
    Last updated{" "}
    {new Date(c.lastUpdateAt).toLocaleDateString("en-US", {
     month:"short",
     day:"numeric",
    })}
    </div>
   </Link>
   ))}
  </div>
  </div>
 );
 };

 return (
 <ExplorerLayout
  title={<>🎨 <span className="text-forest">My Commissions</span></>}
  description="Track commissions you've requested from artists."
 >
  {commissions.length === 0 ? (
  <div
   className="bg-white border-input animate-fade-in-up rounded-lg border text-center shadow-md transition-all"
  >
   <p className="mb-4 text-[2rem]">🎨</p>
   <p className="text-muted-foreground">You haven&apos;t requested any commissions yet.</p>
   <Link
   href="/discover"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   >
   Browse Artists →
   </Link>
  </div>
  ) : (
  <div className="animate-fade-in-up">
   {renderGroup("Active", active,"🎨")}
   {renderGroup("Completed", completed,"✅")}
   {renderGroup("Closed", closed,"🚫")}
  </div>
  )}
 </ExplorerLayout>
 );
}
