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
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">Batch Import</span>
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Import your collection from a CSV spreadsheet
                        </p>
                    </div>
                    <Link href="/dashboard" className="btn btn-ghost">
                        ← Back to Stable
                    </Link>
                </div>

                <CsvImport />
            </div>
        </div>
    );
}
