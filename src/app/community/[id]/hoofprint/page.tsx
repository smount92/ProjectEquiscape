import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import Link from"next/link";
import { getHoofprint } from"@/app/actions/hoofprint";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import ShareButton from"@/components/ShareButton";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


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

 const { data: rawRecords } = await supabase
 .from("show_records")
 .select('show_name, show_date, division,"placing", ribbon_color')
 .eq("horse_id", horseId)
 .order("show_date", { ascending: false, nullsFirst: false });

 const records = rawRecords ?? [];

 const refName = h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` : null;

 return (
 <ExplorerLayout
  title={<>🐾 <span className="text-forest">Hoofprint™ Report</span></>}
  description={<>Full provenance record for <strong>{h.custom_name}</strong>{refName && <> · {refName} · {h.finish_type} · {h.condition_grade}</>}</>}
  headerActions={
  <>
   <Link
   href={`/community/${horseId}`}
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
   >
   ← Back to Passport
   </Link>
   <ShareButton
   title={`🐾 Hoofprint™ — ${h.custom_name}`}
   text={`Check out the full provenance record for ${h.custom_name} on Model Horse Hub!`}
   variant="full"
   label="Share Report"
   />
  </>
  }
 >
  <HoofprintTimeline
  horseId={horseId}
  timeline={timeline}
  ownershipChain={ownershipChain}
  lifeStage={lifeStage}
  isOwner={false}
  />

  {records.length > 0 && (
  <div className="bg-card border-input mt-8 rounded-lg border p-6 shadow-md transition-all">
   <h2 className="mb-4 text-lg">🏆 Show Record</h2>
   <div className="grid gap-1">
   {records.map((r, i) => (
    <div
    key={i}
    className="flex items-center gap-2 rounded-md bg-muted/50 border border-input px-2 py-1 text-[0.8rem]"
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
    {r.division && <span className="text-muted-foreground">— {r.division}</span>}
    {r.placing && <span className="text-muted-foreground">({r.placing})</span>}
    {r.show_date && (
     <span className="text-muted-foreground ml-auto text-xs">
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
 </ExplorerLayout>
 );
}
