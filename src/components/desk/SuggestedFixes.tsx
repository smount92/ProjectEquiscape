"use client";

import { Button } from "@/components/ui/button";
import type { DeskFix } from "@/app/actions/registry-desk";
import { deskFieldLabel } from "@/lib/catalog/editableFields";

/**
 * The fixes the moderators' style rules suggest for this row. "Use this"
 * fills the boxes below; nothing is saved until Save.
 */
export default function SuggestedFixes({
    fixes,
    onUse,
}: {
    fixes: DeskFix[];
    onUse: (changes: Record<string, string>) => void;
}) {
    if (fixes.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            {fixes.map((fix, i) => (
                <div
                    key={`${fix.rule}-${i}`}
                    className="flex flex-col gap-2 rounded-lg border border-forest/30 bg-forest/10 p-3"
                    data-testid="suggested-fix"
                >
                    <div className="text-xs font-bold text-forest">Suggested fix · {fix.rule}</div>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-foreground">
                        {Object.entries(fix.changes).map(([k, v]) => (
                            <li key={k}>
                                {deskFieldLabel(k)} <strong>{v || "(empty)"}</strong>
                            </li>
                        ))}
                    </ul>
                    <Button type="button" size="sm" className="self-start" onClick={() => onUse(fix.changes)}>
                        Use this
                    </Button>
                </div>
            ))}
        </div>
    );
}
