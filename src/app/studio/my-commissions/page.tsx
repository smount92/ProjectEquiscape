import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getClientCommissions } from"@/app/actions/art-studio";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import { STATUS_STYLES } from "@/lib/studio/statusStyles";
import { Palette, CheckCircle, Ban, DollarSign, type LucideIcon } from "lucide-react";

export const metadata = {
 title:"My Commissions — Model Horse Hub",
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

 const renderGroup = (title: string, items: typeof commissions, Icon: LucideIcon) => {
 if (items.length === 0) return null;
 return (
  <div className="mb-8">
  <h2 className="mb-4 flex items-center gap-2 text-lg">
   <Icon className="h-5 w-5" /> {title} ({items.length})
  </h2>
  <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-md:grid-cols-1">
   {items.map((c) => (
   <Link
    key={c.id}
    href={`/studio/commission/${c.id}`}
    className="border-input flex flex-col rounded-lg border bg-muted p-6 text-inherit no-underline transition-all hover:-translate-y-[1px] hover:border-studio/50"
   >
    <div className="mb-2 flex items-center justify-between gap-2">
    <span className="text-base font-bold">
     {c.commissionType}
    </span>
    <span
     className={`inline-flex items-center rounded-full px-[10px] py-[3px] text-xs font-semibold whitespace-nowrap border ${STATUS_STYLES[c.status] || "bg-muted text-muted-foreground border-input"}`}
    >
     {c.statusLabel}
    </span>
    </div>
    <div className="text-muted-foreground mb-2 flex gap-4 text-sm">
    <span className="inline-flex items-center gap-1"><Palette className="h-4 w-4" /> @{c.artistAlias}</span>
    {c.priceQuoted && <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" /> {c.priceQuoted}</span>}
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
  title={<span className="text-forest">My Commissions</span>}
  description="Track commissions you've requested from artists."
 >
  {commissions.length === 0 ? (
  <div
   className="bg-card border-input animate-fade-in-up rounded-lg border text-center shadow-md transition-all"
  >
   <Palette className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
   <p className="text-muted-foreground">You haven&apos;t requested any commissions yet.</p>
   <Button asChild><Link
   href="/discover"
   >
   Browse Artists →
   </Link></Button>
  </div>
  ) : (
  <div className="animate-fade-in-up">
   {renderGroup("Active", active, Palette)}
   {renderGroup("Completed", completed, CheckCircle)}
   {renderGroup("Closed", closed, Ban)}
  </div>
  )}
 </ExplorerLayout>
 );
}
