import Link from"next/link";

export default function NotFound() {
 return (
 <div className="mx-auto max-w-6xl px-6 py-8">
 <div className="bg-white border-input animate-fade-in-up mx-auto max-w-[500px] rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>Page Not Found</h2>
 <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 >
 Back to Stable
 </Link>
 </div>
 </div>
 );
}
