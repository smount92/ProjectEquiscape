"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 return (
 <div className="mx-auto max-w-6xl px-6 py-8">
 <div className="bg-card border-input animate-fade-in-up mx-auto max-w-[500px] rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">⚠️</div>
 <h2>Something Went Wrong</h2>
 <p>An unexpected error occurred. Please try again.</p>
 <Button
 onClick={reset}
 >
 Try Again
 </Button>
 </div>
 </div>
 );
}
