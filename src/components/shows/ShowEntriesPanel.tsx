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
 *
 * Show moderation: the BAR LIST section — who may not enter, with
 * Unbar — plus the one-motion "Remove & bar" the sloptrough incident
 * asked for twice. Removal is owner-grained (every entry they hold,
 * entered and scratched alike), so its control is owner-grained too,
 * kept behind a disclosure because most shows never need it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { scratchEntry, setFeePaid } from "@/app/actions/shows-v2";
import {
    barEntrant,
    liftBar,
    removeEntrantFromShow,
    strikeEntryFromResults,
} from "@/app/actions/shows-v4";
import type {
    ConsoleBarredEntrant,
    ConsoleDivision,
    ConsoleEntry,
} from "@/lib/shows/console";
import { friendlyEntryStatus } from "@/lib/shows/plainWords";
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

/** One entrant collapsed across all their entries at this show. */
interface OwnerRow {
    ownerId: string;
    alias: string;
    /** Every entry they hold — scratched ones count, removal takes them too. */
    count: number;
    /** Distinct classes those entries sit in. */
    classCount: number;
}

interface ShowEntriesPanelProps {
    showId: string;
    divisions: ConsoleDivision[];
    entries: ConsoleEntry[];
    showStatus: ShowStatus;
    /** Entrants marked paid on the manual fee checklist (139). */
    feePaidUserIds: string[];
    /** Members barred from this show (148) — staff-scoped by RLS. */
    barred: ConsoleBarredEntrant[];
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
    barred,
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
    // v4 sticky scratch: host/co-host may bar the entrant in the same
    // motion — scratches ALL their live entries and blocks re-entry.
    const [alsoBar, setAlsoBar] = useState(false);
    // Remove & bar: owner-grained, so the target is an owner summary
    // rather than a single entry.
    const [removeTarget, setRemoveTarget] = useState<OwnerRow | null>(null);
    const [removeReason, setRemoveReason] = useState("");
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const [unbarringId, setUnbarringId] = useState<string | null>(null);
    const [barListError, setBarListError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        },
        [],
    );

    const flash = (message: string) => {
        setToast(message);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3000);
    };

    // Mirrors scratchEntry's staff door: any live entry, until the
    // show completes. The action is the authority; this only decides
    // whether to OFFER the button.
    const canScratch =
        SCRATCH_ROLES.includes(viewerRole) &&
        showStatus !== "completed" &&
        showStatus !== "archived";

    // v4: once results exist, the door changes — scratch closes and
    // STRIKE opens (host/co-host): removes the placing, voids the card,
    // deletes platform trophy-case records, scratches with an audit
    // note. The publish escape hatch, previously SQL-only.
    const strikeMode =
        (viewerRole === "host" || viewerRole === "co_host") &&
        (showStatus === "results_review" ||
            showStatus === "completed" ||
            showStatus === "archived");

    const openScratch = (entry: ConsoleEntry) => {
        setScratchError(null);
        setScratchReason("");
        setAlsoBar(false);
        setScratchTarget(entry);
    };

    // The bar door is narrower than the scratch door: host/co-host
    // only, never on your own entry (mirrors barEntrant's checks).
    const canBar = (target: ConsoleEntry | null): boolean =>
        !!target &&
        (viewerRole === "host" || viewerRole === "co_host") &&
        target.ownerId !== viewerId;

    const handleScratch = async () => {
        if (!scratchTarget) return;
        setScratching(true);
        setScratchError(null);
        const reason = scratchReason.trim();
        if (strikeMode) {
            if (reason.length < 3) {
                setScratchError("A reason is required — it lands on the entry's audit trail.");
                setScratching(false);
                return;
            }
            const result = await strikeEntryFromResults({
                entryId: scratchTarget.id,
                reason,
            });
            if (result.success) {
                setScratchTarget(null);
                flash("Entry struck — placing removed, card voided, records deleted.");
                router.refresh();
            } else {
                setScratchError(result.error);
            }
            setScratching(false);
            return;
        }
        const barring = alsoBar && canBar(scratchTarget);
        const result = barring
            ? await barEntrant({
                  showId,
                  userId: scratchTarget.ownerId,
                  ...(reason ? { reason } : {}),
                  scratchEntries: true,
              })
            : await scratchEntry({
                  entryId: scratchTarget.id,
                  ...(reason ? { reason } : {}),
              });
        if (result.success) {
            const notified = scratchTarget.ownerId !== viewerId;
            setScratchTarget(null);
            flash(
                barring
                    ? `@${scratchTarget.ownerAlias} barred — all their entries scratched and re-entry blocked.`
                    : notified
                      ? "Entry scratched — the owner has been notified."
                      : "Entry scratched.",
            );
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

    // ── Remove & bar (the one-motion tool) ──
    // Owner-grained: one row per entrant, all their entries at once.
    // Host/co-host only, and never yourself — removeEntrantFromShow
    // enforces both server-side and refuses verbatim if this drifts.
    const canModerate = viewerRole === "host" || viewerRole === "co_host";

    const ownerRows: OwnerRow[] = (() => {
        const byOwner = new Map<string, OwnerRow & { classes: Set<string> }>();
        for (const entry of entries) {
            const existing = byOwner.get(entry.ownerId);
            if (existing) {
                existing.count += 1;
                existing.classes.add(entry.classId);
            } else {
                byOwner.set(entry.ownerId, {
                    ownerId: entry.ownerId,
                    alias: entry.ownerAlias,
                    count: 1,
                    classCount: 0,
                    classes: new Set([entry.classId]),
                });
            }
        }
        return [...byOwner.values()]
            .map(({ classes, ...row }) => ({ ...row, classCount: classes.size }))
            .sort((a, b) => a.alias.localeCompare(b.alias));
    })();

    const barredIds = new Set(barred.map((b) => b.userId));

    const openRemove = (owner: OwnerRow) => {
        setRemoveError(null);
        setRemoveReason("");
        setRemoveTarget(owner);
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        setRemoveError(null);
        const reason = removeReason.trim();
        const result = await removeEntrantFromShow({
            showId,
            userId: removeTarget.ownerId,
            ...(reason ? { reason } : {}),
        });
        if (result.success) {
            const alias = removeTarget.alias;
            setRemoveTarget(null);
            flash(
                `@${alias} removed — ${result.removedEntries} ${
                    result.removedEntries === 1 ? "entry" : "entries"
                } deleted and re-entry blocked.`,
            );
            router.refresh();
        } else {
            // The action's refusals are the truth — verbatim, dialog open.
            setRemoveError(result.error);
        }
        setRemoving(false);
    };

    const handleUnbar = async (row: ConsoleBarredEntrant) => {
        setBarListError(null);
        setUnbarringId(row.userId);
        const result = await liftBar({ showId, userId: row.userId });
        setUnbarringId(null);
        if (result.success) {
            flash(`@${row.alias} may enter this show again.`);
            router.refresh();
        } else {
            setBarListError(result.error);
        }
    };

    /** The bar list + the removal disclosure. Rendered in BOTH the
     *  populated and empty-entries branches: removing the only entrant
     *  leaves zero entries and a bar row, and the host must still be
     *  able to see and lift it. */
    const barListSection = (
        <section className="ledger-card" aria-labelledby="bar-list-heading">
            <span className="ledger-tab" id="bar-list-heading">
                Bar List
            </span>
            {barred.length === 0 ? (
                <p className="mb-2 text-xs text-muted-foreground">
                    No one is barred from this show.
                </p>
            ) : (
                <>
                    <p className="mb-2 text-xs text-muted-foreground">
                        These members cannot enter this show. Reasons are staff-only — the
                        member is never shown them.
                    </p>
                    <ul className="flex flex-col gap-2" data-testid="bar-list">
                        {barred.map((row) => (
                            <li
                                key={row.userId}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-card/60 p-3"
                            >
                                <span className="text-sm">
                                    <span className="font-semibold">@{row.alias}</span>
                                    {row.reason && (
                                        <span className="block text-xs text-muted-foreground">
                                            {row.reason}
                                        </span>
                                    )}
                                </span>
                                {canModerate && (
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        disabled={unbarringId === row.userId}
                                        onClick={() => handleUnbar(row)}
                                        aria-label={`Unbar @${row.alias}`}
                                    >
                                        {unbarringId === row.userId ? "Working…" : "Unbar"}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {barListError && (
                <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
                    {barListError}
                </p>
            )}
            {canModerate && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-forest hover:underline">
                        Remove an entrant from this show…
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Deletes every entry that member holds here — entered and scratched
                        alike — and bars them from entering again. For a single mistaken
                        entry, scratch it instead.
                    </p>
                    {ownerRows.filter((o) => o.ownerId !== viewerId).length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                            No other entrants to remove.
                        </p>
                    ) : (
                        <ul className="mt-2 flex flex-col gap-2" data-testid="remove-entrant-list">
                            {ownerRows
                                .filter((owner) => owner.ownerId !== viewerId)
                                .map((owner) => (
                                    <li
                                        key={owner.ownerId}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-card/60 p-3"
                                    >
                                        <span className="text-sm">
                                            <span className="font-semibold">@{owner.alias}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {owner.count}{" "}
                                                {owner.count === 1 ? "entry" : "entries"} in{" "}
                                                {owner.classCount}{" "}
                                                {owner.classCount === 1 ? "class" : "classes"}
                                                {barredIds.has(owner.ownerId) && " · already barred"}
                                            </span>
                                        </span>
                                        <Button
                                            variant="destructive-outline"
                                            size="xs"
                                            disabled={removing}
                                            onClick={() => openRemove(owner)}
                                            aria-label={`Remove and bar @${owner.alias}`}
                                        >
                                            Remove &amp; bar…
                                        </Button>
                                    </li>
                                ))}
                        </ul>
                    )}
                </details>
            )}
        </section>
    );

    /** Confirm for the removal — states exactly what disappears. */
    const removeDialog = (
        <Dialog
            open={removeTarget !== null}
            onOpenChange={(next) => {
                if (!next && !removing) setRemoveTarget(null);
            }}
        >
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>
                        {removeTarget && `Remove @${removeTarget.alias} from this show?`}
                    </DialogTitle>
                    <DialogDescription>
                        {removeTarget &&
                            `This deletes all ${removeTarget.count} ${
                                removeTarget.count === 1 ? "entry" : "entries"
                            } they hold across ${removeTarget.classCount} ${
                                removeTarget.classCount === 1 ? "class" : "classes"
                            } — scratched entries included — and blocks @${
                                removeTarget.alias
                            } from entering this show again. Deleted entries cannot be restored; the bar can be lifted from this list. They are told their entries were removed by the host, and nothing else.`}
                    </DialogDescription>
                </DialogHeader>
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                        Reason{" "}
                        <span className="font-normal text-muted-foreground">
                            (optional — kept on your bar list, never shown to them)
                        </span>
                    </span>
                    <Textarea
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value)}
                        rows={2}
                        maxLength={200}
                        placeholder="e.g. Joke entries, asked to stop"
                        disabled={removing}
                    />
                    <span className="self-end text-xs tabular-nums text-muted-foreground">
                        {removeReason.length}/200
                    </span>
                </label>
                {removeError && (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                        {removeError}
                    </p>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        size="wide"
                        onClick={() => setRemoveTarget(null)}
                        disabled={removing}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive-outline"
                        size="wide"
                        onClick={handleRemove}
                        disabled={removing}
                        data-testid="remove-entrant-confirm"
                    >
                        {removing ? "Working…" : "Remove & bar entrant"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (entries.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div className="ledger-card flex flex-col items-center gap-3 py-10 text-center">
                    <span className="ledger-tab">No Entries Yet</span>
                    <p className="max-w-md text-sm text-muted-foreground">
                        {showStatus === "draft"
                            ? "Entries open once you publish the show and open entries — entrants will appear here with their horses and classes."
                            : "No one has entered yet. Entries will appear here with their horses and classes as they come in."}
                    </p>
                </div>
                {(canModerate || barred.length > 0) && barListSection}
                {removeDialog}
                {toast && (
                    <div className="share-toast" role="status" aria-live="polite">
                        {toast}
                    </div>
                )}
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

    // The fee checklist is per-OWNER too (all their entries, scratched
    // or not, are one fee) — it shares `ownerRows` with the removal
    // list above, which is built on the same collapse.

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
                            {(canScratch || strikeMode) && (
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
                                            {friendlyEntryStatus(entry.status)}
                                        </span>
                                    </TableCell>
                                    {(canScratch || strikeMode) && (
                                        <TableCell className="text-right">
                                            {!isScratched && (
                                                <Button
                                                    variant="destructive-outline"
                                                    size="xs"
                                                    disabled={scratching}
                                                    onClick={() => openScratch(entry)}
                                                    aria-label={`${strikeMode ? "Strike" : "Scratch"} ${entry.horseName}`}
                                                >
                                                    {strikeMode ? "Strike" : "Scratch"}
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

            {(canModerate || barred.length > 0) && barListSection}

            {removeDialog}

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
                            {scratchTarget &&
                                (strikeMode
                                    ? `Strike ${scratchTarget.horseName} from the results?`
                                    : `Scratch ${scratchTarget.horseName}?`)}
                        </DialogTitle>
                        <DialogDescription>
                            {scratchTarget &&
                                (strikeMode
                                    ? `Removes this entry's placing from ${
                                          classLabels.get(scratchTarget.classId) ?? "its class"
                                      }, voids any qualification card it earned, deletes the platform trophy-case records this show wrote for the horse, and scratches the entry with your reason on its audit note. This is the correction tool for a result that should never have stood.`
                                    : `The entry stays in the list as history, but leaves ${
                                          classLabels.get(scratchTarget.classId) ?? "its class"
                                      }. ${
                                          scratchTarget.ownerId === viewerId
                                              ? "This is your own entry."
                                              : `@${scratchTarget.ownerAlias} will be notified.`
                                      }`)}
                        </DialogDescription>
                    </DialogHeader>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                            Reason{" "}
                            <span className="font-normal text-muted-foreground">
                                {strikeMode
                                    ? "(required — lands on the audit trail)"
                                    : "(optional, shared with the owner)"}
                            </span>
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
                    {!strikeMode && canBar(scratchTarget) && (
                        <label className="flex items-start gap-2 rounded-md border border-input bg-card/60 p-3">
                            <input
                                type="checkbox"
                                checked={alsoBar}
                                onChange={(e) => setAlsoBar(e.target.checked)}
                                disabled={scratching}
                                className="mt-0.5"
                                data-testid="scratch-also-bar"
                            />
                            <span className="text-sm">
                                <span className="font-semibold">
                                    Also bar @{scratchTarget?.ownerAlias} from this show
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    Scratches ALL of their entries and blocks re-entry while
                                    entries are open. Reversible from the bar list.
                                </span>
                            </span>
                        </label>
                    )}
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
                            {scratching
                                ? "Working…"
                                : strikeMode
                                  ? "Strike from results"
                                  : alsoBar && canBar(scratchTarget)
                                    ? "Scratch & bar entrant"
                                    : "Scratch entry"}
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
