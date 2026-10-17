import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { listRules } from "@/app/actions/registry-desk-lists";
import { FIX_RULES } from "@/lib/registry/fixes";
import RulesBoard from "@/components/desk/RulesBoard";
import RuleProposalForm, { type FixOption } from "@/components/desk/RuleProposalForm";

export const metadata: Metadata = {
    title: "Rules · Registry Desk",
    robots: { index: false, follow: false },
};

/** The Registry's house style, written by the moderators (owner veto). */
export default async function DeskRulesPage() {
    // Own role check as well as the Desk layout's: a page never trusts its frame.
    if (!(await registryRoleOf())) notFound();
    const result = await listRules();
    const fixOptions: FixOption[] = Object.values(FIX_RULES).map((f) => ({
        key: f.key,
        label: f.label,
        before: f.example.before,
        after: f.example.after,
    }));
    return (
        <div className="flex flex-col gap-5">
            <p className="m-0 max-w-[75ch] text-secondary-foreground">
                The house style for the Registry, written by moderators. One proposes, the others agree, and at three
                agreements it takes effect, unless the site owner vetoes. Once a rule is in, its fix shows up as a
                suggested fix on every row it touches.
            </p>
            {result.success ? (
                <>
                    <RulesBoard rules={result.rules} />
                    <RuleProposalForm fixOptions={fixOptions} />
                </>
            ) : (
                <div role="alert" className="ledger-card text-secondary-foreground">
                    {result.error}
                </div>
            )}
        </div>
    );
}
