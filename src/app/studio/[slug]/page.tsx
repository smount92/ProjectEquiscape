import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfileBySlug } from"@/app/actions/art-studio";
import ShareButton from"@/components/ShareButton";

export const dynamic ="force-dynamic";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
 {/* Hero */}
 <div className="animate-fade-in-up rounded-lg border border-[rgba(139,92,246,0.15)] bg-[linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.06))] px-6 py-8">
 <div className="max-w-[800px]">
 <div className="gap-4" style={{ display:"flex", alignItems:"center", flexWrap:"wrap" }}>
 <h1 className="m-0 text-[calc(1.8rem*var(--font-scale))]">
 <span className="text-forest">{profile.studioName}</span>
 </h1>
 <span className={`studio-status-badge status-${profile.status}`}>
 {STATUS_EMOJI[profile.status]} {STATUS_LABEL[profile.status]}
 </span>
 </div>
 <p className="text-muted mt-1 text-[calc(0.9rem*var(--font-scale))]">
 by{""}
 <Link href={`/profile/${encodeURIComponent(profile.ownerAlias)}`} className="text-forest">
 @{profile.ownerAlias}
 </Link>
 </p>

 {profile.bioArtist && (
 <p className="text-ink-light mt-4 max-w-[600] leading-[1.6]">{profile.bioArtist}</p>
 )}

 {profile.specialties.length > 0 && (
 <div className="mt-4 gap-1" style={{ display:"flex", flexWrap:"wrap" }}>
 {profile.specialties.map((s) => (
 <span
 key={s}
 className="inline-block rounded-full border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.15)] px-[10px] py-[3px] text-xs font-semibold text-[#a78bfa]"
 >
 {s}
 </span>
 ))}
 </div>
 )}

 <div className="mt-6 gap-2" style={{ display:"flex", flexWrap:"wrap" }}>
 {profile.status !=="closed" && !isOwner && (
 <Link
 href={`/studio/${slug}/request`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 id="request-commission-btn"
 >
 🎨 Request a Commission
 </Link>
 )}
 {isOwner && (
 <>
 <Link
 href="/studio/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 📊 Dashboard
 </Link>
 <Link
 href="/studio/setup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
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
 <div className="bg-card border-edge mb-6 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">💰 Pricing & Timeline</h2>
 <div className="grid gap-2">
 {(profile.priceRangeMin || profile.priceRangeMax) && (
 <div className="flex items-center justify-between py-1">
 <span className="text-muted text-[calc(0.8rem*var(--font-scale))]">
 Price Range
 </span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-bold">
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
 <span className="text-muted text-[calc(0.8rem*var(--font-scale))]">Turnaround</span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-bold">
 {profile.turnaroundMinDays && profile.turnaroundMaxDays
 ? `${profile.turnaroundMinDays}–${profile.turnaroundMaxDays} days`
 : profile.turnaroundMinDays
 ? `Min ${profile.turnaroundMinDays} days`
 : `Up to ${profile.turnaroundMaxDays} days`}
 </span>
 </div>
 )}
 <div className="flex items-center justify-between py-1">
 <span className="text-muted text-[calc(0.8rem*var(--font-scale))]">
 Commission Slots
 </span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-bold">
 {slotsUsed} / {profile.maxSlots} filled
 </span>
 </div>
 </div>

 {profile.mediums.length > 0 && (
 <div className="mt-4">
 <span
 className="text-muted mb-1 text-[calc(0.8rem*var(--font-scale))]"
 style={{ display:"block" }}
 >
 Mediums
 </span>
 <div className="gap-1" style={{ display:"flex", flexWrap:"wrap" }}>
 {profile.mediums.map((m) => (
 <span
 key={m}
 className="inline-block rounded-full border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.1)] px-[10px] py-[3px] text-xs font-semibold text-[#2C5545]"
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
 className="text-muted mb-1 text-[calc(0.8rem*var(--font-scale))]"
 style={{ display:"block" }}
 >
 Scales
 </span>
 <div className="gap-1" style={{ display:"flex", flexWrap:"wrap" }}>
 {profile.scalesOffered.map((s) => (
 <span
 key={s}
 className="inline-block rounded-full border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.1)] px-[10px] py-[3px] text-xs font-semibold text-[#2C5545]"
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
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">📄 Terms & Conditions</h2>
 <p className="text-ink-light text-[calc(0.85rem*var(--font-scale))] leading-[1.6] whitespace-pre-wrap">
 {profile.termsText}
 </p>
 </div>
 )}
 </div>

 {/* Right: Commission Queue */}
 <div>
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">📋 Commission Queue</h2>
 {queue.length === 0 ? (
 <p className="text-muted text-[calc(0.85rem*var(--font-scale))]">
 No active commissions in the queue.
 </p>
 ) : (
 <div className="gap-2" style={{ display:"grid" }}>
 {queue.map((item, i) => {
 const st = COMMISSION_STATUS_LABELS[item.status] || {
 label: item.status,
 emoji:"📋",
 };
 return (
 <div
 key={item.id}
 className="flex items-center gap-2 rounded-md bg-[rgba(0,0,0,0.03)] px-4 py-2"
 >
 <span className="text-forest min-w-[50px] text-xs font-bold">
 Slot {item.slot_number || i + 1}
 </span>
 <span className="flex-1 text-[calc(0.85rem*var(--font-scale))] font-semibold">
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
 <div className="bg-card border-edge mt-6 rounded-lg border p-6 shadow-md transition-all">
 <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">✅ Currently Accepting</h2>
 <div className="gap-1" style={{ display:"grid" }}>
 {profile.acceptingTypes.map((t) => (
 <div
 key={t}
 className="p-[var(--space-xs) 0] gap-2"
 style={{ display:"flex", alignItems:"center" }}
 >
 <span className="text-[#22c55e]">✓</span>
 <span className="text-[calc(0.9rem*var(--font-scale))]">{t}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
