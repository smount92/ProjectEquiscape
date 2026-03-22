import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getClientCommissions } from"@/app/actions/art-studio";

export const dynamic ="force-dynamic";

export const metadata = {
 title:"My Commissions — Model Horse Hub",
};

const STATUS_COLORS: Record<string, string> = {
 requested:"#6b7280",
 accepted:"#3b82f6",
 in_progress:"#f59e0b",
 review:"#8b5cf6",
 revision:"#f97316",
 completed:"#22c55e",
 delivered:"#14b8a6",
 declined:"#ef4444",
 cancelled:"#ef4444",
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
 <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">
 {emoji} {title} ({items.length})
 </h2>
 <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 max-md:grid-cols-1">
 {items.map((c) => (
 <Link
 key={c.id}
 href={`/studio/commission/${c.id}`}
 className="border-edge flex flex-col rounded-lg border bg-[var(--color-bg-elevated)] p-6 transition-all hover:-translate-y-[1px] hover:border-[rgba(139,92,246,0.3)]"
 style={{ textDecoration:"none", color:"inherit" }}
 >
 <div className="mb-2 flex items-center justify-between gap-2">
 <span className="text-[calc(0.95rem*var(--font-scale))] font-bold">
 {c.commissionType}
 </span>
 <span
 className="inline-flex items-center rounded-full px-[10px] py-[3px] text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap"
 style={{
 backgroundColor: `${STATUS_COLORS[c.status]}20`,
 color: STATUS_COLORS[c.status],
 border: `1px solid ${STATUS_COLORS[c.status]}40`,
 }}
 >
 {c.statusLabel}
 </span>
 </div>
 <div className="text-muted mb-2 flex gap-4 text-[calc(0.8rem*var(--font-scale))]">
 <span>🎨 @{c.artistAlias}</span>
 {c.priceQuoted && <span>💰 ${c.priceQuoted}</span>}
 </div>
 <p className="text-ink-light mb-2 text-[calc(0.85rem*var(--font-scale))] leading-normal">
 {c.description.length > 100 ? c.description.substring(0, 100) +"…" : c.description}
 </p>
 <div
 className="text-muted pt-2 text-[calc(0.7rem*var(--font-scale))]"
 style={{ marginTop:"auto" }}
 >
 Last updated{""}
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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-0">
 {/* Header */}
 <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <h1>
 🎨 <span className="text-forest">My Commissions</span>
 </h1>
 <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 Track commissions you&apos;ve requested from artists.
 </p>
 </div>
 </div>

 {commissions.length === 0 ? (
 <div
 className="bg-card border-edge animate-fade-in-up rounded-lg border shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <p className="mb-4 text-[2rem]">🎨</p>
 <p className="text-muted">You haven&apos;t requested any commissions yet.</p>
 <Link
 href="/discover"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
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
 </div>
 );
}
