import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import { getPublicImageUrl } from"@/lib/utils/storage";
import HelpIdDetailClient from"@/components/HelpIdDetailClient";


export const metadata: Metadata = {
 title:"Help ID Request — Model Horse Hub",
 description:"View a mystery model identification request and community suggestions.",
};

interface PageProps {
 params: Promise<{ id: string }>;
}

export default async function HelpIdDetailPage({ params }: PageProps) {
 const { id } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 // Fetch the request — NO PostgREST join (FK is auth.users, not public.users)
 const { data: request } = await supabase
 .from("id_requests")
 .select("id, user_id, image_url, description, status, accepted_suggestion_id, created_at")
 .eq("id", id)
 .single();

 if (!request) notFound();

 const req = request as {
 id: string;
 user_id: string;
 image_url: string;
 description: string | null;
 status: string;
 accepted_suggestion_id: string | null;
 created_at: string;
 };

 // Fetch requester's alias name separately
 const { data: reqUser } = await supabase.from("users").select("alias_name").eq("id", req.user_id).single();
 const requesterName = (reqUser as { alias_name: string } | null)?.alias_name ??"Unknown";

 // Get signed URL for the image
 const signedImageUrl = req.image_url ? getPublicImageUrl(req.image_url) : null;

 // Fetch suggestions — NO PostgREST join for same reason
 const { data: rawSuggestions } = await supabase
 .from("id_suggestions")
 .select("id, user_id, catalog_id, free_text, upvotes, created_at")
 .eq("request_id", id)
 .order("upvotes", { ascending: false });

 const sugRows = (rawSuggestions ?? []) as {
 id: string;
 user_id: string;
 catalog_id: string | null;
 free_text: string | null;
 upvotes: number;
 created_at: string;
 }[];

 // Batch-fetch suggestion user names
 const sugUserIds = [...new Set(sugRows.map((s) => s.user_id))];
 const sugUserMap = new Map<string, string>();
 if (sugUserIds.length > 0) {
 const { data: sugUsers } = await supabase.from("users").select("id, alias_name").in("id", sugUserIds);
 if (sugUsers) {
 for (const u of sugUsers as { id: string; alias_name: string }[]) {
 sugUserMap.set(u.id, u.alias_name);
 }
 }
 }

 // Enrich suggestions with catalog item display names
 const catalogIds = sugRows.filter((s) => s.catalog_id).map((s) => s.catalog_id!);
 const catalogDisplayMap = new Map<string, string>();

 if (catalogIds.length > 0) {
 const { data: catalogItems } = await supabase
 .from("catalog_items")
 .select("id, title, maker, item_type")
 .in("id", catalogIds);

 if (catalogItems) {
 for (const c of catalogItems as { id: string; title: string; maker: string; item_type: string }[]) {
 catalogDisplayMap.set(c.id, `${c.maker} ${c.title}`);
 }
 }
 }

 const suggestions = sugRows.map((s) => ({
 id: s.id,
 user_id: s.user_id,
 free_text: s.free_text,
 upvotes: s.upvotes,
 created_at: s.created_at,
 userName: sugUserMap.get(s.user_id) ??"Unknown",
 releaseDisplay: s.catalog_id ? catalogDisplayMap.get(s.catalog_id) || null : null,
 resinDisplay: null as string | null,
 isAccepted: s.id === req.accepted_suggestion_id,
 }));

 const isOwner = user.id === req.user_id;
 const isResolved = req.status ==="resolved";

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="animate-fade-in-up">
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div>
 <h1>
 <span className="text-forest">Mystery Model</span>
 {isResolved && (
 <span
 className="ml-4 rounded-full bg-[rgba(92,224,160,0.15)] px-3 py-1 text-sm font-semibold text-emerald-600"
 >
 ✅ Resolved
 </span>
 )}
 </h1>
 <p className="text-ink-light mt-1">
 Submitted by {requesterName} on {new Date(req.created_at).toLocaleDateString()}
 </p>
 </div>
 <Link
 href="/community/help-id"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Help ID
 </Link>
 </div>

 {/* Main content grid */}
 <div className="mt-8 grid grid-cols-2 gap-8">
 {/* Photo */}
 <div className="bg-card border-edge overflow-hidden rounded-lg border shadow-md transition-all">
 {signedImageUrl ? (
 <img
 src={signedImageUrl}
 alt="Mystery model"
 className="block h-auto max-h-[500px] w-full object-contain"
 />
 ) : (
 <div className="flex h-[300px] items-center justify-center bg-[var(--color-surface-hover)] text-6xl">
 🐴
 </div>
 )}
 </div>

 {/* Description */}
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-base font-semibold">
 Description
 </h2>
 <p className="text-ink-light leading-[1.7]">{req.description ||"No description provided."}</p>
 </div>
 </div>

 {/* Client-side interactive section */}
 <HelpIdDetailClient
 requestId={req.id}
 isOwner={isOwner}
 isResolved={isResolved}
 acceptedSuggestionId={req.accepted_suggestion_id}
 suggestions={suggestions}
 />
 </div>
 </div>
 );
}
