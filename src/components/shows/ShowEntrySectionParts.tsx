"use client";

/**
 * Wave 4b — ShowEntrySection's two reusable blocks, extracted
 * VERBATIM so the legacy public page and the album page render the
 * exact same markup from one implementation:
 *
 *   - MyEntriesCard: the authed viewer's entries table (scratch /
 *     re-enter / result stamps). State stays with the caller — this
 *     is the render + callbacks only.
 *   - PublicClassRow: one classlist row (number, name, status
 *     stamp, rule badges, entry count, Enter button). Used by the
 *     legacy flat classlist, the album's program accordion, AND the
 *     album CTA's "Pick your class" dialog.
 *
 * Do not restyle here without checking both layouts — flag-off
 * parity is test-asserted against this markup.
 */

import Link from "next/link";

import type { ConsoleClass } from "@/lib/shows/console";
import type { MyShowEntry } from "@/lib/shows/public";
import { cardGateFor } from "@/lib/shows/cardIssuance";
import { friendlyClassStatus, friendlyEntryStatus } from "@/lib/shows/plainWords";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export function classLabel(cls: { classNumber: string | null; name: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
}

// ── My Entries ──

interface MyEntriesCardProps {
    myEntries: MyShowEntry[];
    classById: Map<string, ConsoleClass>;
    entriesOpen: boolean;
    scratching: boolean;
    /** A scratched entry can re-enter only while no LIVE entry exists
     *  for the same class+horse (the server enforces this too). */
    hasLiveEntry: (classId: string, horseId: string) => boolean;
    onScratch: (entry: MyShowEntry) => void;
    onReenter: (cls: ConsoleClass) => void;
}

export function MyEntriesCard({
    myEntries,
    classById,
    entriesOpen,
    scratching,
    hasLiveEntry,
    onScratch,
    onReenter,
}: MyEntriesCardProps) {
    // Result stamps arrive with the completed transition (Phase E1).
    const hasResults = myEntries.some((e) => e.place !== null);
    return (
        <section className="ledger-card" aria-labelledby="my-entries-heading">
            <span className="ledger-tab" id="my-entries-heading">
                My Entries
            </span>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Horse</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Handler</TableHead>
                        <TableHead>Status</TableHead>
                        {hasResults && <TableHead>Result</TableHead>}
                        {entriesOpen && <TableHead />}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {myEntries.map((entry) => {
                        const cls = classById.get(entry.classId);
                        const scratched = entry.status === "scratched";
                        return (
                            <TableRow key={entry.id}>
                                <TableCell>{entry.entryNumber ?? "—"}</TableCell>
                                <TableCell>
                                    <Link
                                        href={`/community/${entry.horseId}`}
                                        className={scratched ? "line-through" : ""}
                                    >
                                        {entry.horseName}
                                    </Link>
                                </TableCell>
                                <TableCell>{cls ? classLabel(cls) : "—"}</TableCell>
                                <TableCell>
                                    {entry.handlerAlias ? (
                                        <span>
                                            shown by{" "}
                                            <Link
                                                href={`/profile/${encodeURIComponent(entry.handlerAlias)}`}
                                            >
                                                @{entry.handlerAlias}
                                            </Link>{" "}
                                            <span className="text-xs text-muted-foreground">
                                                (proxy)
                                            </span>
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className={`stamp ${scratched ? "stamp-red" : ""}`}>
                                        {friendlyEntryStatus(entry.status)}
                                    </span>
                                </TableCell>
                                {hasResults && (
                                    <TableCell>
                                        {entry.place !== null ? (
                                            <span
                                                className="stamp inline-flex items-center gap-1.5"
                                                data-testid="result-stamp"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                                                    style={{
                                                        backgroundColor:
                                                            ribbonHex(entry.place) ??
                                                            undefined,
                                                    }}
                                                />
                                                {placeLabel(entry.place)}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                )}
                                {entriesOpen && (
                                    <TableCell className="text-right">
                                        {!scratched && entry.status === "entered" && (
                                            <Button
                                                variant="destructive-outline"
                                                size="sm"
                                                disabled={scratching}
                                                onClick={() => onScratch(entry)}
                                                aria-label={`Scratch ${entry.horseName}`}
                                            >
                                                Scratch
                                            </Button>
                                        )}
                                        {scratched &&
                                            cls &&
                                            cls.status === "scheduled" &&
                                            !hasLiveEntry(entry.classId, entry.horseId) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onReenter(cls)}
                                                >
                                                    Re-enter
                                                </Button>
                                            )}
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            {entriesOpen && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Scratching keeps the entry on the record; re-entering afterwards
                    creates a fresh entry.
                </p>
            )}
        </section>
    );
}

// ── One classlist row ──

interface PublicClassRowProps {
    cls: ConsoleClass;
    /** Caller pre-multiplies authed + entries_open + horses>0; the
     *  per-class `scheduled` gate stays here with the row. */
    canEnter: boolean;
    onEnter: (cls: ConsoleClass) => void;
    /** v4: when set, an inline "Class room →" link renders in the row. */
    classRoomHref?: string;
    /** The show's season — picks the card gate in force (Season 1
     *  vs permanent). Omitted = Season 1 gate. */
    showYear?: number | null;
    /**
     * Whether the SHOW is MHH-sanctioned. A class can be marked
     * qualifying in the classlist while the show it belongs to is not
     * sanctioned — a host requests sanctioning and MHH grants it, so
     * every show sits un-granted for a while. Card issuance stops dead
     * on the show flag (cardIssuance.ts), so without this the class row
     * promises "cards for 1st & 2nd" on a show that will mint none.
     * Omitted = assume sanctioned, preserving existing callers.
     */
    showIsQualifying?: boolean;
}

/**
 * The card-gate badge (season-felt wave): a qualifying class SAYS
 * whether it's minting. "1 more exhibitor mints cards" turns an
 * entrant into a recruiter — the program's best growth mechanic.
 * Uses the Season 1 gate until show pages carry show_year.
 */
function QualifyingGateBadge({ cls, showYear }: { cls: ConsoleClass; showYear?: number | null }) {
    const gate = cardGateFor(showYear ?? null);
    const entriesShort = Math.max(0, gate.entries - cls.entryCount);
    const exhibitorsShort = Math.max(0, gate.exhibitors - cls.exhibitorCount);
    if (cls.entryCount === 0) {
        return <Badge variant="outline">🎖️ qualifying — cards for 1st &amp; 2nd</Badge>;
    }
    if (entriesShort === 0 && exhibitorsShort === 0) {
        return <Badge variant="outline">🎖️ minting cards</Badge>;
    }
    const needs: string[] = [];
    if (entriesShort > 0) needs.push(`${entriesShort} more entr${entriesShort === 1 ? "y" : "ies"}`);
    if (exhibitorsShort > 0)
        needs.push(`${exhibitorsShort} more exhibitor${exhibitorsShort === 1 ? "" : "s"}`);
    return (
        <Badge variant="outline" title="Qualification cards mint when the class has real competition">
            🎖️ {needs.join(" & ")} mints cards
        </Badge>
    );
}

export function PublicClassRow({
    cls,
    canEnter,
    onEnter,
    classRoomHref,
    showYear,
    showIsQualifying = true,
}: PublicClassRowProps) {
    const cancelled = cls.status === "cancelled";
    const combined = cls.status === "combined";
    return (
        <li
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 ${cancelled || combined ? "opacity-60" : ""}`}
            data-testid="public-class-row"
        >
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {cls.classNumber ?? "—"}
            </span>
            <span
                className={`text-sm font-medium text-foreground ${cancelled ? "line-through" : ""}`}
            >
                {cls.name}
            </span>
            {cls.status !== "scheduled" && (
                <span className={`stamp ${cancelled ? "stamp-red" : ""}`}>
                    {friendlyClassStatus(cls.status)}
                </span>
            )}
            {cls.isQualifying && showIsQualifying && (
                <QualifyingGateBadge cls={cls} showYear={showYear} />
            )}
            {cls.maxPerEntrant !== null && (
                <Badge variant="secondary">max {cls.maxPerEntrant}/entrant</Badge>
            )}
            {(cls.allowedScales?.length ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                    {cls.allowedScales!.join("/")}
                </span>
            )}
            {(cls.allowedFinishes?.length ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                    {cls.allowedFinishes!.join("/")}
                </span>
            )}
            <span className="text-xs text-muted-foreground">
                {cls.entryCount} entered
                {cls.exhibitorCount > 0 ? ` · ${cls.exhibitorCount} exhibitor${cls.exhibitorCount === 1 ? "" : "s"}` : ""}
            </span>
            {classRoomHref && (
                <Link
                    href={classRoomHref}
                    className="text-xs font-medium whitespace-nowrap text-forest hover:underline"
                >
                    Class room →
                </Link>
            )}
            {canEnter && cls.status === "scheduled" && (
                <span className="ml-auto">
                    <Button variant="outline" size="sm" onClick={() => onEnter(cls)}>
                        Enter
                    </Button>
                </span>
            )}
        </li>
    );
}
