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
        <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
            <div className="animate-fade-in-up">
                <div className="shelf-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between border-b px-8 py-[0] transition-all max-sm:py-[0]">
                    <div>
                        <h1>
                            <span className="text-forest">Batch Import</span>
                        </h1>
                        <p className="text-muted mt-1">Import your collection from a CSV spreadsheet</p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← Back to Stable
                    </Link>
                </div>

                <CsvImport />
            </div>
        </div>
    );
}
