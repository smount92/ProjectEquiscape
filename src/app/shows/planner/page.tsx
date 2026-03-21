import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getShowStrings } from "@/app/actions/competition";
import ShowStringManager from "@/components/ShowStringManager";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Show String Planner — Model Horse Hub",
    description: "Plan your show entries, track class assignments, and convert results into records.",
};

export default async function ShowPlannerPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const showStrings = await getShowStrings();

    // Get user's horses for the entry form
    const { data: horses } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("owner_id", user.id)
        .order("custom_name");

    const horseList = (horses || []).map((h: { id: string; custom_name: string }) => ({
        id: h.id,
        name: h.custom_name,
    }));

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    <div>
                        <h1>📋 Show String Planner</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Plan your entries, detect conflicts, and convert results into records.
                        </p>
                    </div>
                    <Link href="/shows" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">← Back to Shows</Link>
                </div>

                <ShowStringManager showStrings={showStrings} horses={horseList} />
            </div>
        </div>
    );
}
