import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getHostedShows } from "@/app/actions/shows-v2";
import type { HostedShowSummary } from "@/lib/shows/console";
import { showsV2Enabled } from "@/lib/shows/flags";
import { formatStatus } from "@/lib/shows/stateMachine";
import { createClient } from "@/lib/supabase/server";
import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";
import CreateShowV2Form from "@/components/shows/CreateShowV2Form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Show Office",
    description: "Create and run your shows — live or online — from one console.",
};

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MyShowsList({ shows }: { shows: HostedShowSummary[] }) {
    if (shows.length === 0) {
        return (
            <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                    You haven&rsquo;t hosted a show yet — open your first one below. Free shows are
                    complete: create, take entries, judge, and publish results.
                </p>
            </div>
        );
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Show</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                    <TableHead />
                </TableRow>
            </TableHeader>
            <TableBody>
                {shows.map((show) => (
                    <TableRow key={show.id}>
                        <TableCell className="font-semibold">
                            <Link
                                href={`/shows/host/${show.id}`}
                                className="text-foreground no-underline hover:underline"
                            >
                                {show.title}
                            </Link>
                            {show.role === "co_host" && (
                                <Badge variant="outline" className="ml-2">
                                    co-host
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell>{show.mode === "live" ? "Live" : "Online"}</TableCell>
                        <TableCell>
                            <span
                                className={`stamp ${show.status === "draft" ? "stamp-red" : ""}`}
                            >
                                {formatStatus(show.status)}
                            </span>
                        </TableCell>
                        <TableCell>
                            {formatDate(show.mode === "live" ? show.showDate : show.entriesCloseAt)}
                        </TableCell>
                        <TableCell className="text-right">{show.entryCount}</TableCell>
                        <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/shows/host/${show.id}`}>Open console</Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export default async function HostShowsPage() {
    if (!showsV2Enabled()) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const result = await getHostedShows();
    const shows = result.success ? result.shows : [];

    return (
        <CommandCenterLayout
            title="Show Office"
            description="Create and run your shows — live or online — from one console."
            mainContent={
                <>
                    <section className="ledger-card" aria-labelledby="my-shows-heading">
                        <span className="ledger-tab" id="my-shows-heading">
                            My Shows
                        </span>
                        {!result.success && (
                            <p role="alert" className="text-sm font-semibold text-destructive">
                                {result.error}
                            </p>
                        )}
                        <MyShowsList shows={shows} />
                    </section>

                    <section className="ledger-card" aria-labelledby="create-show-heading">
                        <span className="ledger-tab" id="create-show-heading">
                            Open a New Show
                        </span>
                        <CreateShowV2Form />
                    </section>
                </>
            }
        />
    );
}
