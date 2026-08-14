import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Root 404 — every notFound() in the app lands here, including stale
 * show links shared to Facebook. The CTAs must work for ANONYMOUS
 * visitors: the old sole "Back to Stable" → /dashboard button bounced
 * logged-out arrivals straight into the login wall.
 */
export default function NotFound() {
 return (
 <div className="mx-auto max-w-6xl px-6 py-8">
 <div className="bg-card border-input animate-fade-in-up mx-auto max-w-[500px] rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>Page Not Found</h2>
 <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
 <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
 <Button asChild>
 <Link href="/shows">Browse Shows</Link>
 </Button>
 <Button asChild variant="outline">
 <Link href="/">Home</Link>
 </Button>
 <Button asChild variant="outline">
 <Link href="/dashboard">My Stable</Link>
 </Button>
 </div>
 </div>
 </div>
 );
}
