import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfileBySlug } from"@/app/actions/art-studio";
import CommissionRequestForm from"@/components/CommissionRequestForm";


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const profile = await getArtistProfileBySlug(slug);
 return {
 title: profile ? `Request Commission — ${profile.studioName} | Model Horse Hub` :"Studio Not Found",
 };
}

export default async function CommissionRequestPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const profile = await getArtistProfileBySlug(slug);
 if (!profile) notFound();

 if (profile.status ==="closed") {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div
 className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <div className="mb-4 text-[2.5rem]">🔴</div>
 <h1 className="text-xl">Commissions Closed</h1>
 <p className="text-muted mt-2">{profile.studioName} is not accepting commissions right now.</p>
 <Link
 href={`/studio/${slug}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Studio
 </Link>
 </div>
 </div>
 );
 }

 if (user.id === profile.userId) {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div
 className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <div className="mb-4 text-[2.5rem]">🎨</div>
 <h1 className="text-xl">This is your studio!</h1>
 <p className="text-muted mt-2">
 You can&apos;t commission yourself. Manage your commissions from the dashboard.
 </p>
 <Link
 href="/studio/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 📊 Go to Dashboard
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="bg-card border-edge animate-fade-in-up mx-auto max-w-[600] rounded-lg border shadow-md transition-all">
 {/* Header */}
 <div className="mb-8" style={{ textAlign:"center" }}>
 <div className="mb-2 text-[2.5rem]">🎨</div>
 <h1 className="text-xl">
 <span className="text-forest">Request a Commission</span>
 </h1>
 <p className="text-muted mt-1 text-sm">
 from <strong>{profile.studioName}</strong> by @{profile.ownerAlias}
 </p>
 {profile.status ==="waitlist" && (
 <p className="mt-1 text-sm text-[var(--color-accent-warm)]">
 🟡 This artist is currently on waitlist — your request will be queued.
 </p>
 )}
 </div>

 <CommissionRequestForm artist={profile} />

 <div className="mt-4" style={{ textAlign:"center" }}>
 <Link
 href={`/studio/${slug}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Back to Studio
 </Link>
 </div>
 </div>
 </div>
 );
}
