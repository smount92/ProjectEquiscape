import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfileBySlug } from"@/app/actions/art-studio";
import ShareButton from"@/components/ShareButton";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const profile = await getArtistProfileBySlug(slug);
 return {
 title: profile ? `${profile.studioName} — Art Studio | Model Horse Hub` :"Studio Not Found — Model Horse Hub",
 description: profile
 ? `${profile.studioName} — ${profile.specialties.join(",") ||"Model horse artist"}`
 :"This studio could not be found.",
 };
}

const STATUS_EMOJI: Record<string, string> = {
 open:"🟢",
 waitlist:"🟡",
 closed:"🔴",
};

const STATUS_LABEL: Record<string, string> = {
 open:"Open for Commissions",
 waitlist:"Waitlist Open",
 closed:"Commissions Closed",
};

export default async function PublicStudioPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const profile = await getArtistProfileBySlug(slug);
 if (!profile) notFound();

 const isOwner = user.id === profile.userId;

 // Fetch public queue (active commissions)
 const { data: rawQueue } = await supabase
 .from("commissions")
 .select("id, commission_type, status, slot_number, is_public_in_queue")
 .eq("artist_id", profile.userId)
 .eq("is_public_in_queue", true)
 .in("status", ["accepted","in_progress","review"])
 .order("slot_number", { ascending: true });

 const queue = (rawQueue ?? []) as {
 id: string;
 commission_type: string;
 status: string;
 slot_number: number | null;
 is_public_in_queue: boolean;
 }[];

 // Count active commissions for slots info
 const { count: activeCount } = await supabase
 .from("commissions")
 .select("id", { count:"exact", head: true })
 .eq("artist_id", profile.userId)
 .in("status", ["accepted","in_progress","review"]);

 const slotsUsed = activeCount || 0;

 const COMMISSION_STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
 accepted: { label:"Queued", emoji:"📋" },
 in_progress: { label:"In Progress", emoji:"🎨" },
 review: { label:"Review", emoji:"👁️" },
 };

 return (
 <ExplorerLayout
  title={<><span className="text-forest">{profile.studioName}</span></>}
  description={<>by <Link href={`/profile/${encodeURIComponent(profile.ownerAlias)}`} className="text-forest">@{profile.ownerAlias}</Link> · {STATUS_EMOJI[profile.status]} {STATUS_LABEL[profile.status]}</>}
 >
 {/* Hero */}
 <div className="animate-fade-in-up rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 px-6 py-8">
 <div className="max-w-[800px]">
 <div className="flex flex-wrap items-center gap-4">
 <h1 className="m-0 text-2xl">
 <span className="text-forest">{profile.studioName}</span>
 </h1>
 <span className={`studio-status-badge status-${profile.status}`}>
 {STATUS_EMOJI[profile.status]} {STATUS_LABEL[profile.status]}
 </span>
 </div>
 <p className="text-stone-600 mt-1 text-sm">
 by{""}
 <Link href={`/profile/${encodeURIComponent(profile.ownerAlias)}`} className="text-forest">
 @{profile.ownerAlias}
 </Link>
 </p>

 {profile.bioArtist && (
 <p className="text-stone-600 mt-4 max-w-[600] leading-[1.6]">{profile.bioArtist}</p>
 )}

 {profile.specialties.length > 0 && (
 <div className="mt-4 flex flex-wrap gap-1">
 {profile.specialties.map((s) => (
 <span
 key={s}
 className="inline-block rounded-full border border-purple-300 bg-purple-100 px-[10px] py-[3px] text-xs font-semibold text-purple-500"
 >
 {s}
 </span>
 ))}
 </div>
 )}

 <div className="mt-6 flex flex-wrap gap-2">
 {profile.status !=="closed" && !isOwner && (
 <Link
 href={`/studio/${slug}/request`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 id="request-commission-btn"
 >
 🎨 Request a Commission
 </Link>
 )}
 {isOwner && (
 <>
 <Link
 href="/studio/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 >
 📊 Dashboard
 </Link>
 <Link
 href="/studio/setup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 >
 ✏️ Edit Studio
 </Link>
 </>
 )}
 <ShareButton
 title={`${profile.studioName} — Model Horse Hub`}
 text={`Check out ${profile.studioName} on Model Horse Hub!`}
 label="Share"
 variant="full"
 />
 </div>
 </div>
 </div>

 <div className="animate-fade-in-up mt-8 grid grid-cols-2 gap-8 max-md:grid-cols-1">
 {/* Left: Details */}
 <div>
 {/* Pricing & Turnaround */}
 <div className="bg-white border-stone-200 mb-6 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-lg">💰 Pricing & Timeline</h2>
 <div className="grid gap-2">
 {(profile.priceRangeMin || profile.priceRangeMax) && (
 <div className="flex items-center justify-between py-1">
 <span className="text-stone-500 text-sm">
 Price Range
 </span>
 <span className="text-sm font-bold">
 {profile.priceRangeMin && profile.priceRangeMax
 ? `$${profile.priceRangeMin} – $${profile.priceRangeMax}`
 : profile.priceRangeMin
 ? `From $${profile.priceRangeMin}`
 : `Up to $${profile.priceRangeMax}`}
 </span>
 </div>
 )}
 {(profile.turnaroundMinDays || profile.turnaroundMaxDays) && (
 <div className="flex items-center justify-between py-1">
 <span className="text-stone-500 text-sm">Turnaround</span>
 <span className="text-sm font-bold">
 {profile.turnaroundMinDays && profile.turnaroundMaxDays
 ? `${profile.turnaroundMinDays}–${profile.turnaroundMaxDays} days`
 : profile.turnaroundMinDays
 ? `Min ${profile.turnaroundMinDays} days`
 : `Up to ${profile.turnaroundMaxDays} days`}
 </span>
 </div>
 )}
 <div className="flex items-center justify-between py-1">
 <span className="text-stone-500 text-sm">
 Commission Slots
 </span>
 <span className="text-sm font-bold">
 {slotsUsed} / {profile.maxSlots} filled
 </span>
 </div>
 </div>

 {profile.mediums.length > 0 && (
 <div className="mt-4">
 <span
 className="mb-1 block text-sm text-stone-500"
 >
 Mediums
 </span>
 <div className="flex flex-wrap gap-1">
 {profile.mediums.map((m) => (
 <span
 key={m}
 className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-[10px] py-[3px] text-xs font-semibold text-emerald-800"
 >
 {m}
 </span>
 ))}
 </div>
 </div>
 )}

 {profile.scalesOffered.length > 0 && (
 <div className="mt-4">
 <span
 className="mb-1 block text-sm text-stone-500"
 >
 Scales
 </span>
 <div className="flex flex-wrap gap-1">
 {profile.scalesOffered.map((s) => (
 <span
 key={s}
 className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-[10px] py-[3px] text-xs font-semibold text-emerald-800"
 >
 {s}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Terms */}
 {profile.termsText && (
 <div className="bg-white border-stone-200 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-lg">📄 Terms & Conditions</h2>
 <p className="text-stone-600 text-sm leading-[1.6] whitespace-pre-wrap">
 {profile.termsText}
 </p>
 </div>
 )}
 </div>

 {/* Right: Commission Queue */}
 <div>
 <div className="bg-white border-stone-200 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-lg">📋 Commission Queue</h2>
 {queue.length === 0 ? (
 <p className="text-stone-500 text-sm">
 No active commissions in the queue.
 </p>
 ) : (
 <div className="grid gap-2">
 {queue.map((item, i) => {
 const st = COMMISSION_STATUS_LABELS[item.status] || {
 label: item.status,
 emoji:"📋",
 };
 return (
 <div
 key={item.id}
 className="flex items-center gap-2 rounded-md bg-stone-50 px-4 py-2"
 >
 <span className="text-forest min-w-[50px] text-xs font-bold">
 Slot {item.slot_number || i + 1}
 </span>
 <span className="flex-1 text-sm font-semibold">
 {item.commission_type}
 </span>
 <span
 className={`commission-status-badge status-${item.status.replace("_","-")}`}
 >
 {st.emoji} {st.label}
 </span>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Accepting */}
 {profile.acceptingTypes.length > 0 && (
 <div className="bg-white border-stone-200 mt-6 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-lg">✅ Currently Accepting</h2>
 <div className="grid gap-1">
 {profile.acceptingTypes.map((t) => (
 <div
 key={t}
 className="flex items-center gap-2 py-1"
 >
 <span className="text-[#22c55e]">✓</span>
 <span className="text-sm">{t}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </ExplorerLayout>
 );
}
