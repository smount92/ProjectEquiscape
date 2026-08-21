import Link from "next/link";
import { redirect } from "next/navigation";

import { listDeletedHorses } from "@/app/actions/horse";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import RestoreHorseCard from "@/components/stable/RestoreHorseCard";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
    title: "Recently Deleted — Digital Stable",
    description: "Restore a model you deleted from your stable.",
};

/**
 * Recently Deleted.
 *
 * Deleting a horse has always been a soft delete — the row survives so
 * provenance chains and show records don't develop holes — but there was no
 * way to see that or undo it. A member who deleted the wrong model had no
 * recourse and no reason to think the record still existed.
 *
 * The one thing this shelf can't give back is the photographs: the delete
 * removes the storage objects and the image rows for real, to keep storage
 * costs honest. The page says so out loud rather than letting someone
 * restore and then discover it.
 */
export default async function RecentlyDeletedPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const horses = await listDeletedHorses();

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                compact
                icon="🗑️"
                title="Recently Deleted"
                subtitle="Models you removed from your stable"
                backHref="/dashboard"
                backLabel="Stable"
            />

            {horses.length === 0 ? (
                <div className="ledger-paper px-6 py-10 text-center">
                    <p className="text-foreground m-0 font-serif text-lg font-bold">Nothing deleted</p>
                    <p className="text-secondary-foreground mx-auto mt-2 mb-5 max-w-md text-sm leading-relaxed">
                        When you delete a model, it lands here instead of vanishing — so a mistake stays a mistake
                        and not a loss.
                    </p>
                    <Button asChild variant="outline">
                        <Link href="/dashboard">Back to the Stable</Link>
                    </Button>
                </div>
            ) : (
                <>
                    <div className="border-input bg-card mb-6 rounded-lg border px-5 py-4">
                        <p className="text-secondary-foreground m-0 text-sm leading-relaxed">
                            These models are hidden from your stable, the market and every public page, but their
                            records — show results, ownership history, condition history — were never deleted.
                            Restoring one brings it back <strong>private</strong> and{" "}
                            <strong>not for sale</strong>; you decide from there whether to publish or list it
                            again.
                        </p>
                        <p className="text-secondary-foreground m-0 mt-2 text-sm leading-relaxed">
                            <strong>Photos aren&rsquo;t recoverable.</strong> Deleting a model erases its
                            photographs from storage for good, and no restore can bring them back — you&rsquo;ll
                            need to re-upload them.
                        </p>
                    </div>

                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                        {horses.map((h) => (
                            <RestoreHorseCard
                                key={h.id}
                                id={h.id}
                                recoveredName={h.recoveredName}
                                referenceName={h.referenceName}
                                deletedAt={h.deletedAt}
                            />
                        ))}
                    </ul>
                </>
            )}
        </ExplorerLayout>
    );
}
