import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import type { Metadata } from"next";
import { getPublicImageUrl } from"@/lib/utils/storage";
import HelpIdRequestForm from"@/components/HelpIdRequestForm";

export const metadata: Metadata = {
 title:"Help Me ID This Model — Model Horse Hub",
 description:
"Can't identify a model horse? Upload a photo and let the community help! Our collectors can identify from 10,500+ reference releases and artist resins.",
};

export const dynamic ="force-dynamic";

export default async function HelpIdPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 // Fetch all requests (most recent first) — NO join to users (FK is auth.users, not public.users)
 const { data: rawRequests } = await supabase
 .from("id_requests")
 .select("id, user_id, image_url, description, status, created_at")
 .order("created_at", { ascending: false })
 .limit(50);

 const rawList = (rawRequests ?? []) as {
 id: string;
 user_id: string;
 image_url: string;
 description: string | null;
 status: string;
 created_at: string;
 }[];

 // Batch-fetch alias names from public.users
 const userIds = [...new Set(rawList.map((r) => r.user_id))];
 const userNameMap = new Map<string, string>();
 if (userIds.length > 0) {
 const { data: usersData } = await supabase.from("users").select("id, alias_name").in("id", userIds);
 if (usersData) {
 for (const u of usersData as { id: string; alias_name: string }[]) {
 userNameMap.set(u.id, u.alias_name);
 }
 }
 }

 const requests = rawList.map((r) => ({
 ...r,
 userName: userNameMap.get(r.user_id) ??"Unknown",
 }));

 // Get suggestion counts for each request
 const requestIds = requests.map((r) => r.id);
 let suggestionCounts = new Map<string, number>();
 if (requestIds.length > 0) {
 const { data: rawCounts } = await supabase
 .from("id_suggestions")
 .select("request_id")
 .in("request_id", requestIds);

 if (rawCounts) {
 const counts = new Map<string, number>();
 (rawCounts as { request_id: string }[]).forEach((r) => {
 counts.set(r.request_id, (counts.get(r.request_id) || 0) + 1);
 });
 suggestionCounts = counts;
 }
 }

 // Generate signed URLs for images
 const signedUrlMap = new Map<string, string>();
 for (const req of requests) {
 if (req.image_url) {
 const signedUrl = getPublicImageUrl(req.image_url);
 signedUrlMap.set(req.id, signedUrl);
 }
 }

 const openRequests = requests.filter((r) => r.status ==="open");
 const resolvedRequests = requests.filter((r) => r.status ==="resolved");

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
 <div className="animate-fade-in-up">
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div>
 <h1>
 <span className="text-forest">Help Me ID This Model</span>
 </h1>
 <p className="text-muted mt-1">Upload a mystery model and let the community help identify it</p>
 </div>
 <Link
 href="/community"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Show Ring
 </Link>
 </div>

 {/* Submit New Request Form */}
 <HelpIdRequestForm />

 {/* Open Requests */}
 {openRequests.length > 0 && (
 <section className="mt-12">
 <h2 className="mb-6 text-lg font-bold">🔍 Open Requests ({openRequests.length})</h2>
 <div className="grid-cols-[repeat(auto-fill,minmax(280px,1fr))] grid gap-6">
 {openRequests.map((req) => (
 <Link
 key={req.id}
 href={`/community/help-id/${req.id}`}
 className="bg-card border-edge flex flex-col overflow-hidden rounded-lg border no-underline shadow-md transition-all"
 id={`help-id-${req.id}`}
 >
 <div className="bg-card border-edge flex-col-image flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 {signedUrlMap.get(req.id) ? (
 <img
 src={signedUrlMap.get(req.id)!}
 alt="Mystery model"
 className="bg-card border-edge flex-col-img flex overflow-hidden rounded-lg border no-underline shadow-md transition-all"
 />
 ) : (
 <div className="bg-card border-edge flex-col-placeholder flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 🐴
 </div>
 )}
 <span className="bg-[rgba(240,208,108,0.85)] border-[rgba(240,208,108,0.5)] open border text-white">
 Open
 </span>
 </div>
 <div className="bg-card border-edge flex-col-info flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 <p className="bg-card border-edge flex-col-desc flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 {req.description
 ? req.description.length > 100
 ? req.description.substring(0, 100) +"…"
 : req.description
 :"No description provided"}
 </p>
 <div className="bg-card border-edge flex-col-meta flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 <span>by {req.userName}</span>
 <span>
 💬 {suggestionCounts.get(req.id) || 0} suggestion
 {(suggestionCounts.get(req.id) || 0) !== 1 ?"s" :""}
 </span>
 </div>
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}

 {/* Resolved Requests */}
 {resolvedRequests.length > 0 && (
 <section className="mt-12">
 <h2 className="text-ink-light mb-6 text-lg font-bold">
 ✅ Resolved ({resolvedRequests.length})
 </h2>
 <div className="grid-cols-[repeat(auto-fill,minmax(280px,1fr))] grid gap-6">
 {resolvedRequests.map((req) => (
 <Link
 key={req.id}
 href={`/community/help-id/${req.id}`}
 className="bg-card border-edge resolved flex flex-col overflow-hidden rounded-lg border no-underline shadow-md transition-all"
 id={`help-id-${req.id}`}
 >
 <div className="bg-card border-edge flex-col-image flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 {signedUrlMap.get(req.id) ? (
 <img
 src={signedUrlMap.get(req.id)!}
 alt="Identified model"
 className="bg-card border-edge flex-col-img flex overflow-hidden rounded-lg border no-underline shadow-md transition-all"
 />
 ) : (
 <div className="bg-card border-edge flex-col-placeholder flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 🐴
 </div>
 )}
 <span className="bg-[rgba(240,208,108,0.85)] border-[rgba(240,208,108,0.5)] resolved border text-white">
 Resolved
 </span>
 </div>
 <div className="bg-card border-edge flex-col-info flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 <p className="bg-card border-edge flex-col-desc flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 {req.description
 ? req.description.length > 100
 ? req.description.substring(0, 100) +"…"
 : req.description
 :"No description"}
 </p>
 <div className="bg-card border-edge flex-col-meta flex overflow-hidden rounded-lg border no-underline shadow-md transition-all">
 <span>by {req.userName}</span>
 <span>💬 {suggestionCounts.get(req.id) || 0}</span>
 </div>
 </div>
 </Link>
 ))}
 </div>
 </section>
 )}

 {openRequests.length === 0 && resolvedRequests.length === 0 && (
 <div
 className="bg-card border-edge mt-12 rounded-lg border p-[var(--space-3xl)] shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <p className="mb-4 text-[2rem]">🔍</p>
 <p className="text-ink-light">No ID requests yet. Be the first to submit one!</p>
 </div>
 )}
 </div>
 </div>
 );
}
