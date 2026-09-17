/**
 * /admin/shows/[id] — the sanctioning review.
 *
 * The queue card says a host asked; this page shows the admin WHAT
 * they asked to sanction, drafts included (the public page refuses
 * drafts by design, and the admin isn't on the show's staff, so RLS
 * hides them from a normal read — the loader is service-role behind
 * verifyAdmin). The masthead and classlist are the public page's own
 * components, so what is reviewed is what entrants will see.
 *
 * Observations, not gates: the checks describe the show; the owner
 * decides. Grant / Dismiss sit right here so the decision follows
 * the reading.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shield } from "lucide-react";

import { getShowForSanctioningReview } from "@/app/actions/admin";
import { AdminReviewProgram, AdminSanctioningDecision } from "@/components/AdminShowReview";
import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";
import RichText from "@/components/RichText";
import AlbumMasthead from "@/components/shows/AlbumMasthead";
import type { CheckLevel } from "@/lib/shows/sanctioningReview";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LEVEL_GLYPH: Record<CheckLevel, string> = { ok: "✅", warn: "⚠️", info: "ℹ️" };
const LEVEL_CLASS: Record<CheckLevel, string> = {
    ok: "text-forest",
    warn: "text-[color:var(--color-warning)]",
    info: "text-muted-foreground",
};

export default async function AdminShowReviewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Same gate as /admin: only ADMIN_EMAIL, case-insensitive. The
    // loader re-verifies server-side regardless.
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        redirect("/dashboard");
    }

    const result = await getShowForSanctioningReview(id);
    if (!result.success) notFound();
    const r = result.review;
    const isDraft = r.show.status === "draft";

    return (
        <CommandCenterLayout
            title={
                <span className="inline-flex items-center gap-2 text-forest">
                    <Shield className="h-6 w-6" /> Sanctioning review
                </span>
            }
            description={
                <>
                    <strong>{r.show.title}</strong> as entrants will read it — hosted by @
                    {r.host.alias}
                    {isDraft && " · still a draft, not public yet"}
                </>
            }
            headerActions={
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/admin"
                        className="rounded-full border border-input px-3 py-1.5 text-xs font-semibold text-foreground no-underline hover:bg-muted"
                    >
                        ← Admin console
                    </Link>
                    {!isDraft && (
                        <Link
                            href={`/shows/${r.show.id}`}
                            target="_blank"
                            className="rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest no-underline hover:bg-forest/20"
                        >
                            Open public page ↗
                        </Link>
                    )}
                </div>
            }
            mainContent={
                <div className="flex flex-col gap-6">
                    <AdminSanctioningDecision
                        showId={r.show.id}
                        title={r.show.title}
                        requested={r.requested}
                        isMhhQualifying={r.show.isMhhQualifying}
                        note={r.show.sanctioningNote}
                    />

                    {/* What was seen — the admin weighs it. */}
                    <section className="ledger-card" aria-labelledby="review-checks-heading">
                        <span className="ledger-tab" id="review-checks-heading">
                            🔎 What we see
                        </span>
                        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0" data-testid="review-checks">
                            {r.checks.map((c) => (
                                <li key={c.key} className="flex gap-2 text-sm">
                                    <span aria-hidden="true">{LEVEL_GLYPH[c.level]}</span>
                                    <span>
                                        <span className={`font-semibold ${LEVEL_CLASS[c.level]}`}>
                                            {c.label}
                                        </span>{" "}
                                        <span className="text-muted-foreground">{c.detail}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="m-0 mt-3 text-xs text-muted-foreground">
                            {r.entryCount} live {r.entryCount === 1 ? "entry" : "entries"} from{" "}
                            {r.exhibitorCount} {r.exhibitorCount === 1 ? "exhibitor" : "exhibitors"} ·
                            blind browsing {r.blindBrowsing ? "on" : "off"} · created{" "}
                            {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                    </section>

                    {/* The show, as the public page prints it. */}
                    <div className="rounded-2xl border border-dashed border-input p-3">
                        <p className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Show page preview
                        </p>
                        <AlbumMasthead show={r.show} entryCount={r.entryCount} />
                    </div>

                    {(r.show.aboutMd || r.show.rulesMd) && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="ledger-card" aria-labelledby="review-about-heading">
                                <span className="ledger-tab" id="review-about-heading">
                                    About
                                </span>
                                <div className="mt-3">
                                    {r.show.aboutMd ? (
                                        <RichText content={r.show.aboutMd} />
                                    ) : (
                                        <p className="m-0 text-sm text-muted-foreground italic">
                                            Nothing written.
                                        </p>
                                    )}
                                </div>
                            </section>
                            <section className="ledger-card" aria-labelledby="review-rules-heading">
                                <span className="ledger-tab" id="review-rules-heading">
                                    Rules
                                </span>
                                <div className="mt-3">
                                    {r.show.rulesMd ? (
                                        <RichText content={r.show.rulesMd} />
                                    ) : (
                                        <p className="m-0 text-sm text-muted-foreground italic">
                                            Nothing written.
                                        </p>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    <section aria-labelledby="review-program-heading">
                        <h2 id="review-program-heading" className="mt-0 mb-3 text-base font-bold">
                            Classlist
                        </h2>
                        <AdminReviewProgram
                            divisions={r.divisions}
                            showYear={r.show.showYear}
                            showIsQualifying={r.show.isMhhQualifying}
                        />
                    </section>

                    <section className="ledger-card" aria-labelledby="review-staff-heading">
                        <span className="ledger-tab" id="review-staff-heading">
                            Staff
                        </span>
                        {r.staff.length === 0 ? (
                            <p className="m-0 mt-3 text-sm text-muted-foreground italic">
                                No staff beyond the host yet.
                            </p>
                        ) : (
                            <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                                {r.staff.map((s) => (
                                    <li
                                        key={`${s.alias}-${s.role}`}
                                        className="rounded-full border border-input px-3 py-1 text-xs"
                                    >
                                        @{s.alias} · {s.role.replace("_", "-")}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            }
        />
    );
}
