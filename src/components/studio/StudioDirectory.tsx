"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DirectoryEntry } from "@/app/actions/art-studio";
import { Input } from "@/components/ui/input";
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
export default function StudioDirectory({ studios }: { studios: DirectoryEntry[] }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<"all" | "open" | "waitlist" | "closed">("all");
    const [service, setService] = useState("all");

    const allServices = useMemo(() => {
        const set = new Set<string>();
        for (const studio of studios) {
            for (const type of serviceTypesOffered(studio.services)) set.add(type);
            for (const specialty of studio.specialties) set.add(specialty);
        }
        return [...set].sort();
    }, [studios]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return studios.filter((studio) => {
            if (status !== "all" && studio.effectiveStatus !== status) return false;

            if (service !== "all") {
                const offers =
                    studio.services.some((s) => s.open && s.type === service) ||
                    studio.specialties.includes(service);
                if (!offers) return false;
            }

            if (!q) return true;
            return (
                studio.studioName.toLowerCase().includes(q) ||
                studio.ownerAlias.toLowerCase().includes(q) ||
                studio.specialties.some((s) => s.toLowerCase().includes(q)) ||
                studio.services.some((s) => s.type.toLowerCase().includes(q)) ||
                studio.mediums.some((m) => m.toLowerCase().includes(q))
            );
        });
    }, [studios, search, status, service]);

    const openCount = studios.filter((s) => s.effectiveStatus === "open").length;

    return (
        <div>
            <div className="bg-card border-input sticky top-[calc(var(--header-height)+0.75rem)] z-10 mb-6 rounded-xl border p-4 shadow-md backdrop-blur-sm">
                <Input
                    type="search"
                    placeholder="Search studios by name, artist, service or medium…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search studios"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap gap-1.5">
                        {(
                            [
                                ["all", `All (${studios.length})`],
                                ["open", `Open (${openCount})`],
                                ["waitlist", "Waitlist"],
                                ["closed", "Closed"],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStatus(key)}
                                className={`studio-chip ${status === key ? "active" : ""}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {allServices.length > 0 && (
                        <select
                            className="border-input bg-card ring-offset-background focus:ring-ring flex h-10 max-w-[240px] rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            aria-label="Filter by service type"
                        >
                            <option value="all">Any service</option>
                            {allServices.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
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
            </div>

            <StudioStatusPill status={studio.effectiveStatus} className="mb-3" />

            <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>@{studio.ownerAlias}</span>
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
