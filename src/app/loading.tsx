export default function Loading() {
 return (
 <div className="mx-auto min-h-[60vh] max-w-6xl px-6 py-8">
 <div className="animate-pulse">
 <div className="skeleton-hero" />
 <div className="grid-cols-[repeat(auto-fill,minmax(260px,1fr))] grid gap-6">
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-white/50 border-stone-200 rounded-lg border shadow-md transition-all" />
 </div>
 </div>
 </div>
 );
}
