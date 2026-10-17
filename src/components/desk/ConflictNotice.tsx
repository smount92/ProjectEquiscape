"use client";

import { Button } from "@/components/ui/button";
import { buildDeskFields, type DeskSource } from "@/lib/catalog/editableFields";

/**
 * Someone saved this row while it was open here. Nothing was written: the
 * moderator sees what the other person saved next to their own boxes and
 * chooses.
 */
export default function ConflictNotice({
    theirs,
    draft,
    onKeepMine,
    onUseTheirs,
}: {
    theirs: DeskSource;
    draft: Record<string, string>;
    onKeepMine: () => void;
    onUseTheirs: () => void;
}) {
    const fields = buildDeskFields(theirs).filter((f) => !f.readOnly && f.key in draft);
    const differ = fields.filter((f) => f.original.trim() !== (draft[f.key] ?? "").trim());
    return (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <strong className="text-sm text-warning">Someone saved this while you were editing it.</strong>
            <p className="m-0 text-sm text-foreground">
                Nothing of yours was saved, and your changes are still in the boxes. Here is what they saved where you
                typed something different:
            </p>
            {differ.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                    {differ.map((f) => (
                        <li key={f.key}>
                            <span className="font-semibold">{f.label}:</span> theirs “{f.original || "empty"}”, yours “
                            {draft[f.key] || "empty"}”
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="m-0 text-sm text-muted-foreground">They changed other fields; yours still differ.</p>
            )}
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={onKeepMine}>
                    Keep mine and save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onUseTheirs}>
                    Use theirs, drop mine
                </Button>
            </div>
        </div>
    );
}
