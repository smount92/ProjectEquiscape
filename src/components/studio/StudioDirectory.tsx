"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DirectoryEntry } from "@/app/actions/art-studio";
import { Input } from "@/components/ui/input";
import { canonicalFacets, sameFacet } from "@/lib/studio/facets";
import { serviceTypesOffered } from "@/lib/studio/services";
import { Chip, StudioStatusPill } from "./StudioBits";

/**
 * The studio directory.
 *
 * Ordering is done on the server: open studios first, then by how much
 * finished work each has on the platform. A directory that leads with
 * studios who cannot take work is a list nobody scrolls, and one that
 * leads with whoever edited their profile most recently rewards fiddling
 * rather than craft.
 */
type SortKey = "open" | "finished" | "name" | "newest";
type Status = "all" | "open" | "waitlist" | "closed";

const SORTS: { key: SortKey; label: string }[] = [
    { key: "open", label: "Open first" },
    { key: "finished", label: "Most finished work" },
    { key: "newest", label: "Newest studios" },
    { key: "name", label: "A to Z" },
];

export default function StudioDirectory({ studios, initialQuery = "" }: { studios: DirectoryEntry[]; initialQuery?: string }) {
    const [search, setSearch] = useState(initialQuery);
    const [status, setStatus] = useState<Status>("all");
    const [service, setService] = useState("all");
    const [scale, setScale] = useState("all");
    const [sort, setSort] = useState<SortKey>("open");

    // Specialties were free text before the pick-list, so stored values
    // carry spelling variants of one idea; fold them (lib/studio/facets).
    const allServices = useMemo(() => {
        const raw: string[] = [];
        for (const studio of studios) {
            raw.push(...serviceTypesOffered(studio.services), ...studio.specialties);
        }
        return canonicalFacets(raw).sort((a, b) => a.localeCompare(b));
    }, [studios]);
    const allScales = useMemo(() => canonicalFacets(studios.flatMap((s) => s.scalesOffered)), [studios]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const hit = (v: string | null | undefined) => !!v && v.toLowerCase().includes(q);
        const list = studios.filter((studio) => {
            if (status !== "all" && studio.effectiveStatus !== status) return false;

            if (service !== "all") {
                const offers =
                    studio.services.some((s) => s.open && sameFacet(s.type, service)) ||
                    studio.specialties.some((s) => sameFacet(s, service));
                if (!offers) return false;
            }
            if (scale !== "all" && !studio.scalesOffered.some((s) => sameFacet(s, scale))) return false;

            if (!q) return true;
            // Everything the artist wrote about themselves is searchable,
            // not just the name: "restoration", "traditional", "resin",
            // "vintage customs" all find the right bench.
            return (
                hit(studio.studioName) ||
                hit(studio.ownerAlias) ||
                hit(studio.bioArtist) ||
                hit(studio.region) ||
                hit(studio.statusNote) ||
                studio.specialties.some(hit) ||
                studio.services.some((s) => hit(s.type)) ||
                studio.mediums.some(hit) ||
                studio.scalesOffered.some(hit) ||
                studio.acceptingTypes.some(hit)
            );
        });
        const byName = (a: DirectoryEntry, b: DirectoryEntry) => a.studioName.localeCompare(b.studioName);
        switch (sort) {
            case "finished":
                return [...list].sort((a, b) => b.finishedCount - a.finishedCount || byName(a, b));
            case "name":
                return [...list].sort(byName);
            case "newest":
                return [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || byName(a, b));
            default:
                return list; // the server order: open first, then by finished work
        }
    }, [studios, search, status, service, scale, sort]);

    const openCount = studios.filter((s) => s.effectiveStatus === "open").length;
    const filtering = search.trim() !== "" || status !== "all" || service !== "all" || scale !== "all";
    const clear = () => {
        setSearch("");
        setStatus("all");
        setService("all");
        setScale("all");
    };

    // Four small dropdowns instead of three rows of chips: the chip bar
    // was 300px tall on a phone and, sticky under the header, left almost
    // no room for the studios it was filtering (owner, 2026-09-20).
    const pick = (
        label: string,
        value: string,
        onChange: (v: string) => void,
        options: readonly (readonly [string, string])[],
    ) => (
        <label className="text-secondary-foreground flex min-w-0 flex-col gap-1 text-[0.65rem] font-semibold tracking-wider uppercase">
            {label}
            <select
                className="border-input bg-card text-foreground h-9 w-full rounded-md border px-2 text-sm font-normal tracking-normal normal-case"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
            >
                {options.map(([v, l]) => (
                    <option key={v} value={v}>
                        {l}
                    </option>
                ))}
            </select>
        </label>
    );

    return (
        <div>
            <div className="bg-card border-input z-10 mb-6 rounded-xl border p-3 shadow-md backdrop-blur-sm md:sticky md:top-[calc(var(--header-height)+0.75rem)] md:p-4">
                <Input
                    type="search"
                    placeholder="Search by studio, artist, service, medium, scale or place…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search studios"
                />

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:mt-3">
                    {pick("Availability", status, (v) => setStatus(v as Status), [
                        ["all", `All (${studios.length})`],
                        ["open", `Open (${openCount})`],
                        ["waitlist", "Waitlist"],
                        ["closed", "Closed"],
                    ])}
                    {allServices.length > 0 &&
                        pick("Need", service, setService, [["all", "Anything"], ...allServices.map((x) => [x, x] as const)])}
                    {allScales.length > 1 &&
                        pick("Scale", scale, setScale, [["all", "Any scale"], ...allScales.map((x) => [x, x] as const)])}
                    {pick("Sort", sort, (v) => setSort(v as SortKey), SORTS.map((o) => [o.key, o.label] as const))}
                </div>

                <p className="text-secondary-foreground m-0 mt-2 text-xs md:mt-3" aria-live="polite">
                    {filtered.length} of {studios.length} studio{studios.length === 1 ? "" : "s"}
                    {openCount > 0 && ` · ${openCount} open for commissions`}
                    {filtering && (
                        <>
                            {" · "}
                            <button type="button" onClick={clear} className="text-forest cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold hover:underline">
                                Clear filters
                            </button>
                        </>
                    )}
                </p>
            </div>

            {filtered.length === 0 ? (
                <div className="border-input bg-card rounded-lg border p-12 text-center shadow-md">
                    <div className="mb-4 text-[3rem]">🎨</div>
                    <h3 className="mb-2 font-serif text-xl font-bold">
                        {studios.length === 0
                            ? "No studios yet"
                            : "No studios match those filters"}
                    </h3>
                    <p className="text-secondary-foreground mx-auto max-w-[440px] text-sm">
                        {studios.length === 0
                            ? "The directory fills up as customizers and finishwork artists open studios. If you take commissions, yours can be the first."
                            : "Try clearing a filter — plenty of artists keep a waitlist even when their bench is full."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((studio) => (
                        <StudioCard key={studio.userId} studio={studio} />
                    ))}
                </div>
            )}
        </div>
    );
}

function StudioCard({ studio }: { studio: DirectoryEntry }) {
    const services = studio.services.filter((s) => s.open).slice(0, 3);

    return (
        <Link
            href={`/studio/${studio.studioSlug}`}
            className="border-input bg-card block rounded-lg border p-5 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <span className="font-serif text-base font-bold">{studio.studioName}</span>
                {studio.ownerAvatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={studio.ownerAvatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="border-input h-9 w-9 shrink-0 rounded-full border object-cover"
                        loading="lazy"
                    />
                )}
            </div>

            <StudioStatusPill status={studio.effectiveStatus} className="mb-3" />

            <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>@{studio.ownerAlias}</span>
                {studio.region && <span>📍 {studio.region}</span>}
                {studio.priceLabel !== "Ask" && <span>{studio.priceLabel}</span>}
                {studio.effectiveStatus !== "closed" && <span>{studio.slotLabel}</span>}
            </div>

            {/* Proof of work is the thing worth showing on a browse card. */}
            {studio.finishedCount > 0 && (
                <div className="border-success/30 bg-success/10 text-success mb-3 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                    {studio.finishedCount} finished horse
                    {studio.finishedCount === 1 ? "" : "s"} on Model Horse Hub
                </div>
            )}

            {services.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => (
                        <Chip key={s.id}>{s.type}</Chip>
                    ))}
                </div>
            )}
        </Link>
    );
}
