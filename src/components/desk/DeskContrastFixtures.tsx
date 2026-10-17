"use client";

/**
 * The Registry Desk's small areas for the contrast audit
 * (/dev/contrast-fixtures): the mold header, the rail with every flag
 * tone, the editor with a suggested fix, a refused field and a year
 * stored as text, the bar, Queue cards, and the notes the merge and
 * remove dialogs show. Made-up data; nothing here calls the server until
 * a button is pressed.
 */
import type { DeskRelease, QueueItem } from "@/app/actions/registry-desk";
import type { DeskSource } from "@/lib/catalog/editableFields";
import DeskField from "@/components/desk/DeskField";
import FlagChips from "@/components/desk/FlagChips";
import MoldView from "@/components/desk/MoldView";
import QueueItemCard from "@/components/desk/QueueItemCard";
import { MODERATOR_WAITS_FOR_243, NOT_UNDOABLE } from "@/components/desk/mergeWords";

function row(over: Partial<DeskSource>): DeskSource {
    return {
        id: "00000000-0000-4000-8000-000000000001",
        item_type: "plastic_release",
        parent_id: "00000000-0000-4000-8000-0000000000aa",
        title: "Saddlebred",
        maker: "Breyer",
        maker_slug: "breyer",
        slug: "saddlebred-5002",
        scale: "Stablemate (1:32)",
        artist: null,
        manufacturer: "Breyer",
        attributes: {},
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...over,
    };
}

const MOLD: DeskRelease = {
    row: row({
        id: "00000000-0000-4000-8000-0000000000aa",
        item_type: "plastic_mold",
        parent_id: null,
        title: "Saddlebred",
        attributes: { material: "Plastic", release_year_start: 1975 },
    }),
    flags: [{ key: "mold_no_generation", label: "No generation tag" }],
    fixes: [],
    horses: 0,
    wantLists: 0,
};

const RELEASES: DeskRelease[] = [
    {
        row: row({
            id: "00000000-0000-4000-8000-000000000001",
            title: "Sears Holiday Catalog",
            attributes: { release_year_start: "1998", model_number: "5002" },
        }),
        flags: [
            { key: "shop_or_sale_title", label: "Shop or sale as the title" },
            { key: "number_clash", label: "Shares its number with another release" },
            { key: "year_as_text", label: "Years stored as text" },
        ],
        fixes: [{ rule: "Shop names go in run details", changes: { title: "Saddlebred", run_detail: "Sears, 1998" } }],
        horses: 2,
        wantLists: 1,
    },
    {
        row: row({
            id: "00000000-0000-4000-8000-000000000002",
            title: "Saddlebred",
            attributes: { model_number: "5110", color_description: "Black" },
        }),
        flags: [],
        fixes: [],
        horses: 0,
        wantLists: 0,
    },
];

const CARD: QueueItem = {
    id: "00000000-0000-4000-8000-0000000000c1",
    tab: "additions",
    kind: "addition",
    kindLabel: "New entry",
    title: "#5038 Morgan Mare",
    itemId: null,
    deskHref: null,
    moldTitle: "Morgan Mare",
    who: "@Maple",
    mine: true,
    createdAt: "2026-10-16T10:00:00Z",
    reason: "Adding the G1 Morgan mares from my list.",
    changes: [
        { key: "title", label: "Name", from: "", to: "#5038 Morgan Mare" },
        { key: "year", label: "First year", from: "", to: "1975" },
    ],
    fields: { title: "#5038 Morgan Mare", year: "1975" },
    claim: { by: "@BayLeaf", mine: false, until: "2026-10-16T10:30:00Z" },
    keep: null,
    note: "The model number was in the title.",
    canEdit: true,
    current: null,
    willDrop: [
        { key: "run_type", label: "Run type", value: "Store Special", error: "not a run type the Registry knows." },
    ],
};

const noop = () => {};

export default function DeskContrastFixtures() {
    return (
        <div className="flex flex-col gap-6" data-testid="fixtures-desk">
            <h2 className="m-0 text-lg">Registry Desk</h2>
            <MoldView mold={MOLD} releases={RELEASES} initialReleaseId={RELEASES[0].row.id} role="owner" />
            <QueueItemCard item={CARD} role="owner" onDone={noop} />
            <QueueItemCard
                item={{
                    ...CARD,
                    mine: false,
                    claim: null,
                    tab: "duplicates",
                    kind: "duplicate",
                    kindLabel: "Duplicate",
                    keep: { id: "k", title: "Saddlebred" },
                }}
                role="moderator"
                onDone={noop}
            />
            <div className="ledger-card flex flex-col gap-3">
                <FlagChips
                    flags={[
                        { key: "no_colour", label: "No colour" },
                        { key: "roster_in_title", label: "Whole set in the title" },
                        { key: "description_in_title", label: "Description in the title" },
                    ]}
                />
                <DeskField
                    field={{
                        key: "run_count",
                        label: "Pieces made",
                        kind: "number",
                        group: "release",
                        appliesTo: "release",
                        original: "",
                    }}
                    value="lots"
                    idPrefix="fixture"
                    dirty
                    error="Pieces made is a whole number."
                    onChange={noop}
                />
                <p className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{NOT_UNDOABLE}</p>
                <p className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {MODERATOR_WAITS_FOR_243}
                </p>
                <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                    Removing opens once you add update 243 (Admin › Ops). Until then nothing can be removed.
                </p>
                <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <p className="m-0 text-sm font-semibold text-warning">
                        Approved, but the Registry left these values out. Fix them on the entry if you know better:
                    </p>
                    <ul className="m-0 list-disc pl-5 text-sm text-foreground">
                        <li>Run type “Store Special”: not a run type the Registry knows.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
