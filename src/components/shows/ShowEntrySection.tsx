"use client";

/**
 * Phase D — the public show page's interactive body: the full
 * classlist (division → section → class) plus, for the authed
 * viewer, the "My entries" panel and the class-first entry flow.
 *
 * Entering is only offered while the show is entries_open; anyone
 * else (anon, or any other status) gets the same classlist
 * read-only. Scratch/re-enter wording is deliberate: a scratched
 * entry is history and re-entering creates a NEW entry (partial
 * unique index in migration 117).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { scratchEntry } from "@/app/actions/shows-v2";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import { formatStatus } from "@/lib/shows/stateMachine";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import EnterClassDialog, { type EnterableClass } from "@/components/shows/EnterClassDialog";
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

interface ShowEntrySectionProps {
    showId: string;
    mode: ShowMode;
    status: ShowStatus;
    divisions: ConsoleDivision[];
    myEntries: MyShowEntry[];
    horses: EntrantHorse[];
    authed: boolean;
}

function classLabel(cls: { classNumber: string | null; name: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
}

export default function ShowEntrySection({
    showId,
    mode,
    status,
    divisions,
    myEntries,
    horses,
    authed,
}: ShowEntrySectionProps) {
    const router = useRouter();
    const entriesOpen = status === "entries_open";
    const canEnter = authed && entriesOpen;
    // Result stamps arrive with the completed transition (Phase E1).
    const hasResults = myEntries.some((e) => e.place !== null);

    const [activeClass, setActiveClass] = useState<EnterableClass | null>(null);
    // Remounts the dialog fresh each time it opens.
    const [dialogNonce, setDialogNonce] = useState(0);
    const [pendingScratch, setPendingScratch] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const classById = useMemo(() => {
        const map = new Map<string, ConsoleClass>();
        for (const division of divisions) {
            for (const section of division.sections) {
                for (const cls of section.classes) map.set(cls.id, cls);
            }
        }
        return map;
    }, [divisions]);

    const openDialog = (cls: EnterableClass) => {
        setError(null);
        setDialogNonce((n) => n + 1);
        setActiveClass(cls);
    };

    const handleScratch = async (entryId: string) => {
        setPendingScratch(entryId);
        setError(null);
        const result = await scratchEntry({ entryId });
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error);
        }
        setPendingScratch(null);
    };

    /** A scratched entry can re-enter only while no LIVE entry exists
     *  for the same class+horse (the server enforces this too). */
    const hasLiveEntry = (classId: string, horseId: string) =>
        myEntries.some(
            (e) => e.classId === classId && e.horseId === horseId && e.status !== "scratched",
        );

    return (
        <>
            {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {/* ── My entries ── */}
            {authed && myEntries.length > 0 && (
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
                                                    <Link
                                                        href={`/profile/${encodeURIComponent(entry.handlerAlias)}`}
                                                    >
                                                        @{entry.handlerAlias}
                                                    </Link>{" "}
                                                    <Badge variant="outline">proxy</Badge>
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`stamp ${scratched ? "stamp-red" : ""}`}>
                                                {entry.status}
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
                                                        disabled={pendingScratch !== null}
                                                        onClick={() => handleScratch(entry.id)}
                                                    >
                                                        {pendingScratch === entry.id
                                                            ? "Scratching…"
                                                            : "Scratch"}
                                                    </Button>
                                                )}
                                                {scratched &&
                                                    cls &&
                                                    cls.status === "scheduled" &&
                                                    !hasLiveEntry(entry.classId, entry.horseId) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openDialog(cls)}
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
            )}

            {/* ── Entry availability notes ── */}
            {entriesOpen && !authed && (
                <p className="ledger-card text-sm text-muted-foreground" role="note">
                    Entries are open — sign in to enter your horses.
                </p>
            )}
            {canEnter && horses.length === 0 && (
                <p className="ledger-card text-sm text-muted-foreground" role="note">
                    Entries are open, but you have no public horses yet — add horses to your
                    stable (and set them public) to enter.
                </p>
            )}

            {/* ── The classlist ── */}
            {divisions.length === 0 ? (
                <div className="ledger-card flex flex-col items-center gap-3 py-10 text-center">
                    <span className="ledger-tab">Classlist Coming</span>
                    <p className="max-w-md text-sm text-muted-foreground">
                        The host hasn&rsquo;t published the classlist yet.
                    </p>
                </div>
            ) : (
                <ul className="flex list-none flex-col gap-6 p-0">
                    {divisions.map((division) => (
                        <li key={division.id} className="ledger-card">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="ledger-tab !mb-0">{division.name}</span>
                                <Badge variant="secondary">{division.axis}</Badge>
                            </div>
                            <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                                {division.sections.map((section) => (
                                    <li key={section.id}>
                                        <section
                                            aria-label={section.name}
                                            className="border-l-2 border-forest/30 pl-4"
                                        >
                                            <h4 className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
                                                {section.name}
                                            </h4>
                                            <ul className="mt-1 flex list-none flex-col p-0">
                                                {section.classes.map((cls) => {
                                                    const cancelled = cls.status === "cancelled";
                                                    const combined = cls.status === "combined";
                                                    return (
                                                        <li
                                                            key={cls.id}
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
                                                                <span
                                                                    className={`stamp ${cancelled ? "stamp-red" : ""}`}
                                                                >
                                                                    {formatStatus(cls.status)}
                                                                </span>
                                                            )}
                                                            {cls.isQualifying && (
                                                                <Badge variant="outline">qualifying</Badge>
                                                            )}
                                                            {cls.maxPerEntrant !== null && (
                                                                <Badge variant="secondary">
                                                                    max {cls.maxPerEntrant}/entrant
                                                                </Badge>
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
                                                            </span>
                                                            {canEnter &&
                                                                cls.status === "scheduled" &&
                                                                horses.length > 0 && (
                                                                    <span className="ml-auto">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => openDialog(cls)}
                                                                        >
                                                                            Enter
                                                                        </Button>
                                                                    </span>
                                                                )}
                                                        </li>
                                                    );
                                                })}
                                                {section.classes.length === 0 && (
                                                    <li className="py-1.5 text-sm text-muted-foreground italic">
                                                        No classes yet.
                                                    </li>
                                                )}
                                            </ul>
                                        </section>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}

            {activeClass && (
                <EnterClassDialog
                    key={`${activeClass.id}-${dialogNonce}`}
                    showId={showId}
                    cls={activeClass}
                    mode={mode}
                    horses={horses}
                    onClose={() => setActiveClass(null)}
                    onEntered={() => router.refresh()}
                />
            )}
        </>
    );
}
