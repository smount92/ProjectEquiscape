import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SuggestNewEntryForm from "@/components/SuggestNewEntryForm";

export const metadata = {
    title: "Suggest New Catalog Entry — Model Horse Hub",
    description: "Suggest a model that's missing from the reference catalog.",
};

export default async function SuggestNewEntryPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 max-w-[720]">
            <nav className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6 animate-fade-in-up">
                <Link href="/catalog">📚 Catalog</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <span>Suggest New Entry</span>
            </nav>

            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up p-8">
                <h1 className="text-[calc(1.5rem*var(--font-scale))] mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    📗 Suggest a New Catalog Entry
                </h1>
                <p className="text-muted mb-6" >
                    Can&apos;t find a model in the catalog? Submit the details below and the community will review your suggestion.
                </p>

                <SuggestNewEntryForm />
            </div>
        </div>
    );
}
