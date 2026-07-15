"use client";

/**
 * Console CLASSLIST tab — the builder. Tree of divisions (axis
 * badge) → sections → classes with add/edit/rename/reorder via
 * the shows-v2 actions. A template picker (full NAMHSA classlist,
 * per-axis slices, virtual starter) leads the empty state.
 *
 * When the show has left its running phases
 * (!isShowMutableForClasslist) or the viewer isn't host/co-host,
 * the tree renders read-only with a note. Classes are never
 * deleted — cancelling (status flip) preserves the published
 * classlist, per the design doc.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import {
    addClass,
    addDivision,
    addSection,
    loadNamhsaTemplate,
    reorderClasslist,
    updateClass,
    updateDivision,
    updateSection,
} from "@/app/actions/shows-v2";
import type { ConsoleClass, ConsoleDivision, ConsoleSection } from "@/lib/shows/console";
import { countTemplateClasses, SHOW_CLASSLIST_TEMPLATES } from "@/lib/shows/namhsaTemplate";
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

/**
 * The exact FinishType values horses store (add-horse's Finish Type
 * select) — entry eligibility is an exact string match, so anything
 * else (e.g. "CM") would reject every entry.
 */
const FINISH_OPTIONS = ["OF", "Custom", "Artist Resin"] as const;

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

/**
 * A division/section name with a pencil that swaps it for an inline
 * input — Enter/blur saves, Escape cancels. `display` carries the
 * caller's styled name so the two headers keep their own looks.
 */
function RenamableName({
    name,
    label,
    disabled,
    display,
    onRename,
}: {
    name: string;
    label: string;
    disabled: boolean;
    display: React.ReactNode;
    onRename: (name: string) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    // Enter both commits and blurs — the ref keeps blur from saving twice.
    const done = useRef(false);

    if (!editing) {
        return (
            <>
                {display}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    onClick={() => {
                        setValue(name);
                        done.current = false;
                        setEditing(true);
                    }}
                    aria-label={`Rename ${label}`}
                >
                    <Pencil className="size-3.5" />
                </Button>
            </>
        );
    }

    const commit = async () => {
        if (done.current) return;
        done.current = true;
        setEditing(false);
        const trimmed = value.trim();
        if (trimmed && trimmed !== name) await onRename(trimmed);
    };

    return (
        <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    void commit();
                } else if (e.key === "Escape") {
                    done.current = true;
                    setEditing(false);
                }
            }}
            className="h-8 w-56 max-w-full"
            maxLength={120}
            aria-label={`Rename ${label}`}
        />
    );
}

interface InlineAddFormProps {
    placeholder: string;
    buttonLabel: string;
    pending: boolean;
    onAdd: (name: string, classNumber?: string) => Promise<void>;
    /** Show the optional "No." input (class numbers) beside the name. */
    withNumber?: boolean;
    extra?: React.ReactNode;
}

function InlineAddForm({
    placeholder,
    buttonLabel,
    pending,
    onAdd,
    withNumber,
    extra,
}: InlineAddFormProps) {
    const [name, setName] = useState("");
    const [number, setNumber] = useState("");
    return (
        <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                await onAdd(name.trim(), withNumber ? number.trim() || undefined : undefined);
                setName("");
                setNumber("");
            }}
        >
            {withNumber && (
                <Input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="No."
                    className="h-9 w-16 shrink-0"
                    maxLength={20}
                    aria-label="Class number (optional)"
                />
            )}
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
    // Drop any legacy non-canonical finish (e.g. "CM") — it could never
    // match a horse, so unchecking it here is the repair.
    const [finishes, setFinishes] = useState<string[]>(
        (cls.allowedFinishes ?? []).filter((f) =>
            (FINISH_OPTIONS as readonly string[]).includes(f),
        ),
    );
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
                // None checked = open to any finish (null clears the rule).
                allowedFinishes: finishes.length > 0 ? finishes : null,
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
                        {/* Scales stay free text — horses inherit their catalog
                            item's scale string, which is not a closed vocabulary.
                            The placeholder shows the canonical catalog forms. */}
                        <Input
                            value={scales}
                            onChange={(e) => setScales(e.target.value)}
                            placeholder="Traditional (1:9), Stablemate (1:32) — comma-separated, blank = any"
                        />
                    </label>
                    <fieldset className="flex flex-col gap-1.5">
                        <legend className="text-sm font-semibold">
                            Allowed finishes (none checked = any)
                        </legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5">
                            {FINISH_OPTIONS.map((finish) => (
                                <label
                                    key={finish}
                                    className="flex items-center gap-2 text-sm font-medium"
                                >
                                    <input
                                        type="checkbox"
                                        checked={finishes.includes(finish)}
                                        onChange={(e) =>
                                            setFinishes((prev) =>
                                                e.target.checked
                                                    ? [...prev, finish]
                                                    : prev.filter((f) => f !== finish),
                                            )
                                        }
                                        className="size-4 accent-forest"
                                    />
                                    {finish}
                                </label>
                            ))}
                        </div>
                    </fieldset>
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
            {/* Same badge the public show page uses (ShowEntrySection),
                so hosts see the flag without opening Edit. */}
            {cls.isQualifying ? (
                <Badge variant="outline">qualifying</Badge>
            ) : (
                <Badge variant="outline">non-qualifying</Badge>
            )}
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
    const [cancellingClass, setCancellingClass] = useState<ConsoleClass | null>(null);

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
                        Start from a template — the full NAMHSA core classlist, one of its
                        divisions, or a small virtual-show starter — then tailor it, or build
                        your own from scratch below.
                    </p>
                    {canEdit && (
                        <ul className="grid w-full max-w-2xl list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                            {SHOW_CLASSLIST_TEMPLATES.map((template) => (
                                <li key={template.key} className="flex">
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() =>
                                            run(() =>
                                                loadNamhsaTemplate({
                                                    showId,
                                                    templateKey: template.key,
                                                }),
                                            )
                                        }
                                        className="flex w-full cursor-pointer flex-col gap-1 rounded-xl border-2 border-input bg-card px-4 py-3 text-left transition-all hover:border-forest/40 disabled:cursor-default disabled:opacity-60"
                                    >
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-semibold text-foreground">
                                                {template.label}
                                            </span>
                                            <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                                {countTemplateClasses(template)} classes
                                            </span>
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {template.description}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {canEdit && pending && (
                        <p className="text-sm text-muted-foreground">Loading template…</p>
                    )}
                </div>
            ) : (
                <ul className="flex list-none flex-col gap-6 p-0">
                    {divisions.map((division, dIndex) => (
                        <li key={division.id} className="ledger-card">
                            <div className="flex flex-wrap items-center gap-3">
                                {canEdit ? (
                                    <RenamableName
                                        name={division.name}
                                        label={division.name}
                                        disabled={pending}
                                        display={
                                            <span className="ledger-tab !mb-0">{division.name}</span>
                                        }
                                        onRename={(name) =>
                                            run(() =>
                                                updateDivision({ divisionId: division.id, name }),
                                            )
                                        }
                                    />
                                ) : (
                                    <span className="ledger-tab !mb-0">{division.name}</span>
                                )}
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
                                            onAddClass={(name, classNumber) =>
                                                run(() => addClass({ sectionId: section.id, name, classNumber, sortOrder: section.classes.length }))
                                            }
                                            onRenameSection={(name) =>
                                                run(() =>
                                                    updateSection({ sectionId: section.id, name }),
                                                )
                                            }
                                            onEditClass={setEditingClass}
                                            onCancelClass={setCancellingClass}
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

            {cancellingClass && (
                <Dialog open onOpenChange={(o) => !o && setCancellingClass(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cancel “{cancellingClass.name}”?</DialogTitle>
                            <DialogDescription>
                                Cancel class — entrants&rsquo; entries stay recorded as history.
                                Restore is available.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setCancellingClass(null)}
                                disabled={pending}
                            >
                                Keep class
                            </Button>
                            <Button
                                variant="destructive-outline"
                                disabled={pending}
                                onClick={async () => {
                                    const cls = cancellingClass;
                                    await run(() =>
                                        updateClass({
                                            classId: cls.id,
                                            patch: { status: "cancelled" },
                                        }),
                                    );
                                    setCancellingClass(null);
                                }}
                            >
                                Cancel class
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
    onRenameSection,
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
    onAddClass: (name: string, classNumber?: string) => Promise<void>;
    onRenameSection: (name: string) => Promise<void>;
    onEditClass: (cls: ConsoleClass) => void;
    onCancelClass: (cls: ConsoleClass) => void;
    onRestoreClass: (cls: ConsoleClass) => void;
}) {
    const heading = (
        <h4 className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
            {section.name}
        </h4>
    );
    return (
        <section aria-label={section.name} className="border-l-2 border-forest/30 pl-4">
            <div className="flex items-center gap-2">
                {canEdit ? (
                    <RenamableName
                        name={section.name}
                        label={section.name}
                        disabled={pending}
                        display={heading}
                        onRename={onRenameSection}
                    />
                ) : (
                    heading
                )}
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
                        withNumber
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
            <p className="mt-2 text-xs text-muted-foreground">
                Axis controls the one-breed-halter-class-per-horse rule — a horse may enter one
                halter class per show, but any number of performance/workmanship/collectibility
                classes.
            </p>
        </div>
    );
}
