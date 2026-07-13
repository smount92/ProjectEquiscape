import Link from"next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
 return (
 <div className="mx-auto max-w-6xl px-6 py-8">
 <div className="bg-card border-input animate-fade-in-up mx-auto max-w-[500px] rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>Page Not Found</h2>
 <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
 <Button asChild><Link
 href="/dashboard"
 >
 Back to Stable
 </Link></Button>
 </div>
 </div>
 );
}
