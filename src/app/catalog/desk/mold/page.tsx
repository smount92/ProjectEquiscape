import EntrySearch from "@/components/desk/EntrySearch";
import MoldPicker from "@/components/desk/MoldPicker";

/**
 * The Mold view's front page: pick a mold to work through, or find any
 * entry at all (releases with no mold, resins, tack and props have no mold
 * to pick) and open it in the editor.
 */
export default function DeskMoldPickPage() {
    return (
        <section aria-label="Pick a mold" className="flex max-w-[720px] flex-col gap-3">
            <p className="m-0 text-sm text-secondary-foreground">
                Pick a mold, then click through its releases one by one. Each one&apos;s full record opens below it,
                every field, ready to fix and save.
            </p>
            <div className="rounded-lg border border-input bg-card p-4">
                <MoldPicker autoFocus />
            </div>
            <div className="rounded-lg border border-input bg-card p-4">
                <EntrySearch />
            </div>
        </section>
    );
}
