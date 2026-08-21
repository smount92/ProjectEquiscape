"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    getAdminInsights,
    getRevenueInsights,
    type ActivityDay,
    type AdminInsights,
    type RevenueInsights,
    type TopObject,
} from "@/app/actions/admin-insights";
import { ENTITY_LABELS, ENTITY_TYPES, type EntityType } from "@/lib/metrics/entities";

/**
 * Insights — what the site's own data knows that a traffic tool cannot.
 *
 * Vercel Web Analytics answers "how many people hit this URL". These cards
 * answer "which HORSE is getting attention", which is a different question
 * and the only one that turns into a feature a seller can use. The two live
 * side by side deliberately; the link out to Vercel is at the bottom.
 *
 * Every number here is an aggregate over aggregates. There is no drill-down
 * to a person, in this tab or anywhere, because the data to build one is
 * deleted nightly (supabase/migrations/175_object_metrics.sql).
 *
 * Fetches its own data so page.tsx and AdminTabs' prop list stay untouched —
 * same pattern as AdminMembersTab and AdminSanctioningCard.
 */

/** "—" for an unknown, a grouped number for a known. Mirrors AdminPulseStrip. */
function fmt(n: number | null): string {
    return n === null ? "—" : n.toLocaleString();
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
    return (
        <div className="border-input bg-card rounded-lg border px-4 py-3">
            <div className="text-foreground font-serif text-2xl leading-none font-bold tabular-nums">
                {value}
            </div>
            <div className="text-muted-foreground mt-1.5 text-xs font-semibold tracking-wide uppercase">
                {label}
            </div>
            {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
        </div>
    );
}

/** Whole dollars and cents, because MRR at this scale is a two-figure number. */
function money(n: number): string {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The revenue band — the four numbers docs/BUSINESS_MODEL_2026.md opens
 * by saying the schema cannot answer.
 *
 * Self-fetching and separately schema-gated from the rest of this tab:
 * migrations 175 and 176 land independently, so "the view rollups are
 * live" and "the revenue mirror is live" are two different facts and
 * each renders its own "—".
 *
 * Every caveat is ON the card rather than in a doc. An MRR figure that
 * quietly counts six-months-free beta subscribers at list price is worse
 * than no MRR figure, because someone will plan against it.
 */
function RevenueBand() {
    const [data, setData] = useState<RevenueInsights | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await getRevenueInsights();
            if (cancelled) return;
            if (result.success) setData(result.insights);
            else setFailed(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const ready = !!data?.schemaReady;
    const pro = data?.revenue.tiers.find((t) => t.tier === "pro") ?? null;
    const studio = data?.revenue.tiers.find((t) => t.tier === "studio") ?? null;

    return (
        <div>
            <h3 className="mt-0 mb-2 flex flex-wrap items-baseline gap-2 text-base font-bold">
                💰 Revenue &amp; reach
                {!ready && (
                    <span className="text-muted-foreground text-xs font-normal">
                        {failed
                            ? "could not be read this load"
                            : "waiting on migration 176 — paste supabase/migrations/176_revenue_measurability.sql"}
                    </span>
                )}
            </h3>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <Stat
                    value={ready ? money(data!.revenue.mrr) : "—"}
                    label="Net MRR"
                    sub="After Stripe fees · list price, not cash"
                />
                <Stat
                    value={ready ? fmt(pro?.paying ?? 0) : "—"}
                    label="🐴 Pro subscribers"
                    sub="$4.555 net each"
                />
                <Stat
                    value={ready ? fmt(studio?.paying ?? 0) : "—"}
                    label="🎨 Studio subscribers"
                    sub="$9.41 net each"
                />
                <Stat
                    value={ready ? fmt(data!.revenue.atRiskTotal) : "—"}
                    label="Payment failing"
                    sub="Stripe still retrying"
                />
                <Stat
                    value={ready ? fmt(data!.revenue.lapsedTotal) : "—"}
                    label="Lapsed"
                    sub="Paid once, not paying now"
                />
                <Stat
                    value={ready ? fmt(data!.activeMembers) : "—"}
                    label={`${data?.mauDays ?? 30}-day active members`}
                    sub="Exact MAU, not an estimate"
                />
            </div>
            <p className="text-muted-foreground mt-2 mb-0 text-xs">
                MRR is subscriber count × net price — what the subscriptions are worth, not what
                cleared. Beta members redeeming the six-months-free promo code show as active and
                contribute $0 until it expires. Supporters are not counted here at all: it is not a
                tier and its price lives only in Stripe. Active members means &quot;viewed at least
                one tracked page&quot; — a member who only read their dashboard is not in it.
            </p>
        </div>
    );
}

const CHART_W = 720;
const CHART_H = 150;
const PAD = 8;

/**
 * The daily-actives line. Hand-rolled SVG rather than a charting dependency:
 * it is two polylines over at most fourteen points, and the theme tokens do
 * the colour work in both light and dark.
 */
function ActivityChart({ days }: { days: ActivityDay[] }) {
    if (days.length < 2) {
        return (
            <div className="border-input bg-card text-muted-foreground rounded-lg border px-4 py-8 text-center text-sm">
                Not enough days recorded yet — the line appears once there are two.
            </div>
        );
    }

    const peak = Math.max(1, ...days.map((d) => Math.max(d.memberDau, d.anonDau)));
    const stepX = (CHART_W - PAD * 2) / (days.length - 1);
    const toPoints = (pick: (d: ActivityDay) => number) =>
        days
            .map((d, i) => {
                const x = PAD + i * stepX;
                const y = CHART_H - PAD - (pick(d) / peak) * (CHART_H - PAD * 2);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");

    const first = days[0]?.day ?? "";
    const last = days[days.length - 1]?.day ?? "";

    return (
        <div className="border-input bg-card rounded-lg border px-4 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Daily active viewers
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-forest flex items-center gap-1">
                        <span className="bg-forest inline-block h-0.5 w-4" aria-hidden="true" />
                        Members
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                        <span
                            className="bg-muted-foreground inline-block h-0.5 w-4 opacity-60"
                            aria-hidden="true"
                        />
                        Signed out
                    </span>
                </div>
            </div>

            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="h-auto w-full overflow-visible"
                role="img"
                aria-label={`Daily active viewers from ${first} to ${last}, peak ${peak}`}
            >
                <polyline
                    points={toPoints((d) => d.anonDau)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="text-muted-foreground opacity-50"
                />
                <polyline
                    points={toPoints((d) => d.memberDau)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="text-forest"
                />
            </svg>

            <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
                <span>{first}</span>
                <span>peak {fmt(peak)}</span>
                <span>{last}</span>
            </div>
        </div>
    );
}

function TopList({ type, rows }: { type: EntityType; rows: TopObject[] }) {
    const label = ENTITY_LABELS[type];
    return (
        <div>
            <h3 className="mt-0 mb-1 flex items-center gap-2 text-base font-bold">
                {label.emoji} Most-viewed {label.many.toLowerCase()}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {rows.map((r) => (
                    <li
                        key={`${r.entityType}:${r.entityId}`}
                        className="border-input bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5"
                    >
                        <span className="min-w-0 truncate text-sm">
                            {r.href ? (
                                <Link href={r.href} className="hover:underline">
                                    {r.name}
                                </Link>
                            ) : (
                                r.name
                            )}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            <strong className="text-foreground">{fmt(r.views)}</strong> views ·{" "}
                            {fmt(r.uniques)} viewers
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function AdminInsightsTab() {
    const [insights, setInsights] = useState<AdminInsights | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await getAdminInsights();
            if (cancelled) return;
            if (result.success) setInsights(result.insights);
            else setError(result.error);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const vercelLink = (
        <p className="text-muted-foreground mt-2 mb-0 text-xs">
            Page-level traffic, referrers and countries live in{" "}
            <a
                href="https://vercel.com/dashboard/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
            >
                Vercel Analytics →
            </a>{" "}
            — these cards are the first-party half: which objects got the attention.
        </p>
    );

    if (loading) {
        return (
            <div className="border-input bg-card text-muted-foreground rounded-lg border px-4 py-3 text-sm">
                Reading the rollups…
            </div>
        );
    }

    if (error || !insights) {
        return (
            <div className="flex flex-col gap-6">
                {/* The revenue reader is independent of the view rollups —
                    one failing says nothing about the other. */}
                <RevenueBand />
                <div className="border-input bg-card rounded-lg border px-8 py-12 text-center">
                    <div className="mb-3 text-4xl">📈</div>
                    <h2 className="m-0 text-base font-bold">Insights unavailable</h2>
                    <p className="text-muted-foreground m-0 mt-1 text-sm">
                        {error ?? "The rollups could not be read this load."} Nothing is broken by
                        this — it is a read-only view.
                    </p>
                    {vercelLink}
                </div>
            </div>
        );
    }

    if (!insights.schemaReady) {
        return (
            <div className="flex flex-col gap-6">
                <RevenueBand />
                <div className="border-input bg-card rounded-lg border px-8 py-12 text-center">
                    <div className="mb-3 text-4xl">📈</div>
                    <h2 className="m-0 text-base font-bold">Waiting on migration 175</h2>
                    <p className="text-muted-foreground m-0 mt-1 text-sm">
                        The view beacon is live in the app but has nowhere to write yet. Paste{" "}
                        <code>supabase/migrations/175_object_metrics.sql</code> and numbers start
                        accumulating from that moment — there is no backfill, because nothing was
                        recorded before it.
                    </p>
                </div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                    <Stat value="—" label="Members today" />
                    <Stat value="—" label="Signed out today" />
                    <Stat value="—" label="Views today" />
                    <Stat value="—" label="7-day views" />
                </div>
                {vercelLink}
            </div>
        );
    }

    const today = insights.activity[insights.activity.length - 1] ?? null;
    const window7 = insights.activity.slice(-7);
    const memberDays = window7.reduce((sum, d) => sum + d.memberDau, 0);
    const weekViews = insights.totals.reduce((sum, t) => sum + t.views, 0);

    const byType = new Map<EntityType, TopObject[]>();
    for (const row of insights.top) {
        byType.set(row.entityType, [...(byType.get(row.entityType) ?? []), row]);
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Band 0 — what the place earns, and who is actually here */}
            <RevenueBand />

            {/* Band 1 — how busy is the place */}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <Stat value={fmt(today?.memberDau ?? 0)} label="Members today" sub="UTC day" />
                <Stat
                    value={fmt(today?.anonDau ?? 0)}
                    label="Signed out today"
                    sub="IP + agent, best effort"
                />
                <Stat value={fmt(today?.views ?? 0)} label="Views today" sub="Tracked page loads" />
                <Stat
                    value={fmt(memberDays)}
                    label="7-day member-days"
                    sub="Sum of daily actives, not unique people"
                />
                <Stat
                    value={fmt(weekViews)}
                    label={`${insights.windowDays}-day object views`}
                    sub="A for-sale horse counts as horse and listing"
                />
            </div>

            <ActivityChart days={insights.activity} />

            {/* Band 2 — where the attention went */}
            <div>
                <h3 className="mt-0 mb-2 text-base font-bold">
                    Last {insights.windowDays} days by object type
                </h3>
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
                    {ENTITY_TYPES.map((type) => {
                        const row = insights.totals.find((t) => t.entityType === type);
                        return (
                            <Stat
                                key={type}
                                value={fmt(row?.views ?? 0)}
                                label={`${ENTITY_LABELS[type].emoji} ${ENTITY_LABELS[type].many}`}
                                sub={`${fmt(row?.uniques ?? 0)} viewers`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Band 3 — the leaderboards */}
            {insights.top.length === 0 ? (
                <div className="border-input bg-card text-muted-foreground rounded-lg border px-4 py-8 text-center text-sm">
                    Nothing viewed in the last {insights.windowDays} days yet.
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {ENTITY_TYPES.filter((t) => (byType.get(t)?.length ?? 0) > 0).map((type) => (
                        <TopList key={type} type={type} rows={byType.get(type) ?? []} />
                    ))}
                </div>
            )}

            <div>
                <p className="text-muted-foreground m-0 text-xs">
                    Counted per object, never per person: the daily dedupe token is a salted hash
                    that the nightly cleanup deletes, so there is no record of who viewed what to
                    query — here or anywhere.
                </p>
                {vercelLink}
            </div>
        </div>
    );
}
