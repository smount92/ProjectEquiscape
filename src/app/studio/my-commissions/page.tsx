import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getClientCommissions, type Commission } from "@/app/actions/art-studio";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { CommissionPill } from "@/components/studio/StudioBits";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ballIsWith, isTerminal, statusBlurb } from "@/lib/studio/pipeline";
import { formatMoney } from "@/lib/studio/terms";

export const metadata: Metadata = {
    title: "My commissions",
    robots: { index: false },
};

/**
 * The commissioner's side. Grouped by whether it needs them, because
 * "which of these is waiting on me" is the only question this page is
 * opened to answer.
 */
export default async function MyCommissionsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=%2Fstudio%2Fmy-commissions");

    const commissions = await getClientCommissions();

    const needsYou = commissions.filter(
        (c) => !isTerminal(c.status) && ballIsWith(c.status) === "client",
    );
    const inFlight = commissions.filter(
        (c) => !isTerminal(c.status) && ballIsWith(c.status) !== "client",
    );
    const finished = commissions.filter(
        (c) => c.status === "completed" || c.status === "delivered",
    );
    const closed = commissions.filter(
        (c) => c.status === "declined" || c.status === "cancelled",
    );

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="📜"
                title="My commissions"
                subtitle={
                    needsYou.length > 0
                        ? `${needsYou.length} waiting on you`
                        : `${commissions.length} commission${commissions.length === 1 ? "" : "s"}`
                }
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/studio">Find an artist</Link>
                    </Button>
                }
            />

            {commissions.length === 0 ? (
                <div className="border-input bg-card rounded-lg border p-12 text-center shadow-md">
                    <div className="mb-4 text-[3rem]">🎨</div>
                    <h2 className="mb-2 font-serif text-xl font-bold">
                        You haven&rsquo;t commissioned anyone yet
                    </h2>
                    <p className="text-secondary-foreground mx-auto mb-6 max-w-[460px] text-sm leading-relaxed">
                        Browse the studio directory to find customizers, finishwork artists and
                        tack makers taking work. Sending a request costs nothing — you get a
                        written quote with the terms attached, and only then decide.
                    </p>
                    <Button asChild size="wide">
                        <Link href="/studio">Browse the Art Studio →</Link>
                    </Button>
                </div>
            ) : (
                <>
                    <Group
                        title="Waiting on you"
                        items={needsYou}
                        emphasis
                        blurb="These need a decision from you before they can move."
                    />
                    <Group title="In progress" items={inFlight} />
                    <Group title="Finished" items={finished} />
                    <Group title="Closed" items={closed} />
                </>
            )}
        </ExplorerLayout>
    );
}

function Group({
    title,
    items,
    emphasis,
    blurb,
}: {
    title: string;
    items: Commission[];
    emphasis?: boolean;
    blurb?: string;
}) {
    if (items.length === 0) return null;

    return (
        <section className="mb-8">
            <h2 className="mb-1 font-serif text-lg font-bold">
                {title}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                    ({items.length})
                </span>
            </h2>
            {blurb && <p className="text-muted-foreground mb-4 text-sm">{blurb}</p>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => (
                    <Link
                        key={c.id}
                        href={`/studio/commission/${c.id}`}
                        className={`bg-card flex flex-col rounded-lg border p-5 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            emphasis ? "border-studio/50" : "border-input"
                        }`}
                    >
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <span className="font-serif text-sm font-bold">
                                {c.commissionType}
                            </span>
                            <CommissionPill status={c.status} />
                        </div>

                        <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span>@{c.artistAlias}</span>
                            {c.agreedPrice != null && (
                                <span className="font-serif tabular-nums">
                                    {formatMoney(c.agreedPrice)}
                                </span>
                            )}
                        </div>

                        <p className="text-secondary-foreground mb-3 line-clamp-2 text-sm leading-relaxed">
                            {c.description}
                        </p>

                        <span className="border-input text-muted-foreground mt-auto border-t pt-2 text-xs">
                            {statusBlurb(c.status, "client")}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
