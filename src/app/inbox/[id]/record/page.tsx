import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import EvidencePackActions from "@/components/deals/EvidencePackActions";
import { loadEvidencePack } from "@/app/inbox/reads";

export const metadata = {
    title: "Deal record",
    description: "The full, exportable record of one deal.",
    robots: { index: false, follow: false },
};

/**
 * THE DEAL RECORD — the page you hand a payment processor.
 *
 * The owner's ruling on what happens when a deal goes wrong: we are the
 * record, not the referee. We don't arbitrate, don't refund, don't
 * decide who is right — and then, crucially, we "USE our records to
 * prove to payment processors who did what."
 *
 * This is that. Who the parties are, what was agreed and when each side
 * confirmed it, every payment with the date it was said to be sent and
 * the date it was confirmed received, the platform's own unfalsifiable
 * timestamps, and the whole conversation. In order, stamped, and
 * printable.
 *
 * Two design decisions worth stating:
 *
 *  · It is deliberately plain. A dispute reviewer has minutes and
 *    trusts logs over layout; brand decoration on evidence reads as
 *    marketing and gets discounted.
 *  · It is owner-only to the two parties. The RLS on every underlying
 *    table already forbids a third party from loading it, and
 *    loadEvidencePack returns null rather than a partial pack, so the
 *    404 below is the whole access control story.
 */
export default async function DealRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const pack = await loadEvidencePack(conversationId, user.id);
    if (!pack) notFound();

    return (
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 print:max-w-none print:px-0 print:py-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <Link
                    href={`/inbox/${conversationId}`}
                    className="text-sm text-muted-foreground no-underline hover:underline"
                >
                    ← Back to the thread
                </Link>
            </div>

            <article className="rounded-lg border border-input bg-card p-6 shadow-md sm:p-10 print:border-0 print:p-0 print:shadow-none">
                <header className="mb-6 border-b border-input pb-5">
                    <div className="mb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        Model Horse Hub
                    </div>
                    <h1 className="mb-1 font-serif text-2xl font-bold">{pack.title}</h1>
                    <p className="m-0 text-sm text-secondary-foreground">{pack.subtitle}</p>
                </header>

                <p className="mb-8 rounded-md border border-input bg-muted/40 p-4 text-xs leading-relaxed text-secondary-foreground">
                    {pack.disclaimer}
                </p>

                {pack.sections.map((section) => (
                    <section key={section.id} className="mb-8 break-inside-avoid">
                        <h2 className="mb-2 border-b border-foreground/80 pb-1.5 font-serif text-base font-bold">
                            {section.title}
                        </h2>
                        {section.note && (
                            <p className="mt-0 mb-3 text-xs leading-relaxed text-muted-foreground">{section.note}</p>
                        )}

                        {section.rows && section.rows.length > 0 && (
                            <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(140px,220px)_1fr]">
                                {section.rows.map((row, i) => (
                                    <div key={i} className="contents">
                                        <dt className="text-xs whitespace-pre text-muted-foreground">{row.label}</dt>
                                        <dd className="m-0 text-sm break-words whitespace-pre-wrap">{row.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}

                        {section.table && (
                            <div className="mb-3 overflow-x-auto">
                                <table className="w-full min-w-[560px] text-xs">
                                    <thead>
                                        <tr className="border-b border-foreground/60 text-left">
                                            {section.table.headers.map((h, i) => (
                                                <th key={i} className="py-1.5 pr-3 font-semibold">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.table.rows.map((row, i) => (
                                            <tr key={i} className="border-b border-input/60">
                                                {row.map((cell, j) => (
                                                    <td key={j} className="py-1.5 pr-3">
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {section.lines && section.lines.length > 0 && (
                            <ul className="m-0 list-none p-0">
                                {section.lines.map((line, i) => (
                                    <li
                                        key={i}
                                        className="border-b border-input/40 py-1 text-xs leading-relaxed break-words last:border-b-0"
                                    >
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
            </article>

            <div className="mt-6">
                <EvidencePackActions pack={pack} filenameHint={conversationId.slice(0, 8)} />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground print:hidden">
                    Attach the PDF to a dispute, or paste the plain-text version into a form that won&apos;t take a
                    file. Model Horse Hub never held any of this money and takes no position on the outcome — what we
                    can prove is who said what, and when.
                </p>
            </div>
        </div>
    );
}
