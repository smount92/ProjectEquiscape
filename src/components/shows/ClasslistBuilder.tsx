"use client";

/**
 * Console CLASSLIST tab — the builder. Tree of divisions (axis
 * badge) → sections → classes with add/edit/reorder via the
 * shows-v2 actions. "Load NAMHSA template" leads the empty state.
 *
 * When the show has left its running phases
 * (!isShowMutableForClasslist) or the viewer isn't host/co-host,
 * the tree renders read-only with a note. Classes are never
 * deleted — cancelling (status flip) preserves the published
 * classlist, per the design doc.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
    addClass,
    addDivision,
    addSection,
    loadNamhsaTemplate,
    reorderClasslist,
    updateClass,
} from "@/app/actions/shows-v2";
import type { ConsoleClass, ConsoleDivision, ConsoleSection } from "@/lib/shows/console";
import { formatStatus, isShowMutableForClasslist } from "@/lib/shows/stateMachine";
import type { DivisionAxis, ShowStatus } from "@/lib/shows/types";
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
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const AXIS_OPTIONS: { value: DivisionAxis; label: string }[] = [
    { value: "halter", label: "Halter" },
    { value: "performance", label: "Performance" },
    { value: "workmanship", label: "Workmanship" },
    { value: "collectibility", label: "Collectibility" },
    { value: "other", label: "Other" },
];

function parseCommaList(value: string): string[] | null {
    const items = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return items.length > 0 ? items : null;
}

/** Swap the item at `index` with its neighbor and emit the full new sort map. */
function swapOrder<T extends { id: string }>(
    items: T[],
    index: number,
    direction: -1 | 1,
): { id: string; sortOrder: number }[] | null {
    const target = index + direction;
    if (target < 0 || target >= items.length) return null;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered.map((item, i) => ({ id: item.id, sortOrder: i }));
}

// ── Small shared bits ──

function ReorderButtons({
    disabled,
    onMove,
    label,
}: {
    disabled: boolean;
    onMove: (direction: -1 | 1) => void;
    label: string;
}) {
    return (
        <span className="inline-flex gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onMove(-1)}
                aria-label={`Move ${label} up`}
            >
                ↑
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onMove(1)}
                aria-label={`Move ${label} down`}
            >
                ↓
            </Button>
        </span>
    );
}

interface InlineAddFormProps {
    placeholder: string;
    buttonLabel: string;
    pending: boolean;
    onAdd: (name: string) => Promise<void>;
    extra?: React.ReactNode;
}

function InlineAddForm({ placeholder, buttonLabel, pending, onAdd, extra }: InlineAddFormProps) {
    const [name, setName] = useState("");
    return (
        <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                await onAdd(name.trim());
                setName("");
            }}
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                className="h-9 w-56 max-w-full"
                maxLength={120}
                aria-label={placeholder}
            />
            {extra}
            <Button type="submit" variant="outline" size="sm" disabled={pending || !name.trim()}>
                {buttonLabel}
            </Button>
        </form>
    );
}

// ── Class edit dialog ──

interface ClassEditDialogProps {
    cls: ConsoleClass;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    setError: (e: string | null) => void;
}

function ClassEditDialog({ cls, open, onClose, onSaved, setError }: ClassEditDialogProps) {
    const [name, setName] = useState(cls.name);
    const [classNumber, setClassNumber] = useState(cls.classNumber ?? "");
    const [maxPerEntrant, setMaxPerEntrant] = useState(
        cls.maxPerEntrant !== null ? String(cls.maxPerEntrant) : "",
    );
    const [scales, setScales] = useState((cls.allowedScales ?? []).join(", "));
    const [finishes, setFinishes] = useState((cls.allowedFinishes ?? []).join(", "));
    const [isQualifying, setIsQualifying] = useState(cls.isQualifying);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const max = maxPerEntrant.trim() === "" ? null : Number(maxPerEntrant);
        const result = await updateClass({
            classId: cls.id,
            patch: {
                name: name.trim() || undefined,
                // The schema takes a non-null string; blank = leave unchanged.
                classNumber: classNumber.trim() || undefined,
                maxPerEntrant: max !== null && Number.isFinite(max) ? max : null,
                allowedScales: parseCommaList(scales),
                allowedFinishes: parseCommaList(finishes),
                isQualifying,
            },
        });
        setSaving(false);
        if (result.success) {
            onSaved();
            onClose();
        } else {
            setError(result.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Class settings</DialogTitle>
                    <DialogDescription>
                        Caps and eligibility for “{cls.name}”.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        Class name
                        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold">
                            Class number
                            <Input
                                value={classNumber}
                                onChange={(e) => setClassNumber(e.target.value)}
                                placeholder="101"
                                maxLength={20}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-semibold">
                            Max per entrant
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={maxPerEntrant}
                                onChange={(e) => setMaxPerEntrant(e.target.value)}
                                placeholder="No cap"
                            />
                        </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        Allowed scales
                        <Input
                            value={scales}
                            onChange={(e) => setScales(e.target.value)}
                            placeholder="Traditional, Classic (comma-separated, blank = any)"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                        Allowed finishes
                        <Input
                            value={finishes}
                            onChange={(e) => setFinishes(e.target.value)}
                            placeholder="OF, CM (comma-separated, blank = any)"
                        />
                    </label>
                    <label className="flex items-center gap-2.5 text-sm font-semibold">
                        <input
                            type="checkbox"
                            checked={isQualifying}
                            onChange={(e) => setIsQualifying(e.target.checked)}
                            className="size-4 accent-forest"
                        />
                        Qualifying class (1st &amp; 2nd earn MHH cards)
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save class"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Class row ──

function ClassRow({
    cls,
    canEdit,
    pending,
    onEdit,
    onCancelClass,
    onRestoreClass,
    onMove,
    entriesExist,
}: {
    cls: ConsoleClass;
    canEdit: boolean;
    pending: boolean;
    onEdit: () => void;
    onCancelClass: () => void;
    onRestoreClass: () => void;
    onMove: (direction: -1 | 1) => void;
    entriesExist: boolean;
}) {
    const cancelled = cls.status === "cancelled";
    return (
        <li
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 ${cancelled ? "opacity-60" : ""}`}
            data-testid="class-row"
        >
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {cls.classNumber ?? "—"}
            </span>
            <span className={`text-sm font-medium text-foreground ${cancelled ? "line-through" : ""}`}>
                {cls.name}
            </span>
            {cls.status !== "scheduled" && (
                <span className={`stamp ${cancelled ? "stamp-red" : ""}`}>{formatStatus(cls.status)}</span>
            )}
            {!cls.isQualifying && <Badge variant="outline">non-qualifying</Badge>}
            {cls.maxPerEntrant !== null && (
                <Badge variant="secondary">max {cls.maxPerEntrant}/entrant</Badge>
            )}
            {(entriesExist || cls.entryCount > 0) && (
                <span className="text-xs text-muted-foreground">
                    {cls.entryCount} entered
                </span>
            )}
            {canEdit && (
                <span className="ml-auto inline-flex items-center gap-1">
                    <ReorderButtons disabled={pending} onMove={onMove} label={cls.name} />
                    <Button variant="ghost" size="sm" disabled={pending} onClick={onEdit}>
                        Edit
                    </Button>
                    {cancelled ? (
                        <Button variant="outline" size="sm" disabled={pending} onClick={onRestoreClass}>
                            Restore
                        </Button>
                    ) : (
                        <Button
                            variant="destructive-outline"
                            size="sm"
                            disabled={pending}
                            onClick={onCancelClass}
                        >
                            Cancel class
                        </Button>
                    )}
                </span>
            )}
        </li>
    );
}

// ── The builder ──

interface ClasslistBuilderProps {
    showId: string;
    showStatus: ShowStatus;
    divisions: ConsoleDivision[];
    canManage: boolean;
    entriesExist: boolean;
}

export default function ClasslistBuilder({
    showId,
    showStatus,
    divisions,
    canManage,
    entriesExist,
}: ClasslistBuilderProps) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingClass, setEditingClass] = useState<ConsoleClass | null>(null);

    const mutable = isShowMutableForClasslist(showStatus);
    const canEdit = canManage && mutable;
    const isEmpty = divisions.length === 0;

    /** Run a mutation, surface its refusal verbatim, refresh on success. */
    const run = async (action: () => Promise<{ success: boolean; error?: string }>) => {
        setPending(true);
        setError(null);
        const result = await action();
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error ?? "Something went wrong.");
        }
        setPending(false);
    };

    const moveNode = (
        kind: "division" | "section" | "class",
        siblings: { id: string }[],
        index: number,
        direction: -1 | 1,
    ) => {
        const items = swapOrder(siblings, index, direction);
        if (!items) return;
        void run(() => reorderClasslist({ showId, kind, items }));
    };

    return (
        <div className="flex flex-col gap-6">
            {!mutable && (
                <p className="ledger-card text-sm text-muted-foreground" role="note">
                    This show is {formatStatus(showStatus)} — the classlist is frozen and shown
                    read-only. Results stay tied to the classlist exactly as it ran.
                </p>
            )}
            {mutable && !canManage && (
                <p className="ledger-card text-sm text-muted-foreground" role="note">
                    Only the host or a co-host can edit the classlist.
                </p>
            )}

            {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {isEmpty ? (
                <div className="ledger-card flex flex-col items-center gap-4 py-10 text-center">
                    <span className="ledger-tab">Empty Classlist</span>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Start from the NAMHSA core classlist — breed halter, performance, and
                        collectibility across 10 sections and 41 classes — then tailor it, or build
                        your own from scratch below.
                    </p>
                    {canEdit && (
                        <Button
                            disabled={pending}
                            onClick={() => run(() => loadNamhsaTemplate({ showId }))}
                        >
                            {pending ? "Loading…" : "Load NAMHSA template"}
                        </Button>
                    )}
                </div>
            ) : (
                <ul className="flex list-none flex-col gap-6 p-0">
                    {divisions.map((division, dIndex) => (
                        <li key={division.id} className="ledger-card">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="ledger-tab !mb-0">{division.name}</span>
                                <Badge variant="secondary">{division.axis}</Badge>
                                {canEdit && (
                                    <span className="ml-auto">
                                        <ReorderButtons
                                            disabled={pending}
                                            onMove={(dir) => moveNode("division", divisions, dIndex, dir)}
                                            label={division.name}
                                        />
                                    </span>
                                )}
                            </div>

                            <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                                {division.sections.map((section, sIndex) => (
                                    <li key={section.id}>
                                        <SectionBlock
                                            section={section}
                                            canEdit={canEdit}
                                            pending={pending}
                                            entriesExist={entriesExist}
                                            onMoveSection={(dir) =>
                                                moveNode("section", division.sections, sIndex, dir)
                                            }
                                            onMoveClass={(cIndex, dir) =>
                                                moveNode("class", section.classes, cIndex, dir)
                                            }
                                            onAddClass={(name) =>
                                                run(() => addClass({ sectionId: section.id, name, sortOrder: section.classes.length }))
                                            }
                                            onEditClass={setEditingClass}
                                            onCancelClass={(cls) =>
                                                run(() =>
                                                    updateClass({
                                                        classId: cls.id,
                                                        patch: { status: "cancelled" },
                                                    }),
                                                )
                                            }
                                            onRestoreClass={(cls) =>
                                                run(() =>
                                                    updateClass({
                                                        classId: cls.id,
                                                        patch: { status: "scheduled" },
                                                    }),
                                                )
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>

                            {canEdit && (
                                <div className="mt-4">
                                    <InlineAddForm
                                        placeholder="New section name"
                                        buttonLabel="Add section"
                                        pending={pending}
                                        onAdd={(name) =>
                                            run(() =>
                                                addSection({
                                                    divisionId: division.id,
                                                    name,
                                                    sortOrder: division.sections.length,
                                                }),
                                            )
                                        }
                                    />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {canEdit && <AddDivisionForm pending={pending} run={run} showId={showId} divisionCount={divisions.length} />}

            {editingClass && (
                <ClassEditDialog
                    key={editingClass.id}
                    cls={editingClass}
                    open
                    onClose={() => setEditingClass(null)}
                    onSaved={() => router.refresh()}
                    setError={setError}
                />
            )}
        </div>
    );
}

function SectionBlock({
    section,
    canEdit,
    pending,
    entriesExist,
    onMoveSection,
    onMoveClass,
    onAddClass,
    onEditClass,
    onCancelClass,
    onRestoreClass,
}: {
    section: ConsoleSection;
    canEdit: boolean;
    pending: boolean;
    entriesExist: boolean;
    onMoveSection: (direction: -1 | 1) => void;
    onMoveClass: (classIndex: number, direction: -1 | 1) => void;
    onAddClass: (name: string) => Promise<void>;
    onEditClass: (cls: ConsoleClass) => void;
    onCancelClass: (cls: ConsoleClass) => void;
    onRestoreClass: (cls: ConsoleClass) => void;
}) {
    return (
        <section aria-label={section.name} className="border-l-2 border-forest/30 pl-4">
            <div className="flex items-center gap-2">
                <h4 className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
                    {section.name}
                </h4>
                {canEdit && (
                    <ReorderButtons disabled={pending} onMove={onMoveSection} label={section.name} />
                )}
            </div>
            <ul className="mt-1 flex list-none flex-col p-0">
                {section.classes.map((cls, cIndex) => (
                    <ClassRow
                        key={cls.id}
                        cls={cls}
                        canEdit={canEdit}
                        pending={pending}
                        entriesExist={entriesExist}
                        onEdit={() => onEditClass(cls)}
                        onCancelClass={() => onCancelClass(cls)}
                        onRestoreClass={() => onRestoreClass(cls)}
                        onMove={(dir) => onMoveClass(cIndex, dir)}
                    />
                ))}
                {section.classes.length === 0 && (
                    <li className="py-1.5 text-sm text-muted-foreground italic">No classes yet.</li>
                )}
            </ul>
            {canEdit && (
                <div className="mt-2">
                    <InlineAddForm
                        placeholder="New class name"
                        buttonLabel="Add class"
                        pending={pending}
                        onAdd={onAddClass}
                    />
                </div>
            )}
        </section>
    );
}

function AddDivisionForm({
    showId,
    pending,
    divisionCount,
    run,
}: {
    showId: string;
    pending: boolean;
    divisionCount: number;
    run: (action: () => Promise<{ success: boolean; error?: string }>) => Promise<void>;
}) {
    const [axis, setAxis] = useState<DivisionAxis>("halter");
    return (
        <div className="ledger-card">
            <span className="ledger-tab">Add Division</span>
            <InlineAddForm
                placeholder="Division name (e.g. OF Plastic Halter)"
                buttonLabel="Add division"
                pending={pending}
                onAdd={(name) =>
                    run(() => addDivision({ showId, name, axis, sortOrder: divisionCount }))
                }
                extra={
                    <Select value={axis} onValueChange={(v) => setAxis(v as DivisionAxis)}>
                        <SelectTrigger className="h-9 w-44" size="sm" aria-label="Division axis">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {AXIS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
            />
        </div>
    );
}
