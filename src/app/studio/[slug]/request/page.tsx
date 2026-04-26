import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { getArtistProfileBySlug } from"@/app/actions/art-studio";
import CommissionRequestForm from"@/components/CommissionRequestForm";
import FocusLayout from"@/components/layouts/FocusLayout";


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
  <FocusLayout title="Commissions Closed">
  <div className="animate-fade-in-up text-center">
   <div className="mb-4 text-[2.5rem]">🔴</div>
   <p className="text-stone-600 mt-2">{profile.studioName} is not accepting commissions right now.</p>
   <Link
   href={`/studio/${slug}`}
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   >
   ← Back to Studio
   </Link>
  </div>
  </FocusLayout>
 );
 }

 if (user.id === profile.userId) {
 return (
  <FocusLayout title="This is your studio!">
  <div className="animate-fade-in-up text-center">
   <div className="mb-4 text-[2.5rem]">🎨</div>
   <p className="text-stone-600 mt-2">
   You can&apos;t commission yourself. Manage your commissions from the dashboard.
   </p>
   <Link
   href="/studio/dashboard"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   >
   📊 Go to Dashboard
   </Link>
  </div>
  </FocusLayout>
 );
 }

 return (
 <FocusLayout
  title={<><span className="text-forest">Request a Commission</span></>}
  description={<>from <strong>{profile.studioName}</strong> by @{profile.ownerAlias}</>}
  backLink={
  <Link
   href={`/studio/${slug}`}
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
  >
   ← Back to Studio
  </Link>
  }
 >
  {profile.status ==="waitlist" && (
  <p className="mt-1 text-sm text-amber-500">
   🟡 This artist is currently on waitlist — your request will be queued.
  </p>
  )}

  <div className="bg-card border-input animate-fade-in-up rounded-lg border shadow-md transition-all">
  <CommissionRequestForm artist={profile} />
  </div>
 </FocusLayout>
 );
}
