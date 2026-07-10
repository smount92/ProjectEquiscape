"use client";

/**
 * Console ENTRIES tab — per-class LIVE entry counts (scratched
 * rows are history, not volume) plus the entrant table (horse,
 * owner, handler when proxy, entry number, status — scratched
 * entries stay visible as the audit trail). Fed by the Phase D
 * entrant flow; the host-side day-of tools land in Phase E.
 */

import type { ConsoleDivision, ConsoleEntry } from "@/lib/shows/console";
import type { ShowStatus } from "@/lib/shows/types";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface ShowEntriesPanelProps {
    divisions: ConsoleDivision[];
    entries: ConsoleEntry[];
    showStatus: ShowStatus;
}

export default function ShowEntriesPanel({ divisions, entries, showStatus }: ShowEntriesPanelProps) {
    if (entries.length === 0) {
        return (
            <div className="ledger-card flex flex-col items-center gap-3 py-10 text-center">
                <span className="ledger-tab">No Entries Yet</span>
                <p className="max-w-md text-sm text-muted-foreground">
                    {showStatus === "draft"
                        ? "Entries open once you publish the show and open entries — entrants will appear here with their horses and classes."
                        : "No one has entered yet. Entries will appear here with their horses and classes as they come in."}
                </p>
            </div>
        );
    }

    // Class labels for the entrant table + per-class count rows,
    // in classlist order.
    const classLabels = new Map<string, string>();
    const classOrder = new Map<string, number>();
    const countRows: { id: string; label: string; count: number }[] = [];
    for (const division of divisions) {
        for (const section of division.sections) {
            for (const cls of section.classes) {
                const label = cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
                classLabels.set(cls.id, label);
                classOrder.set(cls.id, classOrder.size);
                countRows.push({ id: cls.id, label, count: cls.entryCount });
            }
        }
    }

    // Entrant table follows the classlist, then leg-tag number.
    const sortedEntries = [...entries].sort((a, b) => {
        const orderA = classOrder.get(a.classId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = classOrder.get(b.classId) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.entryNumber ?? Number.MAX_SAFE_INTEGER) - (b.entryNumber ?? Number.MAX_SAFE_INTEGER);
    });

    return (
        <div className="flex flex-col gap-6">
            <section className="ledger-card" aria-labelledby="entry-counts-heading">
                <span className="ledger-tab" id="entry-counts-heading">
                    Entries per Class
                </span>
                <p className="mb-2 text-xs text-muted-foreground">
                    Live entries only — scratched entries stay in the entrant list below.
                </p>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead className="text-right">Entries</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {countRows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>{row.label}</TableCell>
                                <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>

            <section className="ledger-card" aria-labelledby="entrants-heading">
                <span className="ledger-tab" id="entrants-heading">
                    Entrants
                </span>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Horse</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Handler</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedEntries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>{entry.entryNumber ?? "—"}</TableCell>
                                <TableCell>{entry.horseName}</TableCell>
                                <TableCell>@{entry.ownerAlias}</TableCell>
                                <TableCell>
                                    {entry.handlerAlias ? (
                                        <span>
                                            @{entry.handlerAlias}{" "}
                                            <Badge variant="outline">proxy</Badge>
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </TableCell>
                                <TableCell>{classLabels.get(entry.classId) ?? "—"}</TableCell>
                                <TableCell>
                                    <span
                                        className={`stamp ${entry.status === "scratched" ? "stamp-red" : ""}`}
                                    >
                                        {entry.status}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </div>
    );
}
