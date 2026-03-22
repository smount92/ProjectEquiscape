export default function Loading() {
 return (
 <div className="mx-auto min-h-[60vh] max-w-[var(--max-width)] px-6 py-8">
 <div className="animate-pulse">
 <div className="skeleton-hero" />
 <div className="grid-cols-[repeat(auto-fill,minmax(260px,1fr))] grid gap-6">
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 <div className="rounded-lg bg-card/50 border-edge rounded-lg border shadow-md transition-all" />
 </div>
 </div>
 </div>
 );
}
