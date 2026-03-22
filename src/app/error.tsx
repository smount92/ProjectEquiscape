"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-0">
 <div className="bg-card border-edge animate-fade-in-up mx-auto max-w-[500px] rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">⚠️</div>
 <h2>Something Went Wrong</h2>
 <p>An unexpected error occurred. Please try again.</p>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={reset}
 >
 Try Again
 </button>
 </div>
 </div>
 );
}
