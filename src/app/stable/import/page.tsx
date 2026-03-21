import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import CsvImport from "@/components/CsvImport";

export const metadata: Metadata = {
    title: "Batch CSV Import — Model Horse Hub",
    description:
        "Import your model horse collection from a CSV spreadsheet. Fuzzy-match against 10,500+ reference releases and artist resins, review matches, and bulk import.",
};

export default async function ImportPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="animate-fade-in-up">
                <div className="shelf-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <div>
                        <h1>
                            <span className="text-forest">Batch Import</span>
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Import your collection from a CSV spreadsheet
                        </p>
                    </div>
                    <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                        ← Back to Stable
                    </Link>
                </div>

                <CsvImport />
            </div>
        </div>
    );
}
