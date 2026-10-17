"use client";

import { useEffect, useRef } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import type { DeskFlag } from "@/app/actions/registry-desk";
import FlagChips from "@/components/desk/FlagChips";

export interface RailEntry {
    id: string;
    title: string;
    isMold: boolean;
    number: string;
    colour: string;
    years: string;
    run: string;
    horses: number;
    wantLists: number;
    flags: DeskFlag[];
    /** Holds unsaved changes. */
    dirty: boolean;
}

function UnsavedDot() {
    return (
        <span
            role="img"
            aria-label="Unsaved changes"
            title="Unsaved changes"
            data-testid="unsaved-dot"
            className="inline-block size-2.5 shrink-0 rounded-full bg-warning"
        />
    );
}

/**
 * The releases on a mold, one row each: click one and its full record
 * opens in the editor below. Tick rows to merge several. On a phone the
 * table becomes a list to pick from, above the editor.
 */
export default function ReleaseRail({
    entries,
    selectedId,
    onSelect,
    checked,
    onToggle,
}: {
    entries: RailEntry[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    checked: ReadonlySet<string>;
    onToggle: (id: string) => void;
}) {
    const selectedRef = useRef<HTMLTableRowElement | null>(null);
    useEffect(() => {
        selectedRef.current?.scrollIntoView?.({ block: "nearest" });
    }, [selectedId]);

    const index = entries.findIndex((e) => e.id === selectedId);

    return (
        <>
            {/* Phones: a list to pick from. */}
            <div className="flex flex-col gap-1 md:hidden">
                <label htmlFor="desk-release-pick" className="text-sm font-semibold text-foreground">
                    Release {index >= 0 ? `${index + 1} of ${entries.length}` : ""}
                </label>
                <NativeSelect
                    id="desk-release-pick"
                    value={selectedId ?? ""}
                    onChange={(e) => onSelect(e.target.value)}
                    data-testid="release-select"
                >
                    {entries.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.dirty ? "• " : ""}
                            {e.isMold ? `The mold: ${e.title}` : e.title}
                            {e.number ? ` #${e.number}` : ""}
                            {e.flags.length ? ` (${e.flags.length} to look at)` : ""}
                        </option>
                    ))}
                </NativeSelect>
            </div>

            {/* Wider screens: the table. */}
            <div
                className="hidden max-h-[45vh] overflow-auto rounded-lg border border-input bg-card md:block"
                data-testid="release-rail"
            >
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-[1] bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
                        <tr>
                            <th className="w-10 px-3 py-2">
                                <span className="sr-only">Tick to merge</span>
                            </th>
                            <th className="px-2 py-2">Release</th>
                            <th className="px-2 py-2">No.</th>
                            <th className="px-2 py-2">Colour</th>
                            <th className="px-2 py-2">Years</th>
                            <th className="px-2 py-2">Run</th>
                            <th className="px-3 py-2">In stables</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e) => {
                            const on = e.id === selectedId;
                            return (
                                <tr
                                    key={e.id}
                                    ref={on ? selectedRef : undefined}
                                    aria-current={on ? "true" : undefined}
                                    data-testid="rail-row"
                                    className={`border-t border-input align-top ${
                                        on ? "bg-forest/10" : checked.has(e.id) ? "bg-muted" : "hover:bg-muted/60"
                                    }`}
                                >
                                    <td className="px-3 py-2">
                                        {!e.isMold && (
                                            <input
                                                type="checkbox"
                                                checked={checked.has(e.id)}
                                                onChange={() => onToggle(e.id)}
                                                aria-label={`Tick ${e.title}`}
                                                className="size-4 accent-[var(--color-forest)]"
                                            />
                                        )}
                                    </td>
                                    <td className="max-w-[28rem] px-2 py-2">
                                        <button
                                            type="button"
                                            onClick={() => onSelect(e.id)}
                                            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-semibold text-foreground hover:underline"
                                        >
                                            {e.dirty && <UnsavedDot />}
                                            <span>{e.isMold ? `The mold: ${e.title}` : e.title}</span>
                                        </button>
                                        <FlagChips flags={e.flags} className="mt-1" />
                                    </td>
                                    <td className="px-2 py-2 text-secondary-foreground tabular-nums">
                                        {e.number || "—"}
                                    </td>
                                    <td className="max-w-[14rem] px-2 py-2 text-secondary-foreground">
                                        {e.colour || "—"}
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap tabular-nums">{e.years || "—"}</td>
                                    <td className="px-2 py-2 text-secondary-foreground">{e.run || "—"}</td>
                                    <td className="px-3 py-2 text-secondary-foreground">
                                        {e.horses || e.wantLists
                                            ? [
                                                  e.horses ? `${e.horses} horse${e.horses === 1 ? "" : "s"}` : "",
                                                  e.wantLists ? `${e.wantLists} want` : "",
                                              ]
                                                  .filter(Boolean)
                                                  .join(", ")
                                            : "None"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
