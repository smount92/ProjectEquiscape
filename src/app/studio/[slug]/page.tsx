import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
    getArtistPortfolio,
    getArtistProfileBySlug,
    getSlotUsage,
} from "@/app/actions/art-studio";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import ViewBeacon from "@/components/metrics/ViewBeacon";
import ShareButton from "@/components/ShareButton";
import ReceiptsWall from "@/components/studio/ReceiptsWall";
import {
    Chip,
    EmptyNote,
    LedgerRow,
    OffPlatformNote,
    Panel,
    SlotMeter,
    StudioStatusPill,
    TermsList,
} from "@/components/studio/StudioBits";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { intakeFor, slotState } from "@/lib/studio/pipeline";
import { priceRangeLabel, serviceLabel } from "@/lib/studio/services";
import { turnaroundLabel } from "@/lib/studio/terms";

/**
 * The artist's page — the portfolio that PROVES the work.
 *
 * This is the one URL an artist pastes into a Facebook group, so unlike v1
 * it is readable WITHOUT an account (migration 170 opens artist_profiles to
 * anon for studios that opted into portfolio_visible). v1 redirected to
 * /login, which made the page useless for the only job it has.
 *
 * Order is deliberate: status and slots first (can I even commission them),
 * then the receipts wall (are they any good), then the rate card and terms
 * (what will it cost and what am I agreeing to). v1 led with a specialty
 * chip list and showed no work at all.
 */

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const profile = await getArtistProfileBySlug(slug);
    if (!profile) return { title: "Studio not found" };

    const specialties = profile.specialties.slice(0, 3).join(", ");
    const title = `${profile.studioName} — Model Horse Commissions`;
    const description =
        profile.bioArtist?.slice(0, 155) ||
        `${profile.studioName}: ${specialties || "model horse commissions"} by @${profile.ownerAlias}. Commission status, rates, terms, and finished work with verified show records.`;

    // The share card: the storefront gets pasted into Facebook groups,
    // and an unfurl with a finished horse on it earns the click a text
    // stub never will. Hero = the newest work on the wall.
    const wall = await getArtistPortfolio(profile.userId, profile.ownerAlias);
    const heroImage = wall.find((w) => w.imageUrls.length > 0)?.imageUrls[0] ?? null;

    return {
        title,
        description,
        alternates: { canonical: `/studio/${profile.studioSlug}` },
        openGraph: {
            title: profile.studioName,
            description,
            images: heroImage ? [{ url: heroImage, width: 800, height: 600, alt: profile.studioName }] : [],
            type: "profile" as const,
            siteName: "Model Horse Hub",
        },
        twitter: {
            card: (heroImage ? "summary_large_image" : "summary") as "summary_large_image" | "summary",
            title: profile.studioName,
            description,
            images: heroImage ? [heroImage] : [],
        },
    };
}

export default async function StudioPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const profile = await getArtistProfileBySlug(slug);
    if (!profile) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const isOwner = user?.id === profile.userId;

    if (!profile.portfolioVisible && !isOwner) notFound();

    const [slotsUsed, portfolio] = await Promise.all([
        getSlotUsage(profile.userId),
        getArtistPortfolio(profile.userId, profile.ownerAlias),
    ]);

    const slots = slotState(slotsUsed, profile.maxSlots, profile.status);
    const intake = intakeFor(slots, profile.waitlistOpen);
    const openServices = profile.services.filter((s) => s.open);

    // ── The identity joins: Registry artist page + the studio's barn ──
    // Both tolerant — the artists table is 200, barn_group_id is 203.
    let registryLink: { slug: string; name: string } | null = null;
    try {
        const { data: artistRow } = await (supabase as unknown as {
            from: (t: string) => {
                select: (c: string) => {
                    or: (f: string) => {
                        limit: (n: number) => PromiseLike<{ data: Record<string, unknown>[] | null }>;
                    };
                };
            };
        })
            .from("artists")
            .select("slug, name, verified_user_id")
            .or(`verified_user_id.eq.${profile.userId},name.eq.${profile.ownerAlias.replace(/,/g, "")}`)
            .limit(1);
        const a = artistRow?.[0];
        if (a?.slug) registryLink = { slug: String(a.slug), name: String(a.name) };
    } catch {
        // pre-200 — no registry join to offer
    }

    let barn: { slug: string; name: string; memberCount: number } | null = null;
    if (profile.barnGroupId) {
        const { data: g } = await supabase
            .from("groups")
            .select("slug, name, member_count")
            .eq("id", profile.barnGroupId)
            .maybeSingle();
        if (g?.slug) {
            barn = {
                slug: String(g.slug),
                name: String(g.name ?? "The barn"),
                memberCount: typeof g.member_count === "number" ? g.member_count : 0,
            };
        }
    }

    // The stat strip: computed from the wall, never typed in.
    const workYears = portfolio
        .map((h) => (h.dateCompleted ? Number(h.dateCompleted.slice(0, 4)) : NaN))
        .filter((y) => !isNaN(y));
    const estYear = profile.createdAt ? Number(profile.createdAt.slice(0, 4)) : null;
    const sinceYear = workYears.length ? Math.min(...workYears, estYear ?? Infinity) : estYear;
    const titlesWon = portfolio.reduce((n, h) => n + h.titles.length, 0);

    return (
        <ExplorerLayout noHeader>
            <ViewBeacon entityType="studio" entityId={profile.userId} />
            <PageMasthead
                icon="🎨"
                title={profile.studioName}
                subtitle={`The studio of @${profile.ownerAlias}${sinceYear ? ` · since ${sinceYear}` : ""}`}
                backHref="/studio"
                backLabel="All studios"
                actions={
                    <ShareButton
                        title={profile.studioName}
                        text={`${profile.studioName} — model horse commissions on Model Horse Hub`}
                        label="Share"
                        variant="full"
                    />
                }
            />

            {/* ── The decision bar: can I commission them, and how do I start ── */}
            <div className="border-input bg-card mb-6 rounded-lg border p-6 shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-[240px] flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <StudioStatusPill status={slots.effectiveStatus} />
                            {slots.effectiveStatus === "waitlist" && slots.full && (
                                <span className="text-muted-foreground text-xs">
                                    bench is full
                                </span>
                            )}
                        </div>

                        {profile.statusNote && (
                            <p className="text-secondary-foreground mb-3 text-sm">
                                {profile.statusNote}
                            </p>
                        )}

                        {profile.bioArtist && (
                            <p className="text-secondary-foreground max-w-[60ch] text-sm leading-relaxed">
                                {profile.bioArtist}
                            </p>
                        )}

                        {profile.specialties.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {profile.specialties.map((s) => (
                                    <Chip key={s}>{s}</Chip>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="min-w-[200px]">
                        <SlotMeter used={slots.used} max={slots.max} label={slots.label} />

                        <div className="mt-4 flex flex-col gap-2">
                            {isOwner ? (
                                <>
                                    <Button asChild size="wide">
                                        <Link href="/studio/dashboard">Open your dashboard</Link>
                                    </Button>
                                    <Button asChild variant="outline" size="wide">
                                        <Link href="/studio/setup">Edit this studio</Link>
                                    </Button>
                                </>
                            ) : intake.accepting ? (
                                <>
                                    <Button asChild size="wide">
                                        <Link href={`/studio/${profile.studioSlug}/request`}>
                                            {intake.asWaitlist
                                                ? "Join the waitlist"
                                                : "Request a commission"}
                                        </Link>
                                    </Button>
                                    <span className="text-muted-foreground text-xs">
                                        {intake.reason}
                                    </span>
                                </>
                            ) : (
                                <div className="border-input bg-muted rounded-md border px-4 py-3">
                                    <p className="text-muted-foreground m-0 text-xs leading-relaxed">
                                        {intake.reason} Follow @{profile.ownerAlias} to hear when
                                        slots open.
                                    </p>
                                </div>
                            )}
                            <Link
                                href={`/profile/${encodeURIComponent(profile.ownerAlias)}`}
                                className="text-muted-foreground text-center text-xs hover:underline"
                            >
                                @{profile.ownerAlias}&rsquo;s profile →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── The stat strip: computed from the wall, never typed in ── */}
            {portfolio.length > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        [String(portfolio.length), "Works documented"],
                        ...(titlesWon > 0 ? [[String(titlesWon), "Titles won by works"]] : []),
                        ...(sinceYear ? [[String(sinceYear), "Working since"]] : []),
                        [turnaroundLabel(profile.terms), "Turnaround"],
                    ].map(([n, label]) => (
                        <div key={label} className="border-input bg-card rounded-lg border px-4 py-3 shadow-sm">
                            <div className="text-foreground font-serif text-xl font-bold tabular-nums">{n}</div>
                            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── The works: what they've actually finished ── */}
            <div className="mb-6">
                <ReceiptsWall
                    horses={portfolio}
                    studioName={profile.studioName}
                    isOwner={isOwner}
                />
            </div>

            {/* ── The joins: this studio elsewhere on the Hub ── */}
            {(registryLink || barn) && (
                <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    {registryLink && (
                        <Panel title="In the Registry" icon="📖">
                            <p className="text-secondary-foreground m-0 text-sm leading-relaxed">
                                <Link
                                    href={`/reference/${registryLink.slug}`}
                                    className="text-forest font-semibold hover:underline"
                                >
                                    {registryLink.name} in the Registry →
                                </Link>{" "}
                                — the career timeline, and every documented work on its
                                mold&rsquo;s reference page.
                            </p>
                        </Panel>
                    )}
                    {barn && (
                        <Panel title="The barn" icon="🏠">
                            <p className="text-secondary-foreground m-0 text-sm leading-relaxed">
                                <Link
                                    href={`/community/barns/${barn.slug}`}
                                    className="text-forest font-semibold hover:underline"
                                >
                                    {barn.name} →
                                </Link>{" "}
                                — {barn.memberCount} member{barn.memberCount === 1 ? "" : "s"}.
                                The studio&rsquo;s community room: follow along between
                                commissions.
                            </p>
                        </Panel>
                    )}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ── The rate card ── */}
                <Panel
                    title="Services & rates"
                    icon="🧾"
                    actions={
                        profile.priceLabel !== "Ask" ? (
                            <span className="text-muted-foreground text-xs">
                                {profile.priceLabel}
                            </span>
                        ) : null
                    }
                >
                    {openServices.length === 0 ? (
                        <EmptyNote>
                            {isOwner
                                ? "You haven't listed any services yet. Add them in your studio settings so commissioners know what you offer and roughly what it costs."
                                : "This studio hasn't published a rate card. Ask when you send a request."}
                        </EmptyNote>
                    ) : (
                        <div className="grid">
                            {openServices.map((service) => (
                                <LedgerRow
                                    key={service.id}
                                    label={
                                        <>
                                            {serviceLabel(service)}
                                            {service.note && (
                                                <span className="text-muted-foreground block text-xs">
                                                    {service.note}
                                                </span>
                                            )}
                                        </>
                                    }
                                    value={priceRangeLabel(service.priceMin, service.priceMax)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mt-4 grid">
                        <LedgerRow
                            label="Turnaround"
                            value={turnaroundLabel(profile.terms)}
                        />
                        {profile.mediums.length > 0 && (
                            <LedgerRow
                                label="Mediums"
                                value={profile.mediums.join(", ")}
                            />
                        )}
                        {profile.scalesOffered.length > 0 && (
                            <LedgerRow
                                label="Scales"
                                value={profile.scalesOffered.join(", ")}
                            />
                        )}
                    </div>

                    <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                        Ranges are a starting point. Coat complexity — pintos, appaloosa spots,
                        dapples, roaning — and prep work move the final quote, which the artist
                        sends after seeing your references.
                    </p>
                </Panel>

                {/* ── The terms, structured ── */}
                <Panel title="Commission terms" icon="📜">
                    <TermsList terms={profile.terms} />
                    <div className="border-input mt-4 border-t pt-4">
                        <OffPlatformNote />
                    </div>
                </Panel>
            </div>

            {/* ── The queue, when the artist publishes it ── */}
            {profile.acceptingTypes.length > 0 && (
                <div className="mt-6">
                    <Panel title="Currently accepting" icon="✅">
                        <div className="flex flex-wrap gap-1.5">
                            {profile.acceptingTypes.map((t) => (
                                <Chip key={t}>{t}</Chip>
                            ))}
                        </div>
                    </Panel>
                </div>
            )}

            {!user && (
                <div className="border-input bg-card/60 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6 backdrop-blur-sm">
                    <div>
                        <h3 className="font-serif text-lg font-bold">
                            Commission {profile.studioName}
                        </h3>
                        <p className="text-secondary-foreground text-sm">
                            A free account lets you send a request, agree terms in writing, and
                            follow the work in progress.
                        </p>
                    </div>
                    <Button asChild size="wide">
                        <Link href={`/signup?redirectTo=%2Fstudio%2F${profile.studioSlug}`}>
                            Create a free account
                        </Link>
                    </Button>
                </div>
            )}

        </ExplorerLayout>
    );
}
