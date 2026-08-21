import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getMyPurchasedReports } from "@/app/actions/purchased-reports";

/**
 * My Reports — the receipt drawer for paid one-off reports.
 *
 * The audit found a flow that could take money and then vanish: buying
 * an Insurance Report for a horse writes a `purchased_reports` row from
 * the Stripe webhook, and nothing anywhere ever read it back. This page
 * is that read.
 *
 * It is deliberately modest, and deliberately honest. Nothing is stored
 * when a report is bought — no PDF, no storage key, just the receipt —
 * because reports are rendered fresh from live vault data every time
 * (`/api/insurance-report`). So this page does not pretend to hand back
 * a saved document: it shows the ledger of what was bought and when,
 * links each line to the horse's passport, and points at the generator
 * that produces the current PDF. See the note at the foot of the page,
 * which says the same thing to the collector.
 */

export const metadata: Metadata = {
    title: "My Reports",
    description: "The insurance and market reports you've purchased on Model Horse Hub.",
    robots: { index: false, follow: false },
};

const REPORT_LABEL: Record<string, string> = {
    insurance: "Insurance Report",
};

const formatPurchaseDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

export default async function MyReportsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=%2Fmarket%2Freports");

    const reports = await getMyPurchasedReports();

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="📄"
                title="My Reports"
                subtitle={
                    reports.length > 0
                        ? `${reports.length} purchase${reports.length === 1 ? "" : "s"} on record`
                        : "Reports you've purchased"
                }
                backHref="/market/guide"
                backLabel="Blue Book"
            />

            <div className="mx-auto max-w-[900px]">
                {reports.length === 0 ? (
                    <div className="ledger-card py-12 text-center">
                        <div className="mb-4 text-[2.5rem]" aria-hidden="true">
                            📄
                        </div>
                        <h2 className="mb-2 font-serif text-xl font-bold">Nothing purchased yet</h2>
                        <p className="text-secondary-foreground mx-auto max-w-[460px] text-sm leading-relaxed">
                            Paid one-off reports show up here with the date you bought them. In the
                            meantime, the whole-stable insurance PDF and the Blue Book price guide are
                            free — no purchase, no Pro subscription.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <Button asChild variant="outline" size="wide">
                                <Link href="/market/guide">Open the Blue Book →</Link>
                            </Button>
                            <Button asChild variant="outline" size="wide">
                                <Link href="/settings">Insurance report in Settings →</Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <section className="ledger-card">
                        <span className="ledger-tab">Purchase Ledger</span>

                        {/* Wide tables scroll inside their own rail rather than
                            pushing the ledger leaf sideways on a phone. */}
                        <div className="-mx-2 overflow-x-auto px-2">
                            <table className="w-full min-w-[520px] border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className="py-2 pr-3">Purchased</th>
                                        <th className="py-2 pr-3">Report</th>
                                        <th className="py-2 pr-3">Model</th>
                                        <th className="py-2 text-right">Passport</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report) => (
                                        <tr key={report.id}>
                                            <td className="py-3 pr-3 align-top whitespace-nowrap">
                                                {formatPurchaseDate(report.purchasedAt)}
                                            </td>
                                            <td className="py-3 pr-3 align-top">
                                                <span className="inline-flex items-center gap-1.5 font-semibold">
                                                    <FileText
                                                        className="text-forest h-3.5 w-3.5 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    {REPORT_LABEL[report.reportType] ?? report.reportType}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 align-top">
                                                <span className="block font-semibold">
                                                    {report.horseName ?? "Model removed"}
                                                </span>
                                                {report.horseReference && (
                                                    <span className="text-muted-foreground block text-xs">
                                                        {report.horseReference}
                                                    </span>
                                                )}
                                                {report.horseMissing && (
                                                    <span className="stamp stamp-red mt-1 inline-block">
                                                        Retired
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right align-top">
                                                {report.horseMissing ? (
                                                    <span className="text-muted-foreground text-xs">
                                                        No longer in your stable
                                                    </span>
                                                ) : (
                                                    <Link
                                                        href={`/stable/${report.horseId}`}
                                                        className="text-forest text-xs font-semibold no-underline hover:underline"
                                                    >
                                                        Open passport →
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* The honest note. Reports are generated, not filed — say so
                    rather than dressing a receipt up as a download link that
                    hands back a different document than the one bought. */}
                <div className="ledger-card mt-6">
                    <span className="ledger-tab">How reports work</span>
                    <p className="text-secondary-foreground text-sm leading-relaxed">
                        Model Horse Hub doesn&rsquo;t file a copy of your report when you buy it. Every
                        insurance PDF is rendered fresh at the moment you ask for it, from your current
                        vault figures, condition grades and photos — so a report you generate today
                        reflects today&rsquo;s collection rather than the day you paid. That&rsquo;s
                        better for an insurer and worse for a filing cabinet, and it&rsquo;s why the
                        list above is a record of purchases rather than a shelf of documents.
                    </p>
                    <p className="text-secondary-foreground mt-3 text-sm leading-relaxed">
                        To produce the current PDF for your whole stable, use the insurance report
                        button in Settings. It covers every horse you own, including the ones listed
                        above.
                    </p>
                    <div className="mt-4">
                        <Button asChild variant="outline" size="wide">
                            <Link href="/settings">Generate an insurance PDF →</Link>
                        </Button>
                    </div>
                </div>

                <div className="border-input bg-card/50 mt-6 rounded-lg border p-6 text-xs backdrop-blur-sm">
                    <p>
                        🤝 Paid reports are a convenience, never a gate. The trust record — verified
                        show results, condition grades, Hoofprint provenance and the Blue Book&rsquo;s
                        sale history — is free for every collector, always.
                    </p>
                </div>
            </div>
        </ExplorerLayout>
    );
}
