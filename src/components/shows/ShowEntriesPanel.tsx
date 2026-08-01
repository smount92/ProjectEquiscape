"use client";

/**
 * Console ENTRIES tab — per-class LIVE entry counts (scratched
 * rows are history, not volume), the host's manual fee checklist
 * (139 — show_fee_payments has no auto-verification, this is just
 * a checklist), plus the entrant table (horse, owner, handler when
 * proxy, entry number, status — scratched entries stay visible as
 * the audit trail, dimmed).
 *
 * Wave 2: the staff scratch door gets its UI — host/co-host/steward
 * can scratch any live entry until the show completes (scratchEntry
 * enforces the same rule server-side), with an optional reason that
 * lands in the entry's note and the owner's notification.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { scratchEntry, setFeePaid } from "@/app/actions/shows-v2";
import type { ConsoleDivision, ConsoleEntry } from "@/lib/shows/console";
import type { ShowStatus, StaffRole } from "@/lib/shows/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/** Roles the scratch action's staff door admits (mirrors
 *  SCRATCH_STAFF_ROLES in shows-v2.ts — judges place, never scratch). */
const SCRATCH_ROLES: StaffRole[] = ["host", "co_host", "steward"];

interface ShowEntriesPanelProps {
    showId: string;
    divisions: ConsoleDivision[];
    entries: ConsoleEntry[];
    showStatus: ShowStatus;
    /** Entrants marked paid on the manual fee checklist (139). */
    feePaidUserIds: string[];
    feeInfo: string | null;
    /** Host/co-host — only managers can toggle the fee checklist. */
    canManage: boolean;
    /** The viewer's staff role — drives the scratch door. */
    viewerRole: StaffRole;
    /** The viewer's user id — "owner notified" copy only applies to
     *  someone ELSE's entry. */
    viewerId: string;
}

export default function ShowEntriesPanel({
    showId,
    divisions,
    entries,
    showStatus,
    feePaidUserIds,
    feeInfo,
    canManage,
    viewerRole,
    viewerId,
}: ShowEntriesPanelProps) {
    const router = useRouter();

    // Optimistic fee-paid view: server truth (the prop) plus a small
    // override map for in-flight toggles. Derived at render — no
    // state mirror to resync, so the prop can never drift from truth.
    const [paidOverrides, setPaidOverrides] = useState<Map<string, boolean>>(new Map());
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [feeError, setFeeError] = useState<string | null>(null);

    // Staff scratch flow: pick an entry → confirm (optional reason).
    const [scratchTarget, setScratchTarget] = useState<ConsoleEntry | null>(null);
    const [scratchReason, setScratchReason] = useState("");
    const [scratching, setScratching] = useState(false);
    const [scratchError, setScratchError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        },
        [],
    );

    // Mirrors scratchEntry's staff door: any live entry, until the
    // show completes. The action is the authority; this only decides
    // whether to OFFER the button.
    const canScratch =
        SCRATCH_ROLES.includes(viewerRole) &&
        showStatus !== "completed" &&
        showStatus !== "archived";

    const openScratch = (entry: ConsoleEntry) => {
        setScratchError(null);
        setScratchReason("");
        setScratchTarget(entry);
    };

    const handleScratch = async () => {
        if (!scratchTarget) return;
        setScratching(true);
        setScratchError(null);
        const reason = scratchReason.trim();
        const result = await scratchEntry({
            entryId: scratchTarget.id,
            ...(reason ? { reason } : {}),
        });
        if (result.success) {
            const notified = scratchTarget.ownerId !== viewerId;
            setScratchTarget(null);
            setToast(
                notified
                    ? "Entry scratched — the owner has been notified."
                    : "Entry scratched.",
            );
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(null), 3000);
            router.refresh();
        } else {
            // The action's refusals are the truth — surface them verbatim.
            setScratchError(result.error);
        }
        setScratching(false);
    };

    const paidIds = useMemo(() => {
        const next = new Set(feePaidUserIds);
        for (const [id, paid] of paidOverrides) {
            if (paid) next.add(id);
            else next.delete(id);
        }
        return next;
    }, [feePaidUserIds, paidOverrides]);

    const handleTogglePaid = async (ownerId: string) => {
        const wasPaid = paidIds.has(ownerId);
        setFeeError(null);
        setTogglingId(ownerId);
        setPaidOverrides((prev) => new Map(prev).set(ownerId, !wasPaid));
        const result = await setFeePaid({ showId, userId: ownerId, paid: !wasPaid });
        setTogglingId(null);
        if (result.success) {
            router.refresh();
        } else {
            // Drop the optimistic override — back to server truth.
            setPaidOverrides((prev) => {
                const next = new Map(prev);
                next.delete(ownerId);
                return next;
            });
            setFeeError(result.error ?? "Something went wrong.");
        }
    };
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

    // Fee checklist is per-OWNER, not per-entry — one row per unique
    // owner (all their entries, scratched or not, are one fee).
    const ownerRows = (() => {
        const byOwner = new Map<string, { ownerId: string; alias: string; count: number }>();
        for (const entry of entries) {
            const existing = byOwner.get(entry.ownerId);
            if (existing) {
                existing.count += 1;
            } else {
                byOwner.set(entry.ownerId, {
                    ownerId: entry.ownerId,
                    alias: entry.ownerAlias,
                    count: 1,
                });
            }
        }
        return [...byOwner.values()].sort((a, b) => a.alias.localeCompare(b.alias));
    })();

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

            <section className="ledger-card" aria-labelledby="fee-checklist-heading">
                <span className="ledger-tab" id="fee-checklist-heading">
                    Fee Checklist
                </span>
                <p className="mb-2 text-xs text-muted-foreground">
                    {feeInfo
                        ? feeInfo
                        : canManage
                          ? "A manual tally — mark each entrant paid as fees come in."
                          : "Fees are tracked by the show host."}
                </p>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Entrant</TableHead>
                            <TableHead className="text-right">Entries</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ownerRows.map((owner) => {
                            const isPaid = paidIds.has(owner.ownerId);
                            return (
                                <TableRow key={owner.ownerId}>
                                    <TableCell>@{owner.alias}</TableCell>
                                    <TableCell className="text-right">{owner.count}</TableCell>
                                    <TableCell className="text-right">
                                        {canManage ? (
                                            <input
                                                type="checkbox"
                                                checked={isPaid}
                                                disabled={togglingId === owner.ownerId}
                                                onChange={() => handleTogglePaid(owner.ownerId)}
                                                className="size-5 min-h-6 min-w-6 accent-forest"
                                                aria-label={`Mark @${owner.alias} paid`}
                                            />
                                        ) : isPaid ? (
                                            <Badge variant="secondary">✓ Paid</Badge>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                {feeError && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
                        {feeError}
                    </p>
                )}
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
                            {canScratch && (
                                <TableHead className="text-right">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedEntries.map((entry) => {
                            const isScratched = entry.status === "scratched";
                            return (
                                <TableRow
                                    key={entry.id}
                                    className={isScratched ? "opacity-60" : undefined}
                                    data-testid={isScratched ? "entry-row-scratched" : "entry-row"}
                                >
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
                                            className={`stamp ${isScratched ? "stamp-red" : ""}`}
                                        >
                                            {entry.status}
                                        </span>
                                    </TableCell>
                                    {canScratch && (
                                        <TableCell className="text-right">
                                            {!isScratched && (
                                                <Button
                                                    variant="destructive-outline"
                                                    size="xs"
                                                    disabled={scratching}
                                                    onClick={() => openScratch(entry)}
                                                    aria-label={`Scratch ${entry.horseName}`}
                                                >
                                                    Scratch
                                                </Button>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </section>

            {/* Scratch confirm — optional reason lands in the entry note
                and the owner's notification, verbatim. */}
            <Dialog
                open={scratchTarget !== null}
                onOpenChange={(next) => {
                    if (!next && !scratching) setScratchTarget(null);
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>
                            {scratchTarget && `Scratch ${scratchTarget.horseName}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {scratchTarget &&
                                `The entry stays in the list as history, but leaves ${
                                    classLabels.get(scratchTarget.classId) ?? "its class"
                                }. ${
                                    scratchTarget.ownerId === viewerId
                                        ? "This is your own entry."
                                        : `@${scratchTarget.ownerAlias} will be notified.`
                                }`}
                        </DialogDescription>
                    </DialogHeader>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                            Reason <span className="font-normal text-muted-foreground">(optional, shared with the owner)</span>
                        </span>
                        <Textarea
                            value={scratchReason}
                            onChange={(e) => setScratchReason(e.target.value)}
                            rows={2}
                            maxLength={200}
                            placeholder="e.g. Entered twice in the same class"
                            disabled={scratching}
                        />
                        <span className="self-end text-xs tabular-nums text-muted-foreground">
                            {scratchReason.length}/200
                        </span>
                    </label>
                    {scratchError && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {scratchError}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="wide"
                            onClick={() => setScratchTarget(null)}
                            disabled={scratching}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive-outline"
                            size="wide"
                            onClick={handleScratch}
                            disabled={scratching}
                            data-testid="scratch-confirm"
                        >
                            {scratching ? "Scratching…" : "Scratch entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {toast && (
                <div className="share-toast" role="status" aria-live="polite">
                    {toast}
                </div>
            )}
        </div>
    );
}
