import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import Link from"next/link";
import { getHoofprint } from"@/app/actions/hoofprint";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import ShareButton from"@/components/ShareButton";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase = await createClient();
 const { data: horse } = await supabase
 .from("user_horses")
 .select("custom_name")
 .eq("id", id)
 .in("visibility", ["public","unlisted"])
 .single();
 return {
 title: horse
 ? `🐾 Hoofprint™ — ${(horse as { custom_name: string }).custom_name} | Model Horse Hub`
 :"Hoofprint™ Report | Model Horse Hub",
 };
}

export default async function HoofprintReportPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: horseId } = await params;
 const supabase = await createClient();

 // Verify horse is public or unlisted
 const { data: horse } = await supabase
 .from("user_horses")
 .select(
"id, custom_name, finish_type, condition_grade, is_public, catalog_items:catalog_id(title, maker, item_type)",
 )
 .eq("id", horseId)
 .in("visibility", ["public","unlisted"])
 .single();

 if (!horse) notFound();

 const h = horse;

 const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);

 // Fetch show records
 const { data: rawRecords } = await supabase
 .from("show_records")
 .select('show_name, show_date, division,"placing", ribbon_color')
 .eq("horse_id", horseId)
 .order("show_date", { ascending: false, nullsFirst: false });

 const records = rawRecords ?? [];

 const refName = h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` : null;

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 {/* Header */}
 <div className="animate-fade-in-up mb-6">
 <div className="mb-4">
 <h1 className="text-2xl font-bold tracking-tight">
 🐾 <span className="text-forest">Hoofprint™ Report</span>
 </h1>
 <p className="mt-2 text-base text-ink-light">
 Full provenance record for <strong>{h.custom_name}</strong>
 </p>
 {refName && (
 <p className="text-ink-light mt-1 text-sm">
 {refName} · {h.finish_type} · {h.condition_grade}
 </p>
 )}
 <div className="mt-4 flex flex-wrap gap-2">
 <Link
 href={`/community/${horseId}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Passport
 </Link>
 <ShareButton
 title={`🐾 Hoofprint™ — ${h.custom_name}`}
 text={`Check out the full provenance record for ${h.custom_name} on Model Horse Hub!`}
 variant="full"
 label="Share Report"
 />
 </div>
 </div>
 </div>

 {/* Ownership + Timeline */}
 <div className="animate-fade-in-up mt-8">
 <HoofprintTimeline
 horseId={horseId}
 timeline={timeline}
 ownershipChain={ownershipChain}
 lifeStage={lifeStage}
 isOwner={false}
 />
 </div>

 {/* Show Records Summary */}
 {records.length > 0 && (
 <div className="animate-fade-in-up bg-card border-edge mt-8 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-lg">🏆 Show Record</h2>
 <div className="grid gap-1">
 {records.map((r, i) => (
 <div
 key={i}
 className="flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[0.8rem]"
 >
 <span className="text-base">
 {r.ribbon_color ==="Blue"
 ?"🥇"
 : r.ribbon_color ==="Red"
 ?"🥈"
 : r.ribbon_color ==="Yellow"
 ?"🥉"
 :"🏅"}
 </span>
 <span className="font-semibold">{r.show_name}</span>
 {r.division && <span className="text-muted">— {r.division}</span>}
 {r.placing && <span className="text-muted">({r.placing})</span>}
 {r.show_date && (
 <span
 className="text-muted ml-auto text-xs"
 >
 {new Date(r.show_date).toLocaleDateString("en-US", {
 month:"short",
 year:"numeric",
 })}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}
