import Link from"next/link";
import { Suspense } from"react";
import type { Metadata } from"next";
import { searchMarketPrices } from"@/app/actions/market";
import MarketFilters from"@/components/MarketFilters";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";

export const metadata: Metadata = {
    title: "Model Horse Price Guide — The Blue Book",
    description:
        "Real sale data from real collectors. Browse average, median, and range pricing for model horses, tack, and props based on completed Model Horse Hub transactions.",
    alternates: { canonical: "/market" },
};

const formatCurrency = (value: number) =>
 new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits: 0 }).format(value);

const formatRelativeTime = (dateStr: string | null) => {
 if (!dateStr) return null;
 const d = new Date(dateStr);
 const now = new Date();
 const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
 if (days === 0) return"Today";
 if (days === 1) return"Yesterday";
 if (days < 30) return `${days}d ago`;
 if (days < 365) return `${Math.floor(days / 30)}mo ago`;
 return `${Math.floor(days / 365)}y ago`;
};

const typeIcon = (type: string) => {
 switch (type) {
 case"plastic_mold":
 case"plastic_release":
 return"🐎";
 case"artist_resin":
 return"🎨";
 case"tack":
 return"🏇";
 case"prop":
 return"🌲";
 case"diorama":
 return"🎭";
 default:
 return"📦";
 }
};

const PAGE_SIZE = 20;

export default async function MarketPricePage({
 searchParams,
}: {
 searchParams: Promise<{ q?: string; type?: string; finish?: string; stage?: string; sort?: string; page?: string }>;
}) {
 const params = await searchParams;
 const query = params.q ||"";
 const itemType = params.type ||"all";
 const finishType = params.finish ||"";
 const lifeStage = params.stage ||"";
 const sortValue = params.sort ||"transaction_volume:desc";
 const page = Math.max(1, parseInt(params.page ||"1"));
 const offset = (page - 1) * PAGE_SIZE;

 const [sortBy, sortDirection] = sortValue.split(":") as [
"average_price" |"transaction_volume" |"last_sold_at" |"title",
"asc" |"desc",
 ];

 const { items, total } = await searchMarketPrices(query || undefined, {
 itemType: itemType !=="all" ? itemType : undefined,
 finishType: finishType || undefined,
 lifeStage: lifeStage || undefined,
 sortBy,
 sortDirection,
 limit: PAGE_SIZE,
 offset,
 });

 const totalPages = Math.ceil(total / PAGE_SIZE);

 // Build pagination URLs
 const buildPageUrl = (p: number) => {
 const newParams = new URLSearchParams();
 if (query) newParams.set("q", query);
 if (itemType !=="all") newParams.set("type", itemType);
 if (sortValue !=="transaction_volume:desc") newParams.set("sort", sortValue);
 if (p > 1) newParams.set("page", String(p));
 const qs = newParams.toString();
 return `/market${qs ? `?${qs}` :""}`;
 };

 return (
 <ExplorerLayout noHeader>
  <PageMasthead icon="📈" title="Model Horse Price Guide" subtitle="The Blue Book — real sale data from real collectors" />
  <div className="mx-auto max-w-[900px]">
  <Suspense fallback={null}>
   <MarketFilters />
  </Suspense>
  {/* Results (Server-rendered) */}
  {items.length === 0 ? (
   <div
   className="bg-card border-input rounded-lg border p-12 text-center shadow-md transition-all"
   >
   <div className="mb-4 text-[3rem]">📊</div>
   <h3 className="mb-2">
    {query || itemType !=="all"
    ?"No matching price data"
    :"The Blue Book Grows With Every Sale"}
   </h3>
   <p className="text-secondary-foreground mx-auto max-w-[400]">
    {query || itemType !=="all"
    ?"Try broadening your search or changing the filter."
    :"Complete a transaction to contribute market data. Prices appear here after verified sales."}
   </p>
   </div>
  ) : (
   <>
   <div className="mb-4">
    <span className="text-muted-foreground text-sm">
    {total} item{total !== 1 ?"s" :""} with price data
    </span>
   </div>

   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => {
    const key = `${item.catalogId}::${item.finishType}::${item.lifeStage}`;
    const card = (
    <div
     className="bg-card border-input rounded-lg border p-6 shadow-md transition-all transition-colors"
    >
     <div className="flex items-center gap-3">
     <span className="flex-shrink-0 text-2xl">
      {typeIcon(item.itemType)}
     </span>
     <div className="min-w-0 flex-1">
      <span className="text-foreground block truncate font-semibold">
      {item.title}
      </span>
      <span className="text-muted-foreground block text-sm">
      {item.maker}
      {item.scale ? ` · ${item.scale}` :""}
      {item.finishType ? ` · ${item.finishType}` :""}
      {item.lifeStage && item.lifeStage !=="completed"
       ? ` · ${item.lifeStage ==="blank" ?"Blank" : item.lifeStage ==="stripped" ?"Stripped" :"In Progress"}`
       :""}
      </span>
     </div>
     </div>

     <div className="mt-4">
     <div className="text-forest text-lg font-bold">
      {formatCurrency(item.lowestPrice)}
      {item.lowestPrice !== item.highestPrice
      ? ` – ${formatCurrency(item.highestPrice)}`
      :""}
     </div>
     <div className="mt-[2px] text-sm text-muted-foreground">
      <span>Avg: {formatCurrency(item.averagePrice)}</span>
      <span> · Median: {formatCurrency(item.medianPrice)}</span>
     </div>
     </div>

     <div className="border-input mt-4 flex items-center justify-between border-t pt-4">
     <span className="text-forest inline-flex items-center rounded-full bg-success/10 px-[8px] py-[2px] font-semibold">
      {item.transactionVolume} sale{item.transactionVolume !== 1 ?"s" :""}
     </span>
     {item.lastSoldAt && (
      <span className="text-muted-foreground">
      Last sold: {formatRelativeTime(item.lastSoldAt)}
      </span>
     )}
     </div>
    </div>
    );
    // Link to the reference page only when it's live (ships dark otherwise).
    return referencePagesEnabled() ? (
     <Link
      key={key}
      href={referenceHref({ id: item.catalogId, maker: item.maker, title: item.title })}
      className="block no-underline"
     >
      {card}
     </Link>
    ) : (
     <div key={key}>{card}</div>
    );
    })}
   </div>

   {/* Pagination */}
   {totalPages > 1 && (
    <div className="border-input mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-6">
    {page > 1 ? (
     <Button asChild variant="outline" size="wide"><Link
     href={buildPageUrl(page - 1)}
     >
     ← Previous
     </Link></Button>
    ) : (
     <Button variant="outline" size="wide"
     disabled
     >
     ← Previous
     </Button>
    )}
    <span className="text-muted-foreground text-sm">
     Page {page} of {totalPages} ({total} items)
    </span>
    {page < totalPages ? (
     <Button asChild variant="outline" size="wide"><Link
     href={buildPageUrl(page + 1)}
     >
     Next →
     </Link></Button>
    ) : (
     <Button variant="outline" size="wide"
     disabled
     >
     Next →
     </Button>
    )}
    </div>
   )}
   </>
  )}

  {/* Disclaimer */}
  <div className="border-input mt-12 rounded-lg border bg-card/50 backdrop-blur-sm p-6 text-xs">
   <p>
   📋 Prices based on completed transactions recorded on Model Horse Hub. This is not a
   professional appraisal. Market conditions vary. Always research current listings before
   buying or selling.
   </p>
  </div>
  </div>
 </ExplorerLayout>
 );
}
