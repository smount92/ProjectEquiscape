"use client";

/**
 * Console ENTRIES tab — read-only in Phase C. Per-class entry
 * counts plus the entrant table (horse, owner, handler when
 * proxy, status). Entering itself ships in Phase D, so shows
 * without entries get a friendly explainer instead of an empty
 * table.
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

    // Class labels for the entrant table + per-class count rows.
    const classLabels = new Map<string, string>();
    const countRows: { id: string; label: string; count: number }[] = [];
    for (const division of divisions) {
        for (const section of division.sections) {
            for (const cls of section.classes) {
                const label = cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
                classLabels.set(cls.id, label);
                countRows.push({ id: cls.id, label, count: cls.entryCount });
            }
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <section className="ledger-card" aria-labelledby="entry-counts-heading">
                <span className="ledger-tab" id="entry-counts-heading">
                    Entries per Class
                </span>
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
                        {entries.map((entry) => (
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
