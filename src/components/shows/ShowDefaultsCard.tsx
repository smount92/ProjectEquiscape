"use client";
/**
 * Show-wide class rules — set once, applied to every live class.
 *
 * The classlist builder edits one class at a time, so a host who wants
 * "3 per entrant, OF only" on forty classes had forty dialogs to open
 * (co-owner, 2026-09-29). This card writes the same four rules to all
 * of them in one go; a class can still be tuned on its own afterwards.
 * Only the rules touched are applied — an untouched field leaves each
 * class's own value alone.
 */
import { useState } from "react";
import { applyClassDefaults } from "@/app/actions/shows-v2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FINISH_OPTIONS = ["OF", "Custom", "Artist Resin"] as const;

function parseCommaList(value: string): string[] | null {
    const items = value.split(",").map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : null;
}

export default function ShowDefaultsCard({
    showId,
    classCount,
    pending,
    run,
}: {
    showId: string;
    classCount: number;
    pending: boolean;
    run: (action: () => Promise<{ success: boolean; error?: string }>) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [maxPerEntrant, setMaxPerEntrant] = useState("");
    const [applyMax, setApplyMax] = useState(false);
    const [finishes, setFinishes] = useState<string[]>([]);
    const [applyFinishes, setApplyFinishes] = useState(false);
    const [scales, setScales] = useState("");
    const [applyScales, setApplyScales] = useState(false);
    const [qualifying, setQualifying] = useState(true);
    const [applyQualifying, setApplyQualifying] = useState(false);

    const anything = applyMax || applyFinishes || applyScales || applyQualifying;

    const apply = () => {
        const patch: {
            maxPerEntrant?: number | null;
            allowedFinishes?: string[] | null;
            allowedScales?: string[] | null;
            isQualifying?: boolean;
        } = {};
        if (applyMax) {
            const n = maxPerEntrant.trim() === "" ? null : Number(maxPerEntrant);
            patch.maxPerEntrant = n !== null && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        }
        if (applyFinishes) patch.allowedFinishes = finishes.length > 0 ? finishes : null;
        if (applyScales) patch.allowedScales = parseCommaList(scales);
        if (applyQualifying) patch.isQualifying = qualifying;
        void run(() => applyClassDefaults({ showId, patch }));
    };

    return (
        <section className="ledger-card" aria-labelledby="show-defaults-heading" data-testid="show-defaults">
            <span className="ledger-tab" id="show-defaults-heading">
                Rules for every class
            </span>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-sm text-muted-foreground">
                    Set entry limits, finishes and scales once for all {classCount} classes. Any
                    single class can still be changed on its own afterwards.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
                    {open ? "Hide" : "Set rules for all classes"}
                </Button>
            </div>

            {open && (
                <div className="mt-4 flex flex-col gap-4">
                    <label className="flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            checked={applyMax}
                            onChange={(e) => setApplyMax(e.target.checked)}
                            className="mt-1 size-5 min-h-6 min-w-6 accent-forest"
                            aria-label="Apply a max per entrant to every class"
                        />
                        <span className="flex flex-1 flex-col gap-1.5 font-semibold">
                            Max entries per entrant, per class
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={maxPerEntrant}
                                onChange={(e) => setMaxPerEntrant(e.target.value)}
                                placeholder="Blank = no cap"
                                disabled={!applyMax}
                                id="defaults-max-per-entrant"
                            />
                        </span>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            checked={applyFinishes}
                            onChange={(e) => setApplyFinishes(e.target.checked)}
                            className="mt-1 size-5 min-h-6 min-w-6 accent-forest"
                            aria-label="Apply allowed finishes to every class"
                        />
                        <span className="flex flex-1 flex-col gap-1.5 font-semibold">
                            Allowed finishes (none checked = any)
                            <span className="flex flex-wrap gap-x-4 gap-y-1.5 font-medium">
                                {FINISH_OPTIONS.map((finish) => (
                                    <label key={finish} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            disabled={!applyFinishes}
                                            checked={finishes.includes(finish)}
                                            onChange={(e) =>
                                                setFinishes((prev) =>
                                                    e.target.checked ? [...prev, finish] : prev.filter((f) => f !== finish),
                                                )
                                            }
                                            className="size-5 min-h-6 min-w-6 accent-forest"
                                        />
                                        {finish}
                                    </label>
                                ))}
                            </span>
                        </span>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            checked={applyScales}
                            onChange={(e) => setApplyScales(e.target.checked)}
                            className="mt-1 size-5 min-h-6 min-w-6 accent-forest"
                            aria-label="Apply allowed scales to every class"
                        />
                        <span className="flex flex-1 flex-col gap-1.5 font-semibold">
                            Allowed scales
                            <Input
                                value={scales}
                                onChange={(e) => setScales(e.target.value)}
                                placeholder="Traditional (1:9), Stablemate (1:32) — comma-separated, blank = any"
                                disabled={!applyScales}
                                id="defaults-scales"
                            />
                        </span>
                    </label>

                    <label className="flex items-center gap-3 text-sm">
                        <input
                            type="checkbox"
                            checked={applyQualifying}
                            onChange={(e) => setApplyQualifying(e.target.checked)}
                            className="size-5 min-h-6 min-w-6 accent-forest"
                            aria-label="Apply the qualifying setting to every class"
                        />
                        <span className="flex flex-wrap items-center gap-3 font-semibold">
                            Qualifying (1st &amp; 2nd earn MHH cards):
                            <select
                                value={qualifying ? "yes" : "no"}
                                onChange={(e) => setQualifying(e.target.value === "yes")}
                                disabled={!applyQualifying}
                                className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                                aria-label="Qualifying for every class"
                            >
                                <option value="yes">Yes, every class</option>
                                <option value="no">No, none</option>
                            </select>
                        </span>
                    </label>

                    <div className="flex items-center gap-3">
                        <Button type="button" onClick={apply} disabled={pending || !anything} id="apply-class-defaults">
                            Apply to all {classCount} classes
                        </Button>
                        {!anything && (
                            <span className="text-xs text-muted-foreground">Tick the rules you want applied.</span>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
